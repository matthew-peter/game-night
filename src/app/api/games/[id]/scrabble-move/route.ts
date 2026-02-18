import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { Seat } from '@/lib/supabase/types';
import { ScrabbleBoardState, TilePlacement, MAX_SCORELESS_TURNS } from '@/lib/game/scrabble/types';
import { placeTiles, exchangeTiles, passTurn } from '@/lib/game/scrabble/logic';
import { loadServerDictionary } from '@/lib/game/scrabble/dictionary-server';
import { pushToUser } from '@/lib/pushNotify';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Load the full dictionary for word validation
    loadServerDictionary();

    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { moveType } = body;

    // Fetch the game
    const { data: gameData, error: fetchError } = await supabase
      .from('games')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !gameData) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (gameData.game_type !== 'scrabble') {
      return NextResponse.json({ error: 'This is not a Scrabble game' }, { status: 400 });
    }

    if (gameData.status !== 'playing') {
      return NextResponse.json({ error: 'Game is not in progress' }, { status: 400 });
    }

    // Look up the user's seat
    const { data: playerRow } = await supabase
      .from('game_players')
      .select('seat')
      .eq('game_id', id)
      .eq('user_id', user.id)
      .single();

    if (!playerRow) {
      return NextResponse.json({ error: 'You are not in this game' }, { status: 403 });
    }

    const mySeat: Seat = playerRow.seat;
    const currentTurn: Seat = gameData.current_turn;

    if (mySeat !== currentTurn) {
      return NextResponse.json({ error: "It's not your turn" }, { status: 400 });
    }

    // Fetch all players (for notifications)
    const { data: allPlayers } = await supabase
      .from('game_players')
      .select('user_id, seat, user:users!game_players_user_id_fkey(username)')
      .eq('game_id', id);

    const playersBySeat = new Map<number, { user_id: string; username: string }>();
    if (allPlayers) {
      for (const p of allPlayers) {
        const uname = (p.user as unknown as { username: string })?.username ?? 'Player';
        playersBySeat.set(p.seat, { user_id: p.user_id, username: uname });
      }
    }
    const actingPlayerName = playersBySeat.get(mySeat)?.username ?? 'Player';

    const boardState = gameData.board_state as unknown as ScrabbleBoardState;
    const playerCount = gameData.max_players ?? 2;

    // ── Place Tiles ──────────────────────────────────────────────────────
    if (moveType === 'place_tiles') {
      const placements: TilePlacement[] = body.placements;

      if (!placements || !Array.isArray(placements) || placements.length === 0) {
        return NextResponse.json({ error: 'No tile placements provided' }, { status: 400 });
      }

      const result = placeTiles(boardState, placements, mySeat, playerCount);

      if (!result.success) {
        return NextResponse.json({
          error: result.error,
          invalidWords: result.invalidWords,
        }, { status: 400 });
      }

      // Save the move
      await supabase.from('moves').insert({
        game_id: id,
        player_id: user.id,
        move_type: 'place_tiles',
        move_data: {
          placements,
          wordsFormed: result.wordsFormed,
          totalScore: result.totalScore,
        },
      } as Record<string, unknown>);

      // Update the game
      const updateData: Record<string, unknown> = {
        board_state: result.newBoardState,
        current_turn: result.nextTurn,
      };

      if (result.gameOver) {
        updateData.status = 'completed';
        updateData.ended_at = new Date().toISOString();
        const scores = result.newBoardState!.scores;
        const maxScore = Math.max(...scores);
        const winnerSeat = scores.indexOf(maxScore);
        updateData.result = 'win';
        updateData.current_turn = winnerSeat;
      }

      const { error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      // Notify the next player
      if (!result.gameOver && result.nextTurn !== undefined) {
        const nextPlayer = playersBySeat.get(result.nextTurn);
        if (nextPlayer && nextPlayer.user_id !== user.id) {
          await pushToUser(
            nextPlayer.user_id,
            id,
            `${actingPlayerName} played — your turn!`
          ).catch(() => {});
        }
      }

      return NextResponse.json({
        success: true,
        wordsFormed: result.wordsFormed,
        totalScore: result.totalScore,
        gameOver: result.gameOver,
        nextTurn: result.nextTurn,
      });
    }

    // ── Exchange Tiles ───────────────────────────────────────────────────
    if (moveType === 'exchange_tiles') {
      const tilesToExchange: string[] = body.tiles;

      if (!tilesToExchange || !Array.isArray(tilesToExchange) || tilesToExchange.length === 0) {
        return NextResponse.json({ error: 'No tiles selected for exchange' }, { status: 400 });
      }

      const result = exchangeTiles(boardState, tilesToExchange, mySeat, playerCount);

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      await supabase.from('moves').insert({
        game_id: id,
        player_id: user.id,
        move_type: 'exchange_tiles',
        move_data: {
          tilesExchanged: tilesToExchange.length,
        },
      } as Record<string, unknown>);

      const updateData: Record<string, unknown> = {
        board_state: result.newBoardState,
        current_turn: result.nextTurn,
      };

      if (result.gameOver) {
        updateData.status = 'completed';
        updateData.ended_at = new Date().toISOString();
        updateData.result = 'win';
      }

      const { error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      // Notify the next player
      if (!result.gameOver && result.nextTurn !== undefined) {
        const nextPlayer = playersBySeat.get(result.nextTurn);
        if (nextPlayer && nextPlayer.user_id !== user.id) {
          await pushToUser(
            nextPlayer.user_id,
            id,
            `${actingPlayerName} exchanged tiles — your turn!`
          ).catch(() => {});
        }
      }

      return NextResponse.json({
        success: true,
        gameOver: result.gameOver,
        nextTurn: result.nextTurn,
      });
    }

    // ── Pass ─────────────────────────────────────────────────────────────
    if (moveType === 'pass') {
      const result = passTurn(boardState, mySeat, playerCount);

      await supabase.from('moves').insert({
        game_id: id,
        player_id: user.id,
        move_type: 'pass',
      } as Record<string, unknown>);

      const updateData: Record<string, unknown> = {
        board_state: result.newBoardState,
        current_turn: result.nextTurn,
      };

      if (result.gameOver) {
        updateData.status = 'completed';
        updateData.ended_at = new Date().toISOString();
        updateData.result = 'win';
      }

      const { error: updateError } = await supabase
        .from('games')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      // Notify the next player
      if (!result.gameOver && result.nextTurn !== undefined) {
        const nextPlayer = playersBySeat.get(result.nextTurn);
        if (nextPlayer && nextPlayer.user_id !== user.id) {
          await pushToUser(
            nextPlayer.user_id,
            id,
            `${actingPlayerName} passed — your turn!`
          ).catch(() => {});
        }
      }

      return NextResponse.json({
        success: true,
        gameOver: result.gameOver,
        nextTurn: result.nextTurn,
        scorelessTurns: result.newBoardState.consecutivePasses,
        maxScorelessTurns: MAX_SCORELESS_TURNS,
      });
    }

    return NextResponse.json({ error: 'Invalid move type' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/games/[id]/scrabble-move:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

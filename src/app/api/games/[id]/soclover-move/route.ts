import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { SoCloverBoardState, SoCloverMoveType, RoundResult } from '@/lib/game/soclover/types';
import {
  validateClues,
  getPlayerKeywords,
  allCluesSubmitted,
  checkPlacements,
  computeRoundScore,
  getCurrentSpectatorSeat,
  createFreshGuess,
  allRoundsComplete,
  computeTotalScore,
} from '@/lib/game/soclover/logic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const moveType: SoCloverMoveType = body.moveType;

    const { data: gameData, error: fetchError } = await supabase
      .from('games')
      .select('*, game_players(*)')
      .eq('id', id)
      .single();

    if (fetchError || !gameData) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    if (gameData.game_type !== 'so_clover') {
      return NextResponse.json({ error: 'Not a So Clover game' }, { status: 400 });
    }

    if (gameData.status !== 'playing') {
      if (moveType === 'acknowledge_result' && gameData.status === 'completed') {
        return NextResponse.json({ success: true, gameComplete: true });
      }
      return NextResponse.json({ error: 'Game is not in progress' }, { status: 400 });
    }

    const player = gameData.game_players?.find(
      (p: { user_id: string }) => p.user_id === user.id
    );
    if (!player) {
      return NextResponse.json({ error: 'You are not in this game' }, { status: 403 });
    }

    const seat: number = player.seat;
    const boardState: SoCloverBoardState = gameData.board_state;

    // ── submit_clues ──────────────────────────────────────────────────────
    if (moveType === 'submit_clues') {
      if (gameData.current_phase !== 'clue_writing') {
        return NextResponse.json({ error: 'Not in clue writing phase' }, { status: 400 });
      }

      if (boardState.clovers[seat].cluesSubmitted) {
        return NextResponse.json({ error: 'Clues already submitted' }, { status: 400 });
      }

      const { clues } = body;
      if (!Array.isArray(clues) || clues.length !== 4) {
        return NextResponse.json({ error: 'Must provide exactly 4 clues' }, { status: 400 });
      }

      const playerKeywords = getPlayerKeywords(boardState, seat);
      const validation = validateClues(clues, playerKeywords);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      const updatedClovers = [...boardState.clovers];
      updatedClovers[seat] = {
        ...updatedClovers[seat],
        clues: clues.map((c: string) => c.trim().toUpperCase()),
        cluesSubmitted: true,
      };

      const updatedBoardState: SoCloverBoardState = {
        ...boardState,
        clovers: updatedClovers,
      };

      let newPhase = gameData.current_phase;
      if (allCluesSubmitted(updatedBoardState)) {
        newPhase = 'resolution';
        updatedBoardState.currentSpectatorIdx = 0;
        const firstSpectator = updatedBoardState.spectatorOrder[0];
        updatedBoardState.currentGuess = createFreshGuess(updatedBoardState, firstSpectator);
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from('games')
        .update({
          board_state: updatedBoardState,
          current_phase: newPhase,
        })
        .eq('id', id)
        .select('id')
        .single();

      if (updateError || !updatedRow) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      await supabase.from('moves').insert({
        game_id: id,
        player_id: user.id,
        move_type: 'submit_clues',
        move_data: { clues: clues.map((c: string) => c.trim().toUpperCase()) },
      });

      return NextResponse.json({ success: true, phase: newPhase });
    }

    // ── take_control ────────────────────────────────────────────────────
    if (moveType === 'take_control') {
      if (gameData.current_phase !== 'resolution') {
        return NextResponse.json({ error: 'Not in resolution phase' }, { status: 400 });
      }

      const spectatorSeat = getCurrentSpectatorSeat(boardState);
      if (seat === spectatorSeat) {
        return NextResponse.json({ error: 'Spectator cannot take control' }, { status: 400 });
      }

      const spectatorSeatForGuess = getCurrentSpectatorSeat(boardState)!;
      const updatedGuess = {
        ...(boardState.currentGuess ?? createFreshGuess(boardState, spectatorSeatForGuess)),
        driverSeat: seat,
      };

      const updatedBoardState: SoCloverBoardState = {
        ...boardState,
        currentGuess: updatedGuess,
      };

      const { data: updatedRow, error: updateError } = await supabase
        .from('games')
        .update({ board_state: updatedBoardState })
        .eq('id', id)
        .select('id')
        .single();

      if (updateError || !updatedRow) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ── place_cards ───────────────────────────────────────────────────────
    if (moveType === 'place_cards') {
      if (gameData.current_phase !== 'resolution') {
        return NextResponse.json({ error: 'Not in resolution phase' }, { status: 400 });
      }

      const spectatorSeat = getCurrentSpectatorSeat(boardState);
      if (seat === spectatorSeat) {
        return NextResponse.json({ error: 'Spectator cannot place cards' }, { status: 400 });
      }

      // Only the current driver can place cards
      const currentDriver = boardState.currentGuess?.driverSeat;
      if (currentDriver != null && currentDriver !== seat) {
        return NextResponse.json({ error: 'Another player is arranging — tap "Take Control" first' }, { status: 400 });
      }

      const { placements, rotations } = body;
      if (!Array.isArray(placements) || placements.length !== 4 ||
          !Array.isArray(rotations) || rotations.length !== 4) {
        return NextResponse.json({ error: 'Invalid placement data' }, { status: 400 });
      }

      const spectatorSeatForPlace = getCurrentSpectatorSeat(boardState)!;
      const updatedGuess = {
        ...(boardState.currentGuess ?? createFreshGuess(boardState, spectatorSeatForPlace)),
        placements,
        rotations,
        driverSeat: seat,
      };

      const updatedBoardState: SoCloverBoardState = {
        ...boardState,
        currentGuess: updatedGuess,
      };

      const { data: updatedRow, error: updateError } = await supabase
        .from('games')
        .update({ board_state: updatedBoardState })
        .eq('id', id)
        .select('id')
        .single();

      if (updateError || !updatedRow) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ── submit_guess ──────────────────────────────────────────────────────
    if (moveType === 'submit_guess') {
      if (gameData.current_phase !== 'resolution') {
        return NextResponse.json({ error: 'Not in resolution phase' }, { status: 400 });
      }

      const spectatorSeat = getCurrentSpectatorSeat(boardState);
      if (seat === spectatorSeat) {
        return NextResponse.json({ error: 'Spectator cannot submit guess' }, { status: 400 });
      }

      if (!boardState.currentGuess) {
        return NextResponse.json({ error: 'No active guess' }, { status: 400 });
      }

      const { placements, rotations } = body;
      if (!Array.isArray(placements) || placements.length !== 4 ||
          !Array.isArray(rotations) || rotations.length !== 4) {
        return NextResponse.json({ error: 'Invalid guess data' }, { status: 400 });
      }

      const hasNulls = placements.some((p: number | null) => p === null);
      if (hasNulls) {
        return NextResponse.json({ error: 'All 4 positions must have a card' }, { status: 400 });
      }

      const spectatorClover = boardState.clovers[spectatorSeat!];
      const guess = boardState.currentGuess;

      const score = computeRoundScore(spectatorClover, guess, placements, rotations);

      const updatedBoardState: SoCloverBoardState = { ...boardState };
      const updatedRoundScores = [...boardState.roundScores];

      if (score === -1) {
        // First attempt failed — set up attempt 2
        const results = checkPlacements(spectatorClover, placements, rotations);
        const secondAttemptPlacements = placements.map(
          (p: number | null, i: number) => (results[i] ? p : null)
        );
        const secondAttemptRotations = rotations.map(
          (r: number, i: number) => (results[i] ? r : 0)
        );

        updatedBoardState.currentGuess = {
          placements: secondAttemptPlacements,
          rotations: secondAttemptRotations,
          attempt: 2,
          firstAttemptResults: results,
          driverSeat: null,
          availableCardOrder: boardState.currentGuess.availableCardOrder,
        };
        updatedBoardState.lastRoundResult = null;
      } else {
        // Round scored — store result for the overlay, don't advance yet
        const results = checkPlacements(spectatorClover, placements, rotations);
        updatedRoundScores[boardState.spectatorOrder[boardState.currentSpectatorIdx]] = score;
        updatedBoardState.roundScores = updatedRoundScores;
        updatedBoardState.clovers = [...boardState.clovers];
        updatedBoardState.clovers[spectatorSeat!] = { ...spectatorClover, score };
        updatedBoardState.currentGuess = null;

        const roundResult: RoundResult = {
          spectatorSeat: spectatorSeat!,
          score,
          correctPlacements: results,
          guessPlacements: placements,
          guessRotations: rotations,
          actualCardIndices: [...spectatorClover.cardIndices],
          actualRotations: [...spectatorClover.rotations],
          attempt: guess.attempt as 1 | 2,
          acknowledged: [],
        };
        updatedBoardState.lastRoundResult = roundResult;
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from('games')
        .update({ board_state: updatedBoardState })
        .eq('id', id)
        .select('id')
        .single();

      if (updateError || !updatedRow) {
        console.error('Error updating game:', updateError);
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      await supabase.from('moves').insert({
        game_id: id,
        player_id: user.id,
        move_type: 'submit_guess',
        move_data: { placements, rotations, score },
      });

      return NextResponse.json({ success: true, score });
    }

    // ── acknowledge_result ────────────────────────────────────────────────
    if (moveType === 'acknowledge_result') {
      if (gameData.current_phase !== 'resolution') {
        return NextResponse.json({ error: 'Not in resolution phase' }, { status: 400 });
      }

      const result = boardState.lastRoundResult;
      if (!result) {
        return NextResponse.json({ error: 'No result to acknowledge' }, { status: 400 });
      }

      const acknowledged = new Set(result.acknowledged);
      acknowledged.add(seat);

      const totalPlayers = gameData.game_players?.length ?? 0;
      const allAcked = acknowledged.size >= totalPlayers;

      const updatedBoardState: SoCloverBoardState = { ...boardState };

      if (allAcked) {
        updatedBoardState.lastRoundResult = null;

        const updatedRoundScores = [...updatedBoardState.roundScores];
        if (allRoundsComplete({ ...updatedBoardState, roundScores: updatedRoundScores })) {
          const totalScore = computeTotalScore(updatedRoundScores);
          const maxScore = boardState.clovers.length * 6;
          updatedBoardState.currentGuess = null;

          const { data: updatedRow, error: updateError } = await supabase
            .from('games')
            .update({
              board_state: updatedBoardState,
              status: 'completed',
              result: totalScore >= Math.ceil(maxScore * 0.5) ? 'win' : 'loss',
              ended_at: new Date().toISOString(),
            })
            .eq('id', id)
            .select('id')
            .single();

          if (updateError || !updatedRow) {
            return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
          }

          return NextResponse.json({ success: true, gameComplete: true });
        } else {
          updatedBoardState.currentSpectatorIdx = boardState.currentSpectatorIdx + 1;
          const nextSpectator = updatedBoardState.spectatorOrder[updatedBoardState.currentSpectatorIdx];
          updatedBoardState.currentGuess = createFreshGuess(updatedBoardState, nextSpectator);
        }
      } else {
        updatedBoardState.lastRoundResult = {
          ...result,
          acknowledged: [...acknowledged],
        };
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from('games')
        .update({ board_state: updatedBoardState })
        .eq('id', id)
        .select('id')
        .single();

      if (updateError || !updatedRow) {
        return NextResponse.json({ error: 'Failed to update game' }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid move type' }, { status: 400 });
  } catch (error) {
    console.error('Error in POST /api/games/[id]/soclover-move:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

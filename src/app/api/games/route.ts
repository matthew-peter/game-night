import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getRandomWords } from '@/lib/game/words';
import { generateKeyCard } from '@/lib/game/keyGenerator';
import { generatePin } from '@/lib/utils/pin';
import { ClueStrictness, GameType } from '@/lib/supabase/types';
import { createScrabbleBoardState } from '@/lib/game/scrabble/logic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const gameType: GameType = body.gameType ?? 'codenames';
    const pin = generatePin();

    let gameInsert: Record<string, unknown>;

    if (gameType === 'scrabble') {
      const maxPlayers = Math.min(Math.max(body.maxPlayers ?? 2, 2), 4);
      const dictionaryMode = ['strict', 'friendly', 'off'].includes(body.dictionaryMode)
        ? body.dictionaryMode
        : 'friendly';
      const boardState = createScrabbleBoardState(maxPlayers, dictionaryMode);

      gameInsert = {
        game_type: 'scrabble',
        pin,
        status: 'waiting',
        current_turn: 0,
        current_phase: 'play',
        min_players: 2,
        max_players: maxPlayers,
        board_state: boardState,
        // Codenames-specific fields (nullable defaults)
        words: [],
        key_card: [],
        timer_tokens: 0,
        clue_strictness: 'basic',
        sudden_death: false,
      };
    } else {
      // Codenames (default)
      const timerTokens = body.timerTokens ?? 9;
      const clueStrictness: ClueStrictness = body.clueStrictness ?? 'strict';
      const words = getRandomWords(25);
      const keyCard = generateKeyCard();

      gameInsert = {
        game_type: 'codenames',
        words,
        key_card: keyCard,
        pin,
        timer_tokens: timerTokens,
        clue_strictness: clueStrictness,
        status: 'waiting',
        current_turn: 0,
        current_phase: 'clue',
        min_players: 2,
        max_players: 2,
        board_state: {
          revealed: {},
          agents_found: [0, 0],
        },
      };
    }

    // Create the game
    const { data: game, error } = await supabase
      .from('games')
      .insert(gameInsert)
      .select()
      .single();

    if (error) {
      console.error('Error creating game:', error);
      return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
    }

    // Add the creator as seat 0
    const { error: playerError } = await supabase
      .from('game_players')
      .insert({
        game_id: game.id,
        user_id: user.id,
        seat: 0,
      });

    if (playerError) {
      console.error('Error adding player:', playerError);
      // Clean up the game if we couldn't add the player
      await supabase.from('games').delete().eq('id', game.id);
      return NextResponse.json({ error: 'Failed to create game' }, { status: 500 });
    }

    return NextResponse.json({ game });
  } catch (error) {
    console.error('Error in POST /api/games:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all game IDs where user is a player
    const { data: myGames } = await supabase
      .from('game_players')
      .select('game_id')
      .eq('user_id', user.id);

    if (!myGames || myGames.length === 0) {
      return NextResponse.json({ games: [] });
    }

    const gameIds = myGames.map(g => g.game_id);

    const { data: games, error } = await supabase
      .from('games')
      .select('*, game_players(*)')
      .in('id', gameIds)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching games:', error);
      return NextResponse.json({ error: 'Failed to fetch games' }, { status: 500 });
    }

    return NextResponse.json({ games });
  } catch (error) {
    console.error('Error in GET /api/games:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

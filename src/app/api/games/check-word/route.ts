import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isInDictionary } from '@/lib/game/scrabble/dictionary';
import { loadServerDictionary } from '@/lib/game/scrabble/dictionary-server';

/**
 * POST /api/games/check-word
 *
 * Check if a word is in the Scrabble dictionary.
 * Available to authenticated users.
 *
 * Body: { word: string }
 * Response: { word: string, valid: boolean }
 */
export async function POST(request: Request) {
  try {
    loadServerDictionary();

    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { word } = body;

    if (!word || typeof word !== 'string') {
      return NextResponse.json({ error: 'No word provided' }, { status: 400 });
    }

    const cleaned = word.trim().toUpperCase();

    if (cleaned.length < 2 || cleaned.length > 15) {
      return NextResponse.json({
        word: cleaned,
        valid: false,
        reason: 'Word must be 2-15 letters',
      });
    }

    if (!/^[A-Z]+$/.test(cleaned)) {
      return NextResponse.json({
        word: cleaned,
        valid: false,
        reason: 'Word must contain only letters',
      });
    }

    const valid = isInDictionary(cleaned);

    return NextResponse.json({
      word: cleaned,
      valid,
    });
  } catch (error) {
    console.error('Error in POST /api/games/check-word:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

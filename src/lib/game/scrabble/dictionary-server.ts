// ============================================================================
// Server-only dictionary loader
//
// This file uses Node.js fs/path and MUST only be imported from server code
// (API routes, server components, server actions).
//
// Call loadServerDictionary() early in any API route that needs word validation.
// The dictionary is cached for the lifetime of the process.
// ============================================================================

import { readFileSync } from 'fs';
import { join } from 'path';
import { setServerDictionary, TWO_LETTER_WORDS } from './dictionary';

let _loaded = false;

/**
 * Load the full Scrabble dictionary from data/scrabble-dictionary.txt.
 * Safe to call multiple times — loads only on the first call.
 */
export function loadServerDictionary(): void {
  if (_loaded) return;
  _loaded = true;

  try {
    const filePath = join(process.cwd(), 'data', 'scrabble-dictionary.txt');
    const content = readFileSync(filePath, 'utf8');
    const words = content.split('\n').filter((w: string) => w.length >= 2);

    const dict = new Set(words);

    // Ensure all standard 2-letter words are included
    for (const w of TWO_LETTER_WORDS) {
      dict.add(w);
    }

    console.log(`[Dictionary] Loaded ${dict.size} words`);
    setServerDictionary(dict);
  } catch (err) {
    console.warn('[Dictionary] Could not load dictionary file:', err);
    // Fall back to 2-letter words only
    setServerDictionary(new Set(TWO_LETTER_WORDS));
  }
}

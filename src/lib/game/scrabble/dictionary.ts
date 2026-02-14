// ============================================================================
// Scrabble dictionary / word validation
//
// This module is safe for both client and server bundles.
// The full dictionary is loaded server-side only, via loadServerDictionary().
//
// Supports three modes:
// - strict:   rejects invalid words during play
// - friendly: accepts all words, but provides lookup for players
// - off:      no validation at all
// ============================================================================

import { DictionaryMode } from './types';

// All valid 2-letter Scrabble words (TWL06 / OSPD5 standard)
const TWO_LETTER_WORDS = new Set([
  'AA', 'AB', 'AD', 'AE', 'AG', 'AH', 'AI', 'AL', 'AM', 'AN',
  'AR', 'AS', 'AT', 'AW', 'AX', 'AY',
  'BA', 'BE', 'BI', 'BO', 'BY',
  'DA', 'DE', 'DO',
  'ED', 'EF', 'EH', 'EL', 'EM', 'EN', 'ER', 'ES', 'ET', 'EW', 'EX',
  'FA', 'FE',
  'GI', 'GO',
  'HA', 'HE', 'HI', 'HM', 'HO',
  'ID', 'IF', 'IN', 'IS', 'IT',
  'JO',
  'KA', 'KI',
  'LA', 'LI', 'LO',
  'MA', 'ME', 'MI', 'MM', 'MO', 'MU', 'MY',
  'NA', 'NE', 'NO', 'NU',
  'OD', 'OE', 'OF', 'OH', 'OI', 'OK', 'OM', 'ON', 'OP', 'OR', 'OS', 'OU', 'OW', 'OX', 'OY',
  'PA', 'PE', 'PI', 'PO',
  'QI',
  'RE',
  'SH', 'SI', 'SO',
  'TA', 'TI', 'TO',
  'UH', 'UM', 'UN', 'UP', 'US', 'UT',
  'WE', 'WO',
  'XI', 'XU',
  'YA', 'YE', 'YO',
  'ZA',
]);

/**
 * The server-side full dictionary. Set via setServerDictionary().
 * On the client, this stays null and we fall back to the 2-letter list.
 */
let _serverDictionary: Set<string> | null = null;

/** Called by server-only code to inject the full dictionary. */
export function setServerDictionary(dict: Set<string>): void {
  _serverDictionary = dict;
}

/** Get the current dictionary (full if on server, 2-letter list if on client). */
function getDictionary(): Set<string> {
  return _serverDictionary ?? TWO_LETTER_WORDS;
}

/**
 * Check if a word is in the dictionary.
 * Uses the full dictionary on server, 2-letter list on client.
 */
export function isInDictionary(word: string): boolean {
  if (!word || word.length < 2 || word.length > 15) return false;
  const upper = word.toUpperCase();
  if (!/^[A-Z]+$/.test(upper)) return false;

  const dict = getDictionary();
  return dict.has(upper);
}

/**
 * Validate a word based on the dictionary mode.
 *
 * - strict:   must be in dictionary
 * - friendly: always returns true (validation is informational only)
 * - off:      always returns true
 */
export function isValidWord(word: string, mode: DictionaryMode = 'strict'): boolean {
  if (!word || word.length < 2 || word.length > 15) return false;
  const upper = word.toUpperCase();
  if (!/^[A-Z]+$/.test(upper)) return false;

  if (mode === 'off' || mode === 'friendly') return true;

  return isInDictionary(upper);
}

/** Get count of words in the dictionary (for diagnostics). */
export function getDictionarySize(): number {
  return getDictionary().size;
}

/** The 2-letter word set, exported for reuse. */
export { TWO_LETTER_WORDS };

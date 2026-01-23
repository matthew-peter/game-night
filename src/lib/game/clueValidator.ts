import { ClueStrictness } from '@/lib/supabase/types';

/**
 * Validates if a clue is allowed based on the words on the board
 */
export function validateClue(
  clue: string,
  boardWords: string[],
  strictness: ClueStrictness
): { valid: boolean; reason?: string } {
  const normalizedClue = clue.toUpperCase().trim();
  const normalizedWords = boardWords.map(w => w.toUpperCase());
  
  // Empty clue is never valid
  if (!normalizedClue) {
    return { valid: false, reason: 'Clue cannot be empty' };
  }
  
  // Must be a single word (no spaces)
  if (normalizedClue.includes(' ')) {
    return { valid: false, reason: 'Clue must be a single word' };
  }
  
  // Check if clue is exactly a word on the board
  if (normalizedWords.includes(normalizedClue)) {
    return { valid: false, reason: `"${clue}" is a word on the board` };
  }
  
  if (strictness === 'basic') {
    return { valid: true };
  }
  
  // Strict: clue cannot be a substring of any word, and no word can be a substring of clue
  if (strictness === 'strict' || strictness === 'very_strict') {
    for (const word of normalizedWords) {
      // Check if clue is part of a board word
      if (word.includes(normalizedClue)) {
        return { 
          valid: false, 
          reason: `"${clue}" is part of "${word}" on the board` 
        };
      }
      // Check if a board word is part of the clue
      if (normalizedClue.includes(word)) {
        return { 
          valid: false, 
          reason: `"${word}" from the board is part of your clue` 
        };
      }
    }
  }
  
  // Very strict: also check stemming (basic implementation)
  if (strictness === 'very_strict') {
    for (const word of normalizedWords) {
      const clueRoot = getWordRoot(normalizedClue);
      const wordRoot = getWordRoot(word);
      
      if (clueRoot === wordRoot) {
        return { 
          valid: false, 
          reason: `"${clue}" shares a root with "${word}" on the board` 
        };
      }
    }
  }
  
  return { valid: true };
}

/**
 * Basic word stemming - removes common suffixes
 */
function getWordRoot(word: string): string {
  const suffixes = ['ING', 'ED', 'ER', 'EST', 'LY', 'TION', 'SION', 'NESS', 'MENT', 'ABLE', 'IBLE', 'S', 'ES'];
  let root = word.toUpperCase();
  
  for (const suffix of suffixes) {
    if (root.endsWith(suffix) && root.length > suffix.length + 2) {
      root = root.slice(0, -suffix.length);
      break;
    }
  }
  
  return root;
}

/**
 * Get words that would be invalid for a clue based on strictness
 */
export function getInvalidClueWords(
  boardWords: string[],
  strictness: ClueStrictness
): Set<string> {
  const invalid = new Set<string>();
  
  for (const word of boardWords) {
    invalid.add(word.toUpperCase());
    
    if (strictness === 'strict' || strictness === 'very_strict') {
      // Add common variations
      invalid.add(word.toUpperCase() + 'S');
      invalid.add(word.toUpperCase() + 'ED');
      invalid.add(word.toUpperCase() + 'ING');
      invalid.add(word.toUpperCase() + 'ER');
    }
  }
  
  return invalid;
}

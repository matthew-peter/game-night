'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Definition {
  word: string;
  phonetic?: string;
  source?: string;
  derivedFrom?: string; // e.g. "baseballish → baseball"
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
    }[];
  }[];
}

interface WordDefinitionProps {
  word: string;
  onClose: () => void;
}

// ── Suffix / morphology helpers ──────────────────────────────────────────

/** Common English suffixes ordered from longest to shortest for greedy matching */
const SUFFIXES = [
  'esque', 'tion', 'sion', 'ment', 'ness', 'able', 'ible', 'less',
  'ious', 'eous', 'ical', 'ally', 'ling', 'ated', 'like', 'wise',
  'ward', 'ful', 'ish', 'ous', 'ive', 'ant', 'ent', 'ing', 'est',
  'ery', 'ism', 'ist', 'ity', 'ize', 'ise', 'ate', 'ify', 'dom',
  'ial', 'ian', 'ual', 'ory', 'ary', 'age', 'ed', 'er', 'ly',
  'al', 'en', 'ty', 'ey', 'ie', 'le', 'es', 'y', 's',
];

/**
 * Generate candidate base words by stripping common English suffixes.
 * Returns candidates from most stripped to least, including the original.
 * Only returns candidates with at least 3 characters.
 */
function generateBaseWords(word: string): string[] {
  const lower = word.toLowerCase();
  const candidates: string[] = [];

  for (const suffix of SUFFIXES) {
    if (lower.endsWith(suffix) && lower.length > suffix.length + 2) {
      const base = lower.slice(0, -suffix.length);
      if (base.length >= 3 && !candidates.includes(base)) {
        candidates.push(base);
      }
      // Also try with common letter doublings removed (e.g. "running" → "run")
      if (base.length >= 4 && base[base.length - 1] === base[base.length - 2]) {
        const dedoubled = base.slice(0, -1);
        if (dedoubled.length >= 3 && !candidates.includes(dedoubled)) {
          candidates.push(dedoubled);
        }
      }
      // Try adding back 'e' (e.g. "making" → "mak" → "make")
      const withE = base + 'e';
      if (!candidates.includes(withE)) {
        candidates.push(withE);
      }
    }
  }

  return candidates;
}

/**
 * Try to split a compound word into recognizable parts.
 * e.g. "baseball" → ["base", "ball"], "snowman" → ["snow", "man"]
 * Returns null if no good split found.
 */
function trySplitCompound(word: string): [string, string] | null {
  const lower = word.toLowerCase();
  if (lower.length < 5) return null;

  // Common word parts that appear in compounds
  const commonParts = new Set([
    'air', 'back', 'ball', 'band', 'base', 'bath', 'bed', 'bird', 'black',
    'blood', 'blue', 'board', 'boat', 'bone', 'book', 'born', 'box', 'bread',
    'break', 'brown', 'burn', 'camp', 'card', 'cat', 'chain', 'child', 'cloud',
    'coat', 'cold', 'cook', 'corn', 'cow', 'cup', 'cut', 'dark', 'day', 'dead',
    'dog', 'door', 'down', 'dragon', 'dream', 'drop', 'dust', 'ear', 'earth',
    'egg', 'eye', 'face', 'fall', 'farm', 'field', 'fire', 'fish', 'flag',
    'floor', 'flower', 'fly', 'foot', 'forest', 'fox', 'free', 'front', 'fruit',
    'game', 'gate', 'god', 'gold', 'good', 'grand', 'grass', 'green', 'ground',
    'gun', 'hair', 'half', 'hand', 'hat', 'head', 'heart', 'high', 'hill',
    'hole', 'home', 'honey', 'hook', 'horn', 'horse', 'hot', 'house', 'ice',
    'iron', 'jack', 'jaw', 'key', 'king', 'knee', 'knife', 'land', 'law',
    'lead', 'left', 'life', 'light', 'line', 'lion', 'log', 'long', 'lord',
    'love', 'low', 'luck', 'mail', 'man', 'mark', 'master', 'match', 'men',
    'mid', 'milk', 'mind', 'moon', 'mother', 'mountain', 'mouth', 'mud',
    'neck', 'net', 'new', 'night', 'nose', 'nut', 'oil', 'old', 'out', 'over',
    'pack', 'pan', 'park', 'path', 'pen', 'pig', 'pin', 'pipe', 'pit', 'play',
    'point', 'pool', 'pop', 'port', 'post', 'pot', 'power', 'print', 'rain',
    'red', 'ring', 'road', 'rock', 'room', 'root', 'rose', 'round', 'run',
    'sail', 'salt', 'sand', 'sea', 'seed', 'self', 'set', 'ship', 'shoe',
    'shop', 'shore', 'short', 'shot', 'side', 'silver', 'sky', 'sleep', 'smoke',
    'snake', 'snow', 'song', 'south', 'space', 'speed', 'spider', 'spring',
    'stand', 'star', 'step', 'stick', 'stock', 'stone', 'stop', 'storm', 'string',
    'strong', 'sugar', 'summer', 'sun', 'super', 'sweet', 'sword', 'table',
    'tail', 'tall', 'tea', 'thunder', 'time', 'top', 'tower', 'town', 'tree',
    'under', 'up', 'wall', 'war', 'water', 'way', 'weather', 'web', 'well',
    'west', 'wheel', 'white', 'wild', 'wind', 'winter', 'wolf', 'woman', 'wood',
    'work', 'worm', 'yard',
  ]);

  // Try splitting at each position
  for (let i = 3; i <= lower.length - 3; i++) {
    const left = lower.slice(0, i);
    const right = lower.slice(i);
    if (commonParts.has(left) && commonParts.has(right)) {
      return [left, right];
    }
  }

  return null;
}

// ── API lookup functions ─────────────────────────────────────────────────

/** Try Free Dictionary API */
async function tryFreeDictionary(word: string): Promise<Definition | null> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data && data.length > 0) {
      const allMeanings: Definition['meanings'] = [];

      for (const entry of data) {
        for (const meaning of entry.meanings || []) {
          const existing = allMeanings.find(
            (m) => m.partOfSpeech === meaning.partOfSpeech
          );
          if (existing) {
            existing.definitions.push(
              ...meaning.definitions.slice(0, 4)
            );
          } else {
            allMeanings.push({
              partOfSpeech: meaning.partOfSpeech,
              definitions: meaning.definitions.slice(0, 4),
            });
          }
        }
      }

      return {
        word: data[0].word,
        phonetic:
          data[0].phonetic ||
          data.find((e: { phonetic?: string }) => e.phonetic)?.phonetic,
        source: 'Dictionary',
        meanings: allMeanings,
      };
    }
  } catch {
    // Fall through to next source
  }
  return null;
}

/** Try Wikipedia API for proper nouns, places, etc. */
async function tryWikipedia(word: string): Promise<Definition | null> {
  try {
    const searchResponse = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(word)}`
    );

    if (!searchResponse.ok) return null;

    const data = await searchResponse.json();

    if (data && data.extract && data.type !== 'disambiguation') {
      const sentences = data.extract.split('. ').slice(0, 3).join('. ');
      const description = data.description || 'proper noun';

      return {
        word: data.title || word,
        source: 'Wikipedia',
        meanings: [
          {
            partOfSpeech: description,
            definitions: [
              {
                definition:
                  sentences + (sentences.endsWith('.') ? '' : '.'),
              },
            ],
          },
        ],
      };
    }
  } catch {
    // Fall through
  }
  return null;
}

/** Try Datamuse API for related words / "sounds like" / "means like" */
async function tryDatamuse(word: string): Promise<Definition | null> {
  try {
    // "means like" query - finds words with similar meaning
    const response = await fetch(
      `https://api.datamuse.com/words?ml=${encodeURIComponent(word.toLowerCase())}&max=5&md=d`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data && data.length > 0) {
      const definitions: { definition: string; example?: string }[] = [];

      for (const entry of data.slice(0, 3)) {
        if (entry.defs && entry.defs.length > 0) {
          for (const def of entry.defs.slice(0, 2)) {
            // Datamuse defs are formatted as "pos\tdefinition"
            const parts = def.split('\t');
            const defText = parts.length > 1 ? parts[1] : parts[0];
            definitions.push({
              definition: `${entry.word}: ${defText}`,
            });
          }
        }
      }

      if (definitions.length > 0) {
        return {
          word: word,
          source: 'Related Words',
          meanings: [
            {
              partOfSpeech: 'related terms',
              definitions,
            },
          ],
        };
      }
    }
  } catch {
    // Fall through
  }
  return null;
}

/**
 * Main lookup orchestrator. Tries multiple strategies:
 * 1. Exact word in Free Dictionary
 * 2. Exact word in Wikipedia
 * 3. Strip suffixes and try base words in Free Dictionary
 * 4. Split compound words and look up parts
 * 5. Datamuse for related words
 */
async function lookupWord(word: string): Promise<Definition | null> {
  // Strategy 1: Exact match in dictionary
  const exact = await tryFreeDictionary(word);
  if (exact) return exact;

  // Strategy 2: Wikipedia (great for proper nouns, places, etc.)
  const wiki = await tryWikipedia(word);
  if (wiki) return wiki;

  // Strategy 3: Strip suffixes and try base words
  const baseWords = generateBaseWords(word);
  for (const base of baseWords) {
    const baseDef = await tryFreeDictionary(base);
    if (baseDef) {
      baseDef.derivedFrom = `${word.toLowerCase()} → ${base}`;
      return baseDef;
    }
  }

  // Strategy 4: Compound word splitting
  const compound = trySplitCompound(word);
  if (compound) {
    const [left, right] = compound;
    const [leftDef, rightDef] = await Promise.all([
      tryFreeDictionary(left),
      tryFreeDictionary(right),
    ]);

    if (leftDef || rightDef) {
      const meanings: Definition['meanings'] = [];
      if (leftDef) {
        for (const m of leftDef.meanings.slice(0, 2)) {
          meanings.push({
            partOfSpeech: `"${left}" — ${m.partOfSpeech}`,
            definitions: m.definitions.slice(0, 2),
          });
        }
      }
      if (rightDef) {
        for (const m of rightDef.meanings.slice(0, 2)) {
          meanings.push({
            partOfSpeech: `"${right}" — ${m.partOfSpeech}`,
            definitions: m.definitions.slice(0, 2),
          });
        }
      }

      return {
        word: word,
        derivedFrom: `Compound: ${left} + ${right}`,
        source: 'Dictionary',
        meanings,
      };
    }
  }

  // Strategy 5: Datamuse related words
  const related = await tryDatamuse(word);
  if (related) return related;

  // Also try base words in Datamuse
  for (const base of baseWords.slice(0, 2)) {
    const baseRelated = await tryDatamuse(base);
    if (baseRelated) {
      baseRelated.derivedFrom = `${word.toLowerCase()} → ${base}`;
      return baseRelated;
    }
  }

  return null;
}

// ── Component ────────────────────────────────────────────────────────────

export function WordDefinition({ word, onClose }: WordDefinitionProps) {
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDefinition = async () => {
      const result = await lookupWord(word);

      if (cancelled) return;

      if (result) {
        setDefinition(result);
      } else {
        setError('No definition found — try asking your teammate!');
      }

      setLoading(false);
    };

    fetchDefinition();

    return () => {
      cancelled = true;
    };
  }, [word]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-2xl max-h-[70vh] flex flex-col animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - fixed */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-xl font-bold uppercase">{word}</h2>
            <div className="flex items-center gap-2 flex-wrap">
              {definition?.phonetic && (
                <span className="text-sm text-stone-500">
                  {definition.phonetic}
                </span>
              )}
              {definition?.source && (
                <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded">
                  via {definition.source}
                </span>
              )}
              {definition?.derivedFrom && (
                <span className="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                  {definition.derivedFrom}
                </span>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-4 pb-6">
          {loading && (
            <div className="py-8 text-center text-stone-500">
              Looking up definition...
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-stone-500">{error}</div>
          )}

          {definition && (
            <div className="space-y-4">
              {definition.meanings.map((meaning, idx) => (
                <div key={idx}>
                  <h3 className="text-sm font-semibold text-green-600 italic mb-1">
                    {meaning.partOfSpeech}
                  </h3>
                  <ul className="space-y-2 list-decimal list-inside">
                    {meaning.definitions.map((def, defIdx) => (
                      <li key={defIdx} className="text-sm text-stone-700">
                        <span>{def.definition}</span>
                        {def.example && (
                          <p className="text-stone-500 italic mt-1 ml-4">
                            &ldquo;{def.example}&rdquo;
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer - fixed */}
        <div className="p-4 border-t bg-white rounded-b-2xl">
          <Button
            onClick={onClose}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

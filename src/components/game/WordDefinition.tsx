'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface Definition {
  word: string;
  phonetic?: string;
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

export function WordDefinition({ word, onClose }: WordDefinitionProps) {
  const [definition, setDefinition] = useState<Definition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDefinition = async () => {
      try {
        const response = await fetch(
          `https://api.dictionaryapi.dev/api/v2/entries/en/${word.toLowerCase()}`
        );
        
        if (!response.ok) {
          throw new Error('Word not found');
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
          // Combine meanings from all entries (some words have multiple entries)
          const allMeanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[] }[] = [];
          
          for (const entry of data) {
            for (const meaning of entry.meanings || []) {
              // Check if we already have this part of speech
              const existing = allMeanings.find(m => m.partOfSpeech === meaning.partOfSpeech);
              if (existing) {
                // Add definitions to existing
                existing.definitions.push(...meaning.definitions.slice(0, 4));
              } else {
                // Add new part of speech
                allMeanings.push({
                  partOfSpeech: meaning.partOfSpeech,
                  definitions: meaning.definitions.slice(0, 4),
                });
              }
            }
          }
          
          setDefinition({
            word: data[0].word,
            phonetic: data[0].phonetic || data.find((e: { phonetic?: string }) => e.phonetic)?.phonetic,
            meanings: allMeanings,
          });
        }
      } catch (err) {
        setError('Definition not available');
      } finally {
        setLoading(false);
      }
    };

    fetchDefinition();
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
            {definition?.phonetic && (
              <p className="text-sm text-stone-500">{definition.phonetic}</p>
            )}
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
            Loading definition...
          </div>
        )}

        {error && (
          <div className="py-8 text-center text-stone-500">
            {error}
          </div>
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

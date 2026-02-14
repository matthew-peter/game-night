'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WordCheckerProps {
  open: boolean;
  onClose: () => void;
}

interface CheckResult {
  word: string;
  valid: boolean;
}

export function WordChecker({ open, onClose }: WordCheckerProps) {
  const [query, setQuery] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [results, setResults] = useState<CheckResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // Small delay so the dialog animation finishes first
      const t = setTimeout(() => inputRef.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [open]);

  const checkWord = useCallback(async () => {
    const word = query.trim().toUpperCase();
    if (!word || word.length < 2) return;

    setIsChecking(true);
    try {
      const res = await fetch('/api/games/check-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word }),
      });

      const data = await res.json();

      setResults(prev => {
        // Dedupe
        if (prev.some(r => r.word === word)) return prev;
        return [{ word, valid: data.valid }, ...prev].slice(0, 20);
      });
    } catch {
      // Network error — just skip
    } finally {
      setIsChecking(false);
      setQuery('');
    }
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        checkWord();
      }
    },
    [checkWord]
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Word Checker
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Input */}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 15))}
              onKeyDown={handleKeyDown}
              placeholder="Type a word..."
              className="flex-1 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-white text-sm rounded-lg px-3 py-2
                         placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-blue-400/50
                         border border-stone-300 dark:border-stone-600 font-mono tracking-wider"
              style={{ fontSize: '16px' }}
              maxLength={15}
              autoComplete="off"
            />
            <button
              onClick={checkWord}
              disabled={query.trim().length < 2 || isChecking}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
              )}
            >
              {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Check'}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-1 max-h-[200px] overflow-y-auto">
              {results.map((result, i) => (
                <div
                  key={`${result.word}-${i}`}
                  className={cn(
                    'flex items-center justify-between px-3 py-1.5 rounded-lg text-sm',
                    result.valid
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                      : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  )}
                >
                  <span className="font-mono font-semibold tracking-wider">{result.word}</span>
                  {result.valid ? (
                    <span className="flex items-center gap-1 text-xs">
                      <Check className="w-3.5 h-3.5" /> Valid
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs">
                      <X className="w-3.5 h-3.5" /> Not found
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {results.length === 0 && (
            <p className="text-xs text-stone-400 text-center py-2">
              Look up any word to see if it&apos;s in the dictionary.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

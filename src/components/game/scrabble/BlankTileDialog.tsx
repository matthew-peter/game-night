'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface BlankTileDialogProps {
  open: boolean;
  onSelect: (letter: string) => void;
  onCancel: () => void;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export function BlankTileDialog({ open, onSelect, onCancel }: BlankTileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Choose a letter for blank tile</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-7 gap-1 py-2">
          {LETTERS.map((letter) => (
            <button
              key={letter}
              onClick={() => onSelect(letter)}
              className="w-9 h-9 flex items-center justify-center rounded bg-amber-100 border border-amber-300 font-bold text-stone-800 hover:bg-amber-200 active:scale-95 transition-all"
            >
              {letter}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

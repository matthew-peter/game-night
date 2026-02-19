'use client';

import { KeywordCard } from './KeywordCard';

interface CardTrayProps {
  cards: [string, string][];
  cardIndices: number[];
  placedIndices: (number | null)[];
  onDragStart: (cardIndex: number) => void;
}

export function CardTray({ cards, cardIndices, placedIndices, onDragStart }: CardTrayProps) {
  const placedSet = new Set(placedIndices.filter((i): i is number => i !== null));

  const availableCards = cardIndices.filter((idx) => !placedSet.has(idx));

  return (
    <div className="flex flex-col items-center gap-2 py-3 px-2">
      <span className="text-xs text-emerald-300/70 uppercase tracking-widest font-medium">
        Available Cards ({availableCards.length})
      </span>
      <div className="flex flex-wrap justify-center gap-2">
        {availableCards.map((cardIdx) => (
          <KeywordCard
            key={cardIdx}
            words={cards[cardIdx]}
            orientation={true}
            draggable
            onDragStart={() => onDragStart(cardIdx)}
          />
        ))}
        {availableCards.length === 0 && (
          <p className="text-sm text-stone-500 italic">All cards placed</p>
        )}
      </div>
    </div>
  );
}

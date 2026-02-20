'use client';

import { KeywordCard } from './KeywordCard';
import { KeywordCardWords } from '@/lib/game/soclover/types';

interface CardTrayProps {
  cards: KeywordCardWords[];
  cardIndices: number[];
  placedIndices: (number | null)[];
  selectedCard: number | null;
  onSelectCard: (cardIndex: number | null) => void;
}

export function CardTray({
  cards,
  cardIndices,
  placedIndices,
  selectedCard,
  onSelectCard,
}: CardTrayProps) {
  const placedSet = new Set(placedIndices.filter((i): i is number => i !== null));
  const availableCards = cardIndices.filter((idx) => !placedSet.has(idx));

  return (
    <div className="flex flex-col items-center gap-2 py-2 px-2">
      <span className="text-[0.65rem] text-emerald-200/60 uppercase tracking-widest font-medium">
        Tap a card, then tap a slot
      </span>
      <div className="flex flex-wrap justify-center gap-2">
        {availableCards.map((cardIdx) => (
          <KeywordCard
            key={cardIdx}
            words={cards[cardIdx]}
            rotation={0}
            selected={selectedCard === cardIdx}
            onSelect={() =>
              onSelectCard(selectedCard === cardIdx ? null : cardIdx)
            }
            size="sm"
          />
        ))}
        {availableCards.length === 0 && (
          <p className="text-xs text-stone-500 italic">All cards placed</p>
        )}
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const REACTIONS = ['👏', '🧠', '😅', '🔥', '😭', '🤞', '❤️', '🎉', '😱', '🤔', '👀', '💀', '🙈', '😤', '🥳'];

interface ReactionsProps {
  gameId: string;
  playerId: string;
  compact?: boolean;
}

interface IncomingReaction {
  emoji: string;
  id: string;
}

export function Reactions({ gameId, playerId, compact = false }: ReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [incomingReactions, setIncomingReactions] = useState<IncomingReaction[]>([]);
  const [sendingEmoji, setSendingEmoji] = useState<string | null>(null);
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Subscribe to reactions
  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${gameId}`)
      .on('broadcast', { event: 'reaction' }, (payload) => {
        // Only show reactions from the other player
        if (payload.payload.senderId !== playerId) {
          const reactionId = `${Date.now()}-${Math.random()}`;
          setIncomingReactions(prev => [...prev, {
            emoji: payload.payload.emoji,
            id: reactionId
          }]);

          // Remove after animation
          setTimeout(() => {
            setIncomingReactions(prev => prev.filter(r => r.id !== reactionId));
          }, 2500);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [gameId, playerId, supabase]);

  const sendReaction = useCallback(async (emoji: string) => {
    setSendingEmoji(emoji);
    setIsOpen(false);

    if (channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { emoji, senderId: playerId }
      });
    }

    // Brief feedback then clear
    setTimeout(() => setSendingEmoji(null), 300);
  }, [playerId]);

  return (
    <>
      {/* Reaction trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'rounded-full flex items-center justify-center transition-all',
          compact 
            ? 'w-7 h-7 text-sm bg-stone-600 hover:bg-stone-500' 
            : 'w-10 h-10 text-xl bg-stone-700 hover:bg-stone-600',
          'active:scale-95',
          isOpen && 'ring-2 ring-amber-400'
        )}
      >
        {sendingEmoji || '😊'}
      </button>

      {/* Reaction picker */}
      {isOpen && (
        <div className={cn(
          "absolute right-0 bg-stone-800 rounded-xl p-2 shadow-xl border border-stone-600 grid grid-cols-5 gap-1 animate-in slide-in-from-top-2 duration-150 z-50",
          compact ? "top-9 w-48" : "top-12 w-56"
        )}>
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className={cn(
                "hover:bg-stone-700 rounded-lg active:scale-90 transition-transform flex items-center justify-center",
                compact ? "w-8 h-8 text-lg" : "w-10 h-10 text-xl"
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Incoming reactions display */}
      {incomingReactions.map((reaction) => (
        <div
          key={reaction.id}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50"
        >
          <div className="text-7xl animate-reaction">
            {reaction.emoji}
          </div>
        </div>
      ))}
    </>
  );
}

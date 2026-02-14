'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { createPortal } from 'react-dom';

const REACTIONS = [
  '👏', '🧠', '😅', '🔥', '😭',
  '🤞', '❤️', '🎉', '😱', '🤔',
  '👀', '💀', '🙈', '😤', '🥳',
];

interface ReactionsProps {
  gameId: string;
  playerId: string;
  compact?: boolean;
}

interface DisplayReaction {
  emoji: string;
  id: string;
  fromSelf: boolean;
}

export function Reactions({ gameId, playerId, compact = false }: ReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [displayReactions, setDisplayReactions] = useState<DisplayReaction[]>([]);
  const [lastSentEmoji, setLastSentEmoji] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  /** Show a reaction on screen (for both sender and receiver) */
  const showReaction = useCallback((emoji: string, fromSelf: boolean) => {
    const reactionId = `${Date.now()}-${Math.random()}`;
    setDisplayReactions((prev) => [...prev, { emoji, id: reactionId, fromSelf }]);

    // Remove after animation completes
    setTimeout(() => {
      setDisplayReactions((prev) => prev.filter((r) => r.id !== reactionId));
    }, 2500);
  }, []);

  // Subscribe to reactions from the other player
  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${gameId}`)
      .on('broadcast', { event: 'reaction' }, (payload) => {
        // Only show reactions from the other player here —
        // the sender already sees their own via the local call in sendReaction
        if (payload.payload.senderId !== playerId) {
          showReaction(payload.payload.emoji, false);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [gameId, playerId, supabase, showReaction]);

  const sendReaction = useCallback(
    async (emoji: string) => {
      setLastSentEmoji(emoji);
      setIsOpen(false);

      // Show it locally so the sender sees their own reaction immediately
      showReaction(emoji, true);

      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'reaction',
          payload: { emoji, senderId: playerId },
        });
      }

      // Brief feedback on the button then clear
      setTimeout(() => setLastSentEmoji(null), 800);
    },
    [playerId, showReaction]
  );

  return (
    <>
      {/* Reaction trigger button */}
      <button
        ref={buttonRef}
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
        {lastSentEmoji || '😊'}
      </button>

      {/* Reaction picker — portal with backdrop so tapping elsewhere closes it */}
      {isOpen &&
        mounted &&
        createPortal(
          <>
            {/* Invisible backdrop to close picker on outside tap */}
            <div
              className="fixed inset-0 z-[98]"
              onClick={() => setIsOpen(false)}
            />
            <div
              className={cn(
                'fixed bg-stone-800 rounded-xl p-2 shadow-xl border border-stone-600',
                'grid grid-cols-5 gap-1 animate-in slide-in-from-top-2 duration-150 z-[99]',
                compact ? 'w-48' : 'w-56'
              )}
              style={{
                top: buttonRef.current
                  ? buttonRef.current.getBoundingClientRect().bottom + 4
                  : 50,
                right: buttonRef.current
                  ? window.innerWidth -
                    buttonRef.current.getBoundingClientRect().right
                  : 12,
              }}
            >
              {REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className={cn(
                    'hover:bg-stone-700 rounded-lg active:scale-90 transition-transform flex items-center justify-center',
                    compact ? 'w-8 h-8 text-lg' : 'w-10 h-10 text-xl'
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}

      {/* ── Reaction display (center screen) ──────────────────────────── */}
      {/* Both sender and receiver see the emoji pop.
          - Received reactions: full size, centered
          - Sent reactions: slightly smaller, same position (shared moment) */}
      {mounted &&
        displayReactions.map((reaction) =>
          createPortal(
            <div
              key={reaction.id}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[97]"
            >
              <div
                className={cn(
                  'animate-reaction',
                  reaction.fromSelf ? 'text-6xl opacity-80' : 'text-7xl'
                )}
              >
                {reaction.emoji}
              </div>
            </div>,
            document.body
          )
        )}
    </>
  );
}

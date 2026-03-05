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

const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const showReaction = useCallback((emoji: string, fromSelf: boolean) => {
    const reactionId = `${Date.now()}-${Math.random()}`;
    setDisplayReactions((prev) => [...prev, { emoji, id: reactionId, fromSelf }]);
    setTimeout(() => {
      setDisplayReactions((prev) => prev.filter((r) => r.id !== reactionId));
    }, 2500);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`reactions-${gameId}`)
      .on('broadcast', { event: 'reaction' }, (payload) => {
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
      showReaction(emoji, true);

      if (channelRef.current) {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'reaction',
          payload: { emoji, senderId: playerId },
        });
      }

      setTimeout(() => setLastSentEmoji(null), 800);
    },
    [playerId, showReaction]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      const emojis = val.match(EMOJI_REGEX);
      if (emojis && emojis.length > 0) {
        sendReaction(emojis[emojis.length - 1]);
        e.target.value = '';
      }
    },
    [sendReaction]
  );

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  return (
    <>
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

      {isOpen &&
        mounted &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[98]"
              onClick={() => setIsOpen(false)}
            />
            <div
              className={cn(
                'fixed bg-stone-800 rounded-xl p-2 shadow-xl border border-stone-600',
                'animate-in slide-in-from-top-2 duration-150 z-[99]',
                'w-56'
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
              {/* Emoji grid */}
              <div className="grid grid-cols-5 gap-1 mb-2">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="w-9 h-9 text-xl hover:bg-stone-700 rounded-lg active:scale-90 transition-transform flex items-center justify-center"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Native emoji input for full keyboard access */}
              <input
                ref={inputRef}
                type="text"
                onChange={handleInputChange}
                placeholder="Or pick any emoji..."
                className="w-full bg-stone-700 text-white text-sm rounded-lg px-3 py-2
                           placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-amber-400/50
                           border border-stone-600"
                style={{ fontSize: '16px' }}
                autoComplete="off"
                autoCapitalize="off"
              />
            </div>
          </>,
          document.body
        )}

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

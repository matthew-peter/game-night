'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const REACTIONS = ['👏', '🧠', '😅', '🔥', '😭', '🤞', '❤️'];

interface ReactionsProps {
  gameId: string;
  playerId: string;
}

interface IncomingReaction {
  emoji: string;
  id: string;
}

export function Reactions({ gameId, playerId }: ReactionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [incomingReactions, setIncomingReactions] = useState<IncomingReaction[]>([]);
  const [sendingEmoji, setSendingEmoji] = useState<string | null>(null);
  const supabase = createClient();

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

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, playerId, supabase]);

  const sendReaction = useCallback(async (emoji: string) => {
    setSendingEmoji(emoji);
    setIsOpen(false);
    
    const channel = supabase.channel(`reactions-${gameId}`);
    await channel.send({
      type: 'broadcast',
      event: 'reaction',
      payload: { emoji, senderId: playerId }
    });
    
    // Brief feedback then clear
    setTimeout(() => setSendingEmoji(null), 300);
  }, [gameId, playerId, supabase]);

  return (
    <>
      {/* Reaction trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-xl',
          'bg-stone-700 hover:bg-stone-600 active:scale-95 transition-all',
          isOpen && 'bg-stone-600 ring-2 ring-amber-400'
        )}
      >
        {sendingEmoji || '😊'}
      </button>

      {/* Reaction picker */}
      {isOpen && (
        <div className="absolute bottom-14 left-0 bg-stone-800 rounded-xl p-2 shadow-xl border border-stone-600 flex gap-1 animate-in slide-in-from-bottom-2 duration-150">
          {REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="w-10 h-10 text-xl hover:bg-stone-700 rounded-lg active:scale-90 transition-transform"
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

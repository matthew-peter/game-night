'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

type PresenceState = 'idle' | 'thinking' | 'typing-clue' | 'selecting-words';

interface PresenceIndicatorProps {
  gameId: string;
  playerId: string;
  opponentName?: string;
  /** Whether the local player is currently the active one (giving clue or guessing) */
  isMyTurn: boolean;
  /** Current phase of the game */
  phase: 'clue' | 'guess';
  /** Whether the local player is the clue giver */
  isClueGiver: boolean;
}

export function PresenceIndicator({
  gameId,
  playerId,
  opponentName = 'Partner',
  isMyTurn,
  phase,
  isClueGiver,
}: PresenceIndicatorProps) {
  const [partnerState, setPartnerState] = useState<PresenceState>('idle');
  const [partnerOnline, setPartnerOnline] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastBroadcast = useRef<string>('');
  const activityTimeout = useRef<NodeJS.Timeout | null>(null);

  // Subscribe to partner's presence
  useEffect(() => {
    const channel = supabase
      .channel(`presence-${gameId}`)
      .on('broadcast', { event: 'presence' }, (payload) => {
        if (payload.payload.senderId !== playerId) {
          setPartnerState(payload.payload.state as PresenceState);
          setPartnerOnline(true);

          // Reset to idle after 8s without updates
          if (activityTimeout.current) clearTimeout(activityTimeout.current);
          activityTimeout.current = setTimeout(() => {
            setPartnerState('idle');
          }, 8000);
        }
      })
      .on('broadcast', { event: 'heartbeat' }, (payload) => {
        if (payload.payload.senderId !== playerId) {
          setPartnerOnline(true);
          if (activityTimeout.current) clearTimeout(activityTimeout.current);
          activityTimeout.current = setTimeout(() => {
            setPartnerOnline(false);
            setPartnerState('idle');
          }, 15000);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      if (activityTimeout.current) clearTimeout(activityTimeout.current);
      supabase.removeChannel(channel);
    };
  }, [gameId, playerId, supabase]);

  // Send heartbeat every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'heartbeat',
          payload: { senderId: playerId },
        });
      }
    }, 10000);

    // Send initial heartbeat
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'heartbeat',
        payload: { senderId: playerId },
      });
    }

    return () => clearInterval(interval);
  }, [playerId]);

  // Broadcast local presence state
  const broadcastPresence = useCallback(
    (state: PresenceState) => {
      if (channelRef.current && state !== lastBroadcast.current) {
        lastBroadcast.current = state;
        channelRef.current.send({
          type: 'broadcast',
          event: 'presence',
          payload: { state, senderId: playerId },
        });
      }
    },
    [playerId]
  );

  // Determine and broadcast local state based on game context
  useEffect(() => {
    if (isMyTurn) {
      if (isClueGiver && phase === 'clue') {
        broadcastPresence('thinking');
      } else if (!isClueGiver && phase === 'guess') {
        broadcastPresence('thinking');
      }
    } else {
      broadcastPresence('idle');
    }
  }, [isMyTurn, isClueGiver, phase, broadcastPresence]);

  // Expose a way for parent to signal typing
  // This is done via a global event approach
  useEffect(() => {
    const handleTyping = () => {
      broadcastPresence('typing-clue');
    };
    const handleSelectingWords = () => {
      broadcastPresence('selecting-words');
    };

    window.addEventListener('codenames:typing-clue', handleTyping);
    window.addEventListener('codenames:selecting-words', handleSelectingWords);

    return () => {
      window.removeEventListener('codenames:typing-clue', handleTyping);
      window.removeEventListener('codenames:selecting-words', handleSelectingWords);
    };
  }, [broadcastPresence]);

  // Don't show anything if it's my turn (I already know what I'm doing)
  // Only show partner's state when it's THEIR turn
  if (isMyTurn || !partnerOnline) return null;

  const getMessage = () => {
    switch (partnerState) {
      case 'typing-clue':
        return `${opponentName} is writing a clue`;
      case 'selecting-words':
        return `${opponentName} is selecting words`;
      case 'thinking':
        if (phase === 'clue') return `${opponentName} is thinking of a clue`;
        if (phase === 'guess') return `${opponentName} is deciding`;
        return `${opponentName} is thinking`;
      default:
        return null;
    }
  };

  const message = getMessage();
  if (!message) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 py-1 animate-thinking">
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-stone-400">{message}</span>
        <span className="flex gap-0.5">
          <span className="w-1 h-1 rounded-full bg-stone-400 thinking-dot-1" />
          <span className="w-1 h-1 rounded-full bg-stone-400 thinking-dot-2" />
          <span className="w-1 h-1 rounded-full bg-stone-400 thinking-dot-3" />
        </span>
      </div>
    </div>
  );
}

/**
 * Call these from ClueInput or GameBoard to broadcast presence events
 */
export function broadcastTypingClue() {
  window.dispatchEvent(new Event('codenames:typing-clue'));
}

export function broadcastSelectingWords() {
  window.dispatchEvent(new Event('codenames:selecting-words'));
}

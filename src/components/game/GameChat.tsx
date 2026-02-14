'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { MessageCircle, Send, X } from 'lucide-react';
import { createPortal } from 'react-dom';

/**
 * Max message length.  120 chars is plenty for quick in-game chat
 * without allowing walls of text that break the layout.
 */
const MAX_MESSAGE_LENGTH = 120;

/** How long the peek preview bubble stays visible (ms) */
const PEEK_DURATION = 4000;

interface ChatMessage {
  id: string;
  text: string;
  player_id: string;
  game_id: string;
  created_at: string;
}

/** A participant in the game (for display names and notifications) */
interface ChatPlayer {
  userId: string;
  name: string;
}

interface GameChatProps {
  gameId: string;
  playerId: string;
  playerName: string;
  /** All other players in the game (for multi-player support) */
  otherPlayers: ChatPlayer[];
  /** If only one opponent — backward compat with Codenames */
  opponentId?: string;
  opponentName?: string;
}

export function GameChat({
  gameId,
  playerId,
  playerName,
  otherPlayers,
  opponentId,
  opponentName,
}: GameChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const isOpenRef = useRef(isOpen);

  // Build a name lookup from all players
  const nameMap = useMemo(() => {
    const map = new Map<string, string>();
    map.set(playerId, 'You');
    for (const p of otherPlayers) {
      map.set(p.userId, p.name);
    }
    // Legacy: single opponent
    if (opponentId && opponentName) {
      map.set(opponentId, opponentName);
    }
    return map;
  }, [playerId, otherPlayers, opponentId, opponentName]);

  // ── Peek preview state ────────────────────────────────────────────────
  const [peekMessage, setPeekMessage] = useState<{ sender: string; text: string } | null>(null);
  const peekTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep ref in sync for use in subscription callbacks
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Load existing messages from DB ───────────────────────────────────
  useEffect(() => {
    const loadMessages = async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (data) setMessages(data);
      setLoaded(true);
    };

    loadMessages();
  }, [gameId, supabase]);

  // ── Subscribe to new messages via postgres realtime ──────────────────
  useEffect(() => {
    const channel = supabase
      .channel(`chat-db-${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          if (newMsg.player_id !== playerId && !isOpenRef.current) {
            setUnreadCount((prev) => prev + 1);
            const senderName = nameMap.get(newMsg.player_id) ?? 'Player';
            showPeek(senderName, newMsg.text);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, playerId, supabase, nameMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Peek preview logic ─────────────────────────────────────────────────
  const showPeek = useCallback((sender: string, text: string) => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    setPeekMessage({ sender, text });
    peekTimerRef.current = setTimeout(() => {
      setPeekMessage(null);
      peekTimerRef.current = null;
    }, PEEK_DURATION);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setPeekMessage(null);
      if (peekTimerRef.current) {
        clearTimeout(peekTimerRef.current);
        peekTimerRef.current = null;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) setUnreadCount(0);
  }, [isOpen]);

  // ── Visual viewport tracking for keyboard ──────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const vv = window.visualViewport;
    const el = chatPanelRef.current;
    if (!vv || !el) return;

    const update = () => {
      const offset = window.innerHeight - vv.height - vv.offsetTop;
      el.style.bottom = `${Math.max(0, offset)}px`;
      el.style.setProperty(
        '--chat-max-h',
        `${Math.min(400, vv.height * 0.65)}px`
      );
    };

    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();

    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [isOpen]);

  // ── Send message ──────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = message.trim();
    if (!text) return;

    const msgText = text.slice(0, MAX_MESSAGE_LENGTH);
    const optimisticId = crypto.randomUUID();
    const now = new Date().toISOString();

    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      game_id: gameId,
      player_id: playerId,
      text: msgText,
      created_at: now,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setMessage('');

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        game_id: gameId,
        player_id: playerId,
        text: msgText,
      })
      .select('id')
      .single();

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      return;
    }

    if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...m, id: data.id } : m))
      );
    }

    // Send push notification to all other players
    const recipients = otherPlayers.length > 0
      ? otherPlayers
      : opponentId ? [{ userId: opponentId, name: opponentName ?? 'Player' }] : [];

    for (const recipient of recipients) {
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId,
            userId: recipient.userId,
            message: `${playerName}: ${msgText}`,
            title: 'New Message',
          }),
        });
      } catch {
        // Notification failure is non-critical
      }
    }
  }, [message, gameId, playerId, playerName, otherPlayers, opponentId, opponentName, supabase]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  const getSenderName = (senderId: string) =>
    nameMap.get(senderId) ?? 'Player';

  const chatTitle = otherPlayers.length > 1 ? 'Game Chat' : `Chat with ${opponentName || otherPlayers[0]?.name || 'Player'}`;

  return (
    <>
      {/* ── Chat toggle button ──────────────────────────────────────────── */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'rounded-full flex items-center justify-center transition-all relative',
          'w-7 h-7 text-sm bg-stone-600 hover:bg-stone-500',
          'active:scale-95',
          isOpen && 'ring-2 ring-blue-400'
        )}
        aria-label="Toggle chat"
      >
        {isOpen ? (
          <X className="w-3.5 h-3.5 text-white" />
        ) : (
          <MessageCircle className="w-3.5 h-3.5 text-white" />
        )}
        {unreadCount > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Peek preview bubble ─────────────────────────────────────────── */}
      {peekMessage &&
        !isOpen &&
        mounted &&
        createPortal(
          <div
            className="fixed z-[98] pointer-events-none animate-chat-in"
            style={{
              top: buttonRef.current
                ? buttonRef.current.getBoundingClientRect().bottom + 6
                : 80,
              right: buttonRef.current
                ? window.innerWidth -
                  buttonRef.current.getBoundingClientRect().right
                : 12,
            }}
          >
            <div className="bg-stone-800 border border-stone-600 rounded-lg px-3 py-2 max-w-[200px] shadow-lg animate-chat-fade pointer-events-auto">
              <div className="text-[10px] text-stone-400 mb-0.5 font-medium">
                {peekMessage.sender}
              </div>
              <div className="text-xs text-white break-words leading-snug">
                {peekMessage.text}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ── Bottom sheet chat panel ─────────────────────────────────────── */}
      {isOpen &&
        mounted &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[99] bg-black/30"
              onClick={() => setIsOpen(false)}
            />

            <div
              ref={chatPanelRef}
              className="fixed left-0 right-0 bottom-0 z-[100] animate-chat-sheet-up"
            >
              <div
                className="mx-auto max-w-md bg-stone-800 rounded-t-2xl shadow-2xl border border-stone-600 border-b-0 flex flex-col"
                style={{
                  maxHeight: 'var(--chat-max-h, min(400px, 55vh))',
                }}
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-stone-700 flex items-center justify-between shrink-0">
                  <span className="text-sm font-semibold text-white">
                    {chatTitle}
                  </span>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 rounded-full bg-stone-700 hover:bg-stone-600 flex items-center justify-center transition-colors"
                    aria-label="Close chat"
                  >
                    <X className="w-4 h-4 text-stone-300" />
                  </button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[100px]">
                  {!loaded && (
                    <p className="text-xs text-stone-500 text-center py-6">
                      Loading...
                    </p>
                  )}
                  {loaded && messages.length === 0 && (
                    <p className="text-xs text-stone-500 text-center py-6">
                      No messages yet. Say hi!
                    </p>
                  )}
                  {messages.map((msg) => {
                    const isMe = msg.player_id === playerId;
                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          'animate-chat-in',
                          isMe ? 'text-right' : 'text-left'
                        )}
                      >
                        <span
                          className={cn(
                            'inline-block px-3 py-1.5 rounded-2xl text-sm max-w-[80%] break-words leading-relaxed',
                            isMe
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-stone-700 text-stone-100 rounded-bl-md'
                          )}
                        >
                          {msg.text}
                        </span>
                        <div className="text-[10px] text-stone-500 mt-0.5 px-1">
                          {getSenderName(msg.player_id)}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input bar */}
                <div className="px-3 py-3 border-t border-stone-700 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                  <div className="flex gap-2 items-center">
                    <input
                      ref={inputRef}
                      type="text"
                      value={message}
                      onChange={(e) =>
                        setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
                      }
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      className="flex-1 bg-stone-700 text-white text-sm rounded-xl px-4 py-2.5
                                 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-blue-400/50
                                 border border-stone-600"
                      style={{ fontSize: '16px' }}
                      maxLength={MAX_MESSAGE_LENGTH}
                      autoComplete="off"
                      enterKeyHint="send"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!message.trim()}
                      className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0',
                        message.trim()
                          ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                          : 'bg-stone-700 text-stone-500 cursor-not-allowed'
                      )}
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                  {message.length > MAX_MESSAGE_LENGTH - 20 && (
                    <span className="text-[10px] text-stone-500 mt-1 block text-right px-1">
                      {MAX_MESSAGE_LENGTH - message.length} left
                    </span>
                  )}
                </div>
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

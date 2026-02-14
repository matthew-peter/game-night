'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { MessageCircle, Send, X } from 'lucide-react';
import { createPortal } from 'react-dom';

const MAX_MESSAGE_LENGTH = 60;

interface ChatMessage {
  id: string;
  text: string;
  player_id: string;
  game_id: string;
  created_at: string;
}

interface GameChatProps {
  gameId: string;
  playerId: string;
  playerName: string;
  opponentId?: string;
  opponentName?: string;
}

export function GameChat({
  gameId,
  playerId,
  playerName,
  opponentId,
  opponentName = 'Partner',
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
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  const [mounted, setMounted] = useState(false);
  const isOpenRef = useRef(isOpen);

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

      if (data) {
        setMessages(data);
      }
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
            // Deduplicate (optimistic insert may already have it)
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });

          // Increment unread if chat is closed and message is from opponent
          if (newMsg.player_id !== playerId && !isOpenRef.current) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, playerId, supabase]);

  // Auto-scroll to bottom on new messages when panel is open
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Clear unread when opening chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      // Calculate panel position from button
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPanelPos({
          top: rect.bottom + 4,
          right: window.innerWidth - rect.right,
        });
      }
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = message.trim();
    if (!text) return;

    const msgText = text.slice(0, MAX_MESSAGE_LENGTH);
    const optimisticId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Optimistic local add
    const optimisticMsg: ChatMessage = {
      id: optimisticId,
      game_id: gameId,
      player_id: playerId,
      text: msgText,
      created_at: now,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setMessage('');

    // Insert into DB (realtime will deliver to both players)
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
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      return;
    }

    // Replace optimistic ID with real ID
    if (data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === optimisticId ? { ...m, id: data.id } : m))
      );
    }

    // Send push notification to opponent
    if (opponentId) {
      try {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameId,
            userId: opponentId,
            message: `${playerName}: ${msgText}`,
            title: 'New Message',
          }),
        });
      } catch {
        // Notification failure is non-critical
      }
    }

    inputRef.current?.focus({ preventScroll: true });
  }, [message, gameId, playerId, playerName, opponentId, supabase]);

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
    senderId === playerId ? 'You' : opponentName;

  return (
    <>
      {/* Chat toggle button */}
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

      {/* Chat panel — rendered as a portal with fixed positioning to avoid iOS scroll */}
      {isOpen &&
        mounted &&
        panelPos &&
        createPortal(
          <>
            {/* Backdrop to close */}
            <div
              className="fixed inset-0 z-[99]"
              onClick={() => setIsOpen(false)}
            />
            <div
              className="fixed w-64 bg-stone-800 rounded-xl shadow-xl border border-stone-600 z-[100] animate-in slide-in-from-top-2 duration-150 flex flex-col max-h-[280px]"
              style={{ top: panelPos.top, right: panelPos.right }}
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-stone-700 flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Chat</span>
                <span className="text-[10px] text-stone-400">
                  {MAX_MESSAGE_LENGTH} char limit
                </span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-[80px] max-h-[180px]">
                {!loaded && (
                  <p className="text-[10px] text-stone-500 text-center py-4">
                    Loading...
                  </p>
                )}
                {loaded && messages.length === 0 && (
                  <p className="text-[10px] text-stone-500 text-center py-4">
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
                          'inline-block px-2 py-1 rounded-lg text-xs max-w-[85%] break-words',
                          isMe
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-stone-700 text-stone-200 rounded-bl-sm'
                        )}
                      >
                        {msg.text}
                      </span>
                      <div className="text-[9px] text-stone-500 mt-0.5">
                        {getSenderName(msg.player_id)}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="px-2 py-2 border-t border-stone-700">
                <div className="flex gap-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    value={message}
                    onChange={(e) =>
                      setMessage(e.target.value.slice(0, MAX_MESSAGE_LENGTH))
                    }
                    onKeyDown={handleKeyDown}
                    onFocus={(e) => {
                      // Prevent iOS from scrolling the page when input is focused.
                      e.preventDefault();
                      e.target.focus({ preventScroll: true });
                    }}
                    placeholder="Type a message..."
                    className="flex-1 bg-stone-700 text-white text-xs rounded-lg px-2.5 py-1.5
                               placeholder:text-stone-400 outline-none focus:ring-1 focus:ring-blue-400
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
                      'w-7 h-7 rounded-lg flex items-center justify-center transition-all',
                      message.trim()
                        ? 'bg-blue-600 hover:bg-blue-500 text-white active:scale-95'
                        : 'bg-stone-700 text-stone-500 cursor-not-allowed'
                    )}
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
                {message.length > MAX_MESSAGE_LENGTH - 15 && (
                  <span className="text-[9px] text-stone-500 mt-0.5 block text-right">
                    {MAX_MESSAGE_LENGTH - message.length} left
                  </span>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
    </>
  );
}

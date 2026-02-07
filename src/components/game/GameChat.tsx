'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { MessageCircle, Send, X } from 'lucide-react';

const MAX_MESSAGE_LENGTH = 60;

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  timestamp: number;
}

interface GameChatProps {
  gameId: string;
  playerId: string;
  playerName: string;
  opponentName?: string;
}

export function GameChat({ gameId, playerId, playerName, opponentName = 'Partner' }: GameChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to chat messages
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${gameId}`)
      .on('broadcast', { event: 'chat' }, (payload) => {
        const msg: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          text: payload.payload.text,
          senderId: payload.payload.senderId,
          timestamp: payload.payload.timestamp,
        };

        setMessages(prev => [...prev.slice(-49), msg]); // Keep last 50 messages

        // If chat is closed and message is from opponent, increment unread
        if (payload.payload.senderId !== playerId) {
          setUnreadCount(prev => prev + 1);
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [gameId, playerId, supabase]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Clear unread when opening chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const text = message.trim();
    if (!text || !channelRef.current) return;

    const chatMsg = {
      text: text.slice(0, MAX_MESSAGE_LENGTH),
      senderId: playerId,
      senderName: playerName,
      timestamp: Date.now(),
    };

    // Optimistic local add
    setMessages(prev => [
      ...prev.slice(-49),
      { id: `${Date.now()}-local`, ...chatMsg },
    ]);

    await channelRef.current.send({
      type: 'broadcast',
      event: 'chat',
      payload: chatMsg,
    });

    setMessage('');
    inputRef.current?.focus();
  }, [message, playerId, playerName]);

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

      {/* Chat panel */}
      {isOpen && (
        <div className="absolute right-0 top-9 w-64 bg-stone-800 rounded-xl shadow-xl border border-stone-600 z-50 animate-in slide-in-from-top-2 duration-150 flex flex-col max-h-[280px]">
          {/* Header */}
          <div className="px-3 py-2 border-b border-stone-700 flex items-center justify-between">
            <span className="text-xs font-semibold text-white">Chat</span>
            <span className="text-[10px] text-stone-400">{MAX_MESSAGE_LENGTH} char limit</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5 min-h-[80px] max-h-[180px]">
            {messages.length === 0 && (
              <p className="text-[10px] text-stone-500 text-center py-4">
                No messages yet. Say hi!
              </p>
            )}
            {messages.map((msg) => {
              const isMe = msg.senderId === playerId;
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
                    {getSenderName(msg.senderId)}
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
                placeholder="Type a message..."
                className="flex-1 bg-stone-700 text-white text-xs rounded-lg px-2.5 py-1.5 
                           placeholder:text-stone-400 outline-none focus:ring-1 focus:ring-blue-400
                           border border-stone-600"
                maxLength={MAX_MESSAGE_LENGTH}
                autoComplete="off"
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
      )}
    </>
  );
}

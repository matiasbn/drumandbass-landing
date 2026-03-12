'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RiSendPlaneFill, RiChat1Line, RiCloseLine, RiAlertLine } from '@remixicon/react';
import { useAuth } from '../AuthContext';

interface YouTubeChatMessage {
  id: string;
  authorDisplayName: string;
  authorProfileImageUrl: string;
  messageText: string;
  publishedAt: string;
}

interface YouTubeChatProps {
  youtubeVideoId: string;
}

export const YouTubeChat: React.FC<YouTubeChatProps> = ({ youtubeVideoId }) => {
  const { session } = useAuth();
  const [messages, setMessages] = useState<YouTubeChatMessage[]>([]);
  const [liveChatId, setLiveChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpenRef = useRef(isOpen);
  const pollingIntervalRef = useRef(6000);
  const prevMessageCountRef = useRef(0);

  const providerToken = session?.provider_token ?? null;

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/messages?videoId=${youtubeVideoId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError('No hay chat en vivo activo');
        }
        return;
      }

      const data = await res.json();
      setMessages(data.messages);
      setLiveChatId(data.liveChatId);
      pollingIntervalRef.current = data.pollingIntervalMillis ?? 6000;
      setError(null);

      // Track unread
      const newCount = data.messages.length;
      if (newCount > prevMessageCountRef.current && !isOpenRef.current) {
        setUnreadCount(prev => prev + (newCount - prevMessageCountRef.current));
      }
      prevMessageCountRef.current = newCount;
    } catch (err) {
      console.error('Error fetching YouTube chat:', err);
    }
  }, [youtubeVideoId]);

  // Polling
  useEffect(() => {
    fetchMessages();

    const interval = setInterval(() => {
      fetchMessages();
    }, pollingIntervalRef.current);

    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Auto-scroll
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  // Clear unread on open
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || !liveChatId || !providerToken || isSending) return;

    setIsSending(true);
    setNewMessage('');

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${providerToken}`,
        },
        body: JSON.stringify({ liveChatId, message: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          setError('Debes re-iniciar sesion con Google para enviar mensajes');
        } else {
          console.error('Failed to send message:', data);
          setNewMessage(trimmed);
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setNewMessage(trimmed);
    }

    setIsSending(false);
    inputRef.current?.focus();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="fixed bottom-4 right-4 z-20 w-80">
      <div className="bg-black/85 backdrop-blur border border-[#ff0055]/30 flex flex-col">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between px-4 py-2 border-b transition-all ${
            isOpen ? 'border-[#ff0055]/30 bg-black/50' : 'border-transparent hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <RiChat1Line className="w-4 h-4 text-[#ff0055]" />
            <span className="font-mono text-sm text-white">LIVE CHAT</span>
            {unreadCount > 0 && !isOpen && (
              <span className="bg-[#ff0055] text-white text-xs px-1.5 py-0.5 font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <RiCloseLine className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-0' : 'rotate-45'}`} />
        </button>

        {isOpen && (
          <div className="flex flex-col">
            {/* Messages */}
            <div className="overflow-y-auto p-3 space-y-2 max-h-[300px]">
              {error ? (
                <div className="flex items-center gap-2 text-[#ff0055] text-sm font-mono py-8 justify-center">
                  <RiAlertLine className="w-4 h-4" />
                  {error}
                </div>
              ) : messages.length === 0 ? (
                <p className="text-white/30 text-sm font-mono text-center py-8">
                  Cargando chat en vivo...
                </p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className="text-sm">
                    <div className="inline-block max-w-[90%] px-3 py-1.5 bg-white/5 border border-white/10">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <img
                          src={msg.authorProfileImageUrl}
                          alt=""
                          className="w-4 h-4 rounded-full"
                        />
                        <span className="font-bold text-xs text-[#ff0055]">
                          {msg.authorDisplayName}
                        </span>
                        <span className="text-white/30 text-[10px] font-mono">
                          {formatTime(msg.publishedAt)}
                        </span>
                      </div>
                      <p className="text-white/90 break-words">{msg.messageText}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Send message */}
            {providerToken ? (
              <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Escribe un mensaje..."
                    maxLength={200}
                    className="flex-1 bg-black/50 border border-white/20 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#ff0055] transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isSending}
                    className="px-4 py-2 bg-[#ff0055]/20 border border-[#ff0055]/50 text-[#ff0055] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ff0055]/30 transition-colors"
                  >
                    <RiSendPlaneFill className="w-4 h-4" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3 border-t border-white/10">
                <p className="text-white/40 text-xs font-mono text-center">
                  Inicia sesion con Google para enviar mensajes
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase, ChatMessage } from '../../../lib/supabase';
import { RiSendPlaneFill, RiChat1Line, RiCloseLine, RiUserLine } from '@remixicon/react';
import { Facehash } from 'facehash';
import { useMultiplayer } from '../MultiplayerContext';

export const Chat: React.FC = () => {
  const { username, setUsername } = useMultiplayer();
  const [nameInput, setNameInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (!username) return;

    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Error fetching messages:', error);
        return;
      }

      setMessages(data || []);
    };

    fetchMessages();

    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            const updated = [...prev, newMsg];
            return updated.slice(-50);
          });

          if (!isOpenRef.current) {
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [username]);

  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  const handleSetUsername = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim();
    if (trimmed.length >= 2 && trimmed.length <= 20) {
      setUsername(trimmed);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || !username || isLoading) return;

    setIsLoading(true);
    setNewMessage('');

    const { error } = await supabase.from('messages').insert({
      username,
      message: trimmed,
    });

    if (error) {
      console.error('Error sending message:', error);
      setNewMessage(trimmed);
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!username) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-black/90 border border-[#00ccff]/50 p-6 max-w-sm w-full mx-4">
          <div className="flex items-center gap-3 mb-4">
            <RiUserLine className="w-6 h-6 text-[#00ccff]" />
            <h2 className="text-xl font-mono text-white tracking-wider">ENTER THE CLUB</h2>
          </div>

          <p className="text-white/60 text-sm mb-4 font-mono">
            Elige un nombre para entrar al chat
          </p>

          <form onSubmit={handleSetUsername}>
            <div className="flex items-center gap-3 mb-4">
              <div className="shrink-0">
                {nameInput.trim().length >= 2 ? (
                  <Facehash
                    name={nameInput.trim()}
                    size={48}
                    interactive={false}
                    showInitial={false}
                    variant="gradient"
                    intensity3d="subtle"
                  />
                ) : (
                  <div className="w-12 h-12 border border-white/20 flex items-center justify-center">
                    <RiUserLine className="w-6 h-6 text-white/30" />
                  </div>
                )}
              </div>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Tu nombre..."
                maxLength={20}
                autoFocus
                className="flex-1 bg-black/50 border border-white/20 text-white px-4 py-3 font-mono text-sm focus:outline-none focus:border-[#00ccff] transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={nameInput.trim().length < 2}
              className="w-full py-3 bg-gradient-to-r from-[#ff0055] to-[#00ccff] text-white font-mono font-bold tracking-wider uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              ENTRAR AL CHAT
            </button>
          </form>

          <p className="text-white/30 text-xs mt-4 text-center font-mono">
            2-20 caracteres
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-20 w-80">
      <div className="bg-black/85 backdrop-blur border border-[#00ccff]/30 flex flex-col">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center justify-between px-4 py-2 border-b transition-all ${
            isOpen ? 'border-[#00ff41]/30 bg-black/50' : 'border-transparent hover:bg-white/5'
          }`}
        >
          <div className="flex items-center gap-2">
            <RiChat1Line className={`w-4 h-4 ${isOpen ? 'text-[#00ff41]' : 'text-[#00ccff]'}`} />
            <span className="font-mono text-sm text-white">CHAT</span>
            {unreadCount > 0 && !isOpen && (
              <span className="bg-[#ff0055] text-white text-xs px-1.5 py-0.5 font-bold">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isOpen && (
              <div className="flex items-center gap-1.5">
                <Facehash name={username} size={18} interactive={false} showInitial={false} variant="gradient" intensity3d="subtle" />
                <span className="font-mono text-xs text-[#00ccff]">{username}</span>
              </div>
            )}
            <RiCloseLine className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-0' : 'rotate-45'}`} />
          </div>
        </button>

        {isOpen && (
          <div className="flex flex-col">
            <div className="overflow-y-auto p-3 space-y-2 max-h-[300px]">
              {messages.length === 0 ? (
                <p className="text-white/30 text-sm font-mono text-center py-8">
                  No hay mensajes aún. ¡Di algo!
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-sm ${msg.username === username ? 'text-right' : ''}`}
                  >
                    <div
                      className={`inline-block max-w-[80%] px-3 py-1.5 ${
                        msg.username === username
                          ? 'bg-[#00ccff]/20 border border-[#00ccff]/30'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Facehash name={msg.username} size={16} interactive={false} showInitial={false} variant="gradient" intensity3d="subtle" />
                        <span className={`font-bold text-xs ${
                          msg.username === username ? 'text-[#00ccff]' : 'text-[#ff0055]'
                        }`}>
                          {msg.username}
                        </span>
                        <span className="text-white/30 text-[10px] font-mono">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-white/90 break-words">{msg.message}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Escribe un mensaje..."
                  maxLength={500}
                  className="flex-1 bg-black/50 border border-white/20 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#00ccff] transition-colors"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || isLoading}
                  className="px-4 py-2 bg-[#00ccff]/20 border border-[#00ccff]/50 text-[#00ccff] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#00ccff]/30 transition-colors"
                >
                  <RiSendPlaneFill className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

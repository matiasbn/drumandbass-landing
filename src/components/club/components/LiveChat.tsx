'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { supabase, ChatMessage } from '../../../lib/supabase';
import { RiSendPlaneFill, RiChat1Line, RiCloseLine, RiEmotion2Line, RiFileGifLine } from '@remixicon/react';
import { Facehash } from 'facehash';
import { useAuth } from '../AuthContext';
import { useMultiplayer } from '../MultiplayerContext';
import { isGifMessage, decodeGifUrl, encodeGifMessage, getBubbleText } from '../../../lib/chatMessage';

const EmojiPicker = dynamic(() => import('./EmojiPicker').then(m => ({ default: m.EmojiPicker })), { ssr: false });
const GifPicker = dynamic(() => import('./GifPicker').then(m => ({ default: m.GifPicker })), { ssr: false });

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export const LiveChat: React.FC = () => {
  const { profile } = useAuth();
  const username = profile?.username ?? null;
  const { sendChatBubble } = useMultiplayer();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mobileScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const isOpenRef = useRef(isOpen);
  const isMobile = useIsMobile();

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
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
      .channel('live_chat_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
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
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTop = mobileScrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timer);
  }, [messages, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (chatContainerRef.current && !chatContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowEmojiPicker(false);
        setShowGifPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || !username || isLoading) return;

    setIsLoading(true);
    setNewMessage('');

    const { error } = await supabase.from('chat_messages').insert({
      username,
      message: trimmed,
    });

    if (error) {
      console.error('Error sending message:', error);
      setNewMessage(trimmed);
    } else {
      sendChatBubble(trimmed);
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage((prev) => prev + emoji);
    inputRef.current?.focus();
  };

  const handleGifSelect = async (gifUrl: string) => {
    if (!username || isLoading) return;
    setShowGifPicker(false);
    setIsLoading(true);

    const encoded = encodeGifMessage(gifUrl);
    const { error } = await supabase.from('chat_messages').insert({
      username,
      message: encoded,
    });

    if (error) {
      console.error('Error sending GIF:', error);
    } else {
      sendChatBubble(encoded);
    }
    setIsLoading(false);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const messagesContent = (
    <div className="overflow-y-auto p-3 space-y-2 max-h-[300px] md:max-h-[300px]">
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
                  ? 'bg-[#ff0055]/20 border border-[#ff0055]/30'
                  : 'bg-white/5 border border-white/10'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <Facehash name={msg.username} size={16} interactive={false} showInitial={false} variant="gradient" intensity3d="subtle" />
                <span className={`font-bold text-xs ${
                  msg.username === username ? 'text-[#ff0055]' : 'text-[#00ff41]'
                }`}>
                  {msg.username}
                </span>
                <span className="text-white/30 text-[10px] font-mono">
                  {formatTime(msg.created_at)}
                </span>
              </div>
              {isGifMessage(msg.message) ? (
                <img src={decodeGifUrl(msg.message)} alt="GIF" className="max-w-[200px] rounded mt-1" loading="lazy" onLoad={scrollToBottom} />
              ) : (
                <p className="text-white/90 break-words">{msg.message}</p>
              )}
            </div>
          </div>
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );

  const inputContent = username ? (
    <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10">
      <div className="relative">
        {showEmojiPicker && (
          <EmojiPicker
            onSelect={handleEmojiSelect}
            onClose={() => setShowEmojiPicker(false)}
          />
        )}
        {showGifPicker && (
          <GifPicker
            onSelect={handleGifSelect}
            onClose={() => setShowGifPicker(false)}
          />
        )}
        <div className="flex gap-1.5 items-center">
          <div className="flex-1 flex items-center bg-black/50 border border-white/20 focus-within:border-[#ff0055] transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              maxLength={500}
              disabled={isLoading}
              className="flex-1 bg-transparent text-white px-3 py-2 text-sm font-mono focus:outline-none disabled:opacity-50 min-w-0"
            />
            <button
              type="button"
              onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
              className="px-1.5 text-white/40 hover:text-[#ff0055] transition-colors shrink-0"
              title="Emojis"
            >
              <RiEmotion2Line className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); }}
              className="px-1.5 pr-2 text-white/40 hover:text-[#ff0055] transition-colors shrink-0"
              title="GIFs"
            >
              <RiFileGifLine className="w-4 h-4" />
            </button>
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || isLoading}
            className="px-3 py-2 bg-[#ff0055]/20 border border-[#ff0055]/50 text-[#ff0055] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ff0055]/30 transition-colors shrink-0"
          >
            <RiSendPlaneFill className="w-4 h-4" />
          </button>
        </div>
      </div>
    </form>
  ) : (
    <div className="p-3 border-t border-white/10">
      <p className="text-white/40 text-xs font-mono text-center">
        Inicia sesión para enviar mensajes
      </p>
    </div>
  );

  // Desktop layout
  if (!isMobile) {
    return (
      <div ref={chatContainerRef} className="fixed bottom-4 right-4 z-20 w-80">
        <div className="bg-black/85 backdrop-blur border border-[#ff0055]/30 flex flex-col">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center justify-between px-4 py-2 border-b transition-all ${
              isOpen ? 'border-[#ff0055]/30 bg-black/50' : 'border-transparent hover:bg-white/5'
            }`}
          >
            <div className="flex items-center gap-2">
              <RiChat1Line className={`w-4 h-4 ${isOpen ? 'text-[#ff0055]' : 'text-[#ff0055]'}`} />
              <span className="font-mono text-sm text-white">LIVE CHAT</span>
              {unreadCount > 0 && !isOpen && (
                <span className="bg-[#ff0055] text-white text-xs px-1.5 py-0.5 font-bold">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isOpen && username && (
                <div className="flex items-center gap-1.5">
                  <Facehash name={username} size={18} interactive={false} showInitial={false} variant="gradient" intensity3d="subtle" />
                  <span className="font-mono text-xs text-[#ff0055]">{username}</span>
                </div>
              )}
              <RiCloseLine className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-0' : 'rotate-45'}`} />
            </div>
          </button>

          {isOpen && (
            <>
              {messagesContent}
              {inputContent}
            </>
          )}
        </div>
      </div>
    );
  }

  // Mobile layout — portaled elements to avoid iframe touch capture
  return (
    <>
      {/* Backdrop to close chat on outside tap */}
      {isOpen && mounted && createPortal(
        <div
          className="fixed inset-0 z-30"
          onClick={() => { setIsOpen(false); setShowEmojiPicker(false); setShowGifPicker(false); }}
        />,
        document.body,
      )}

      {/* Messages panel */}
      {isOpen && (
        <div
          className="fixed left-4 right-4 z-40 touch-auto"
          style={{ top: '35%', bottom: '115px' }}
        >
          <div className="bg-black/85 backdrop-blur border border-[#ff0055]/30 h-full flex flex-col">
            <div ref={mobileScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
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
                          ? 'bg-[#ff0055]/20 border border-[#ff0055]/30'
                          : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Facehash name={msg.username} size={16} interactive={false} showInitial={false} variant="gradient" intensity3d="subtle" />
                        <span className={`font-bold text-xs ${
                          msg.username === username ? 'text-[#ff0055]' : 'text-[#00ff41]'
                        }`}>
                          {msg.username}
                        </span>
                        <span className="text-white/30 text-[10px] font-mono">
                          {formatTime(msg.created_at)}
                        </span>
                      </div>
                      {isGifMessage(msg.message) ? (
                <img src={decodeGifUrl(msg.message)} alt="GIF" className="max-w-[200px] rounded mt-1" loading="lazy" onLoad={scrollToBottom} />
              ) : (
                <p className="text-white/90 break-words">{msg.message}</p>
              )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* Input — portaled, below chat */}
      {isOpen &&
        mounted &&
        createPortal(
          <div className="fixed left-4 right-4 z-[9999] touch-auto" style={{ bottom: '60px' }}>
            <div className="bg-black border border-[#ff0055]/30">
              {inputContent}
            </div>
          </div>,
          document.body,
        )}

      {/* Toggle button — portaled, below input when open */}
      {mounted &&
        createPortal(
          <div
            className="fixed z-[9999] touch-auto"
            style={isOpen ? { bottom: '8px', left: '16px', right: '16px' } : { bottom: '16px', right: '16px' }}
          >
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`flex items-center justify-between px-4 py-2 bg-black/85 backdrop-blur border border-[#ff0055]/30 transition-all ${
                isOpen ? 'w-full bg-black/50' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <RiChat1Line className="w-4 h-4 text-[#ff0055]" />
                <span className="font-mono text-sm text-white">
                  {isOpen ? 'CERRAR' : 'LIVE CHAT'}
                </span>
                {unreadCount > 0 && !isOpen && (
                  <span className="bg-[#ff0055] text-white text-xs px-1.5 py-0.5 font-bold">
                    {unreadCount}
                  </span>
                )}
              </div>
              <RiCloseLine
                className={`w-4 h-4 text-white/40 ml-2 transition-transform ${isOpen ? 'rotate-0' : 'rotate-45'}`}
              />
            </button>
          </div>,
          document.body,
        )}
    </>
  );
};

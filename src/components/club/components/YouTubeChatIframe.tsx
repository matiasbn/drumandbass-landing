'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RiSendPlaneFill, RiChat1Line, RiCloseLine } from '@remixicon/react';
import { useAuth } from '../AuthContext';

interface YouTubeChatIframeProps {
  youtubeVideoId: string;
}

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

export const YouTubeChatIframe: React.FC<YouTubeChatIframeProps> = ({ youtubeVideoId }) => {
  const { session } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [liveChatId, setLiveChatId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [needsYouTubeChannel, setNeedsYouTubeChannel] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);
  const isMobile = useIsMobile();

  const providerToken = session?.provider_token ?? null;
  const embedDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const chatUrl = `https://www.youtube.com/live_chat?v=${youtubeVideoId}&embed_domain=${embedDomain}`;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchLiveChatId = async () => {
      try {
        const res = await fetch(`/api/chat/messages?videoId=${youtubeVideoId}`);
        if (res.ok) {
          const data = await res.json();
          setLiveChatId(data.liveChatId);
        } else {
          console.error('Failed to fetch liveChatId, status:', res.status);
          setSendError('No se pudo conectar al chat en vivo');
        }
      } catch (err) {
        console.error('Error fetching liveChatId:', err);
        setSendError('Error de conexion al chat');
      }
    };
    fetchLiveChatId();
  }, [youtubeVideoId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMessage.trim();
    if (!trimmed || !liveChatId || !providerToken || isSending) return;

    setIsSending(true);
    setNewMessage('');
    setSendError(null);
    setSendSuccess(false);

    try {
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${providerToken}`,
        },
        body: JSON.stringify({ liveChatId, message: trimmed }),
      });

      if (res.ok) {
        setSendSuccess(true);
        if (successTimeoutRef.current) clearTimeout(successTimeoutRef.current);
        successTimeoutRef.current = setTimeout(() => setSendSuccess(false), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401 || res.status === 403) {
          setSendError('Debes re-iniciar sesion con Google para enviar mensajes');
        } else if (res.status === 400 && data.details?.error?.status === 'INVALID_ARGUMENT') {
          setNeedsYouTubeChannel(true);
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

  const inputContent = (
    <>
      {sendError && (
        <div className="px-3 py-2 text-[#ff0055] text-xs font-mono text-center">{sendError}</div>
      )}
      {needsYouTubeChannel ? (
        <div className="p-3 text-center space-y-2">
          <p className="text-white/60 text-xs font-mono">
            Necesitas un canal de YouTube para enviar mensajes
          </p>
          <a
            href="https://www.youtube.com/create_channel"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-[#ff0055]/20 border border-[#ff0055]/50 text-[#ff0055] text-xs font-mono hover:bg-[#ff0055]/30 transition-colors"
          >
            CREAR CANAL DE YOUTUBE
          </a>
          <button
            onClick={() => setNeedsYouTubeChannel(false)}
            className="block w-full py-2 text-white text-xs font-mono border border-white/30 hover:bg-white/10 transition-colors"
          >
            YA TENGO CANAL — REINTENTAR
          </button>
        </div>
      ) : providerToken ? (
        <form onSubmit={handleSendMessage} className="p-3">
          {isSending && (
            <div className="text-white/60 text-xs font-mono text-center pb-2 animate-pulse">
              Enviando mensaje...
            </div>
          )}
          {sendSuccess && !isSending && (
            <div className="text-[#00ff41] text-xs font-mono text-center pb-2">Mensaje enviado</div>
          )}
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              maxLength={200}
              disabled={isSending}
              className="flex-1 bg-black/50 border border-white/20 text-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#ff0055] transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending || !liveChatId}
              className="px-4 py-2 bg-[#ff0055]/20 border border-[#ff0055]/50 text-[#ff0055] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#ff0055]/30 transition-colors"
            >
              <RiSendPlaneFill className="w-4 h-4" />
            </button>
          </div>
        </form>
      ) : (
        <div className="p-3">
          <p className="text-white/40 text-xs font-mono text-center">
            Inicia sesion con Google para enviar mensajes
          </p>
        </div>
      )}
    </>
  );

  // Desktop: everything in one container, no portals needed
  if (!isMobile) {
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
            </div>
            <RiCloseLine
              className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-0' : 'rotate-45'}`}
            />
          </button>

          {isOpen && (
            <>
              <div className="h-[400px]">
                <iframe
                  src={chatUrl}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
              <div className="border-t border-white/10">{inputContent}</div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Mobile: iframe, toggle button, and input are all separate portaled elements
  return (
    <>
      {/* Iframe */}
      {isOpen && (
        <div className="fixed right-4 z-20 w-80 touch-auto" style={{ bottom: '120px' }}>
          <div className="bg-black/85 backdrop-blur border border-[#ff0055]/30">
            <div className="h-[350px]">
              <iframe
                src={chatUrl}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>
          </div>
        </div>
      )}

      {/* Toggle button — portaled to body */}
      {mounted &&
        createPortal(
          <div
            className="fixed right-4 z-[9999] touch-auto"
            style={{ bottom: isOpen ? '68px' : '16px' }}
          >
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={`flex items-center justify-between w-80 px-4 py-2 bg-black/85 backdrop-blur border border-[#ff0055]/30 transition-all ${
                isOpen ? 'bg-black/50' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <RiChat1Line className="w-4 h-4 text-[#ff0055]" />
                <span className="font-mono text-sm text-white">LIVE CHAT</span>
              </div>
              <RiCloseLine
                className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-0' : 'rotate-45'}`}
              />
            </button>
          </div>,
          document.body,
        )}

      {/* Input — portaled to body, full width at bottom */}
      {isOpen &&
        mounted &&
        createPortal(
          <div className="fixed bottom-4 left-4 right-4 z-[9999] touch-auto">
            <div className="bg-black border border-[#ff0055]/30">{inputContent}</div>
          </div>,
          document.body,
        )}
    </>
  );
};

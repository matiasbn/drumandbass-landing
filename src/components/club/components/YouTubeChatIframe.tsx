'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RiSendPlaneFill, RiChat1Line, RiCloseLine } from '@remixicon/react';
import { useAuth } from '../AuthContext';

interface YouTubeChatIframeProps {
  youtubeVideoId: string;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const providerToken = session?.provider_token ?? null;
  const embedDomain = typeof window !== 'undefined' ? window.location.hostname : '';
  const chatUrl = `https://www.youtube.com/live_chat?v=${youtubeVideoId}&embed_domain=${embedDomain}`;

  // Fetch liveChatId once on mount (single API call, no polling)
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

  return (
    <div className="fixed bottom-4 right-4 z-20 w-80 touch-auto">
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
          <RiCloseLine className={`w-4 h-4 text-white/40 transition-transform ${isOpen ? 'rotate-0' : 'rotate-45'}`} />
        </button>

        {isOpen && (
          <div className="flex flex-col">
            {/* YouTube live chat iframe - read only */}
            <div className="h-[400px] overflow-hidden" style={{ clipPath: 'inset(0)' }}>
              <iframe
                src={chatUrl}
                className="w-full border-0 pointer-events-auto"
                style={{ height: 'calc(100% + 80px)' }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              />
            </div>

            {/* Send message via API */}
            {sendError && (
              <div className="px-3 py-2 text-[#ff0055] text-xs font-mono text-center border-t border-white/10">
                {sendError}
              </div>
            )}
            {needsYouTubeChannel ? (
              <div className="p-3 border-t border-white/10 text-center space-y-2">
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
              <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10">
                {isSending && (
                  <div className="text-white/60 text-xs font-mono text-center pb-2 animate-pulse">
                    Enviando mensaje...
                  </div>
                )}
                {sendSuccess && !isSending && (
                  <div className="text-[#00ff41] text-xs font-mono text-center pb-2">
                    Mensaje enviado
                  </div>
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

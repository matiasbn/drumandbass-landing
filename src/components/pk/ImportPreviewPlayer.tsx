'use client';

import { useEffect, useRef, useState } from 'react';
import { RiPlayFill, RiPauseFill, RiLoader4Line, RiSkipBackFill, RiSkipForwardFill, RiExternalLinkLine } from '@remixicon/react';

// Mini-reproductor para previsualizar un track ANTES de agregarlo, dentro del
// dropdown de import (SoundCloud / Bandcamp). Resuelve el stream con los mismos
// endpoints que el reproductor de la página (/api/pk/{soundcloud,bandcamp}/stream)
// y da play/pausa + barra de progreso. Resuelve recién al primer play (no gasta
// una resolución por cada cambio de selección en el dropdown).

const isBc = (url: string) => /bandcamp\.com/i.test(url);
const isSp = (url: string) => /open\.spotify\.com|spotify\.com/i.test(url);
const isBp = (url: string) => /beatport\.com/i.test(url);
const streamApi = (url: string) => (isBc(url) ? '/api/pk/bandcamp/stream' : '/api/pk/soundcloud/stream');
const accentFor = (url: string) => (isBp(url) ? '#01FF95' : isSp(url) ? '#1DB954' : isBc(url) ? '#1da0c3' : '#FF5500');
const platformName = (url: string) => (isBp(url) ? 'Beatport' : isSp(url) ? 'Spotify' : isBc(url) ? 'Bandcamp' : 'SoundCloud');

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
};

// Registro global de todos los previews montados: al reproducir uno, se pausan
// los demás (solo suena uno a la vez en toda la página).
const pausers = new Set<() => void>();
function pauseOthers(self: () => void) {
  for (const p of pausers) if (p !== self) p();
}

export default function ImportPreviewPlayer({
  url,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  playSignal = 0,
}: {
  url: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  // Señal EXPLÍCITA de "reproducir ahora": el padre la incrementa al usar
  // anterior/siguiente. NUNCA reproduce solo al montar/recargar (0 = no tocar).
  playSignal?: number;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolvedRef = useRef<string>(''); // URL cuyo stream ya está cargado en el <audio>
  const pauseSelfRef = useRef(() => audioRef.current?.pause()); // estable, para el registro global
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);

  const resolve = async (nextUrl: string): Promise<boolean> => {
    if (resolvedRef.current === nextUrl && audioRef.current?.src) return true;
    setLoading(true);
    setError('');
    try {
      // Spotify: preview MP3 de 30s vía el endpoint propio. SoundCloud/Bandcamp:
      // stream real resuelto por sus endpoints.
      let streamUrl: string | null = null;
      if (isSp(nextUrl) || isBp(nextUrl)) {
        const api = isBp(nextUrl) ? '/api/pk/beatport' : '/api/pk/spotify';
        const res = await fetch(`${api}?url=${encodeURIComponent(nextUrl)}`);
        if (res.ok) {
          const data = await res.json();
          streamUrl = data?.tracks?.[0]?.previewUrl || null;
        }
      } else {
        const res = await fetch(`${streamApi(nextUrl)}?url=${encodeURIComponent(nextUrl)}`);
        if (res.ok) {
          const s = await res.json();
          streamUrl = s?.streamUrl || null;
        }
      }
      if (!streamUrl) throw new Error();
      const a = audioRef.current;
      if (!a) return false;
      a.src = streamUrl;
      resolvedRef.current = nextUrl;
      return true;
    } catch {
      setError(`No se pudo previsualizar aquí (track protegido o EP). Escúchalo en ${platformName(nextUrl)} →`);
      return false;
    } finally {
      setLoading(false);
    }
  };

  const play = async (target: string) => {
    const ok = await resolve(target);
    if (!ok) return;
    try {
      await audioRef.current?.play();
    } catch {
      setError('No se pudo reproducir.');
    }
  };

  // Registro global: al desmontar, se saca del set de pausables.
  useEffect(() => {
    const self = pauseSelfRef.current;
    pausers.add(self);
    return () => {
      pausers.delete(self);
    };
  }, []);

  // Al cambiar de track: reinicia el <audio> (detenido). NUNCA reproduce solo
  // (ni al montar, ni al recargar): la reproducción es siempre por gesto del
  // usuario (botón play) o por la señal explícita playSignal (next/anterior).
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute('src');
      a.load();
    }
    resolvedRef.current = '';
    setPlaying(false);
    setPos(0);
    setDur(0);
    setError('');
  }, [url]);

  // Reproducir SOLO cuando el padre lo pide explícitamente (next/anterior). En
  // el montaje playSignal es 0 → no toca nada.
  useEffect(() => {
    if (playSignal > 0) void play(url);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playSignal]);

  const toggle = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      return;
    }
    await play(url);
  };

  const accent = accentFor(url);

  return (
    <div className="brutalist-border bg-white p-2 space-y-1">
      <div className="flex items-center gap-3">
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => {
          setPlaying(true);
          pauseOthers(pauseSelfRef.current); // solo uno suena a la vez
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setPos(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)}
        onEnded={() => {
          setPlaying(false);
          setPos(0);
        }}
      />
      {onPrev && (
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Track anterior"
          title="Track anterior"
          className="shrink-0 w-7 h-9 flex items-center justify-center brutalist-border hover:bg-black hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <RiSkipBackFill className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pausar preview' : 'Reproducir preview'}
        className="shrink-0 w-9 h-9 flex items-center justify-center text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        {loading ? (
          <RiLoader4Line className="w-5 h-5 animate-spin" />
        ) : playing ? (
          <RiPauseFill className="w-5 h-5" />
        ) : (
          <RiPlayFill className="w-5 h-5" />
        )}
      </button>
      {onNext && (
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Track siguiente"
          title="Track siguiente"
          className="shrink-0 w-7 h-9 flex items-center justify-center brutalist-border hover:bg-black hover:text-white transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-current"
        >
          <RiSkipForwardFill className="w-4 h-4" />
        </button>
      )}
      <input
        type="range"
        min={0}
        max={dur || 0}
        step="any"
        value={Math.min(pos, dur || 0)}
        onChange={(e) => {
          const a = audioRef.current;
          if (a && isFinite(a.duration)) a.currentTime = Number(e.target.value);
          setPos(Number(e.target.value));
        }}
        aria-label="Barra de reproducción"
        className="flex-1 min-w-0 h-1 cursor-pointer"
        style={{ accentColor: accent }}
      />
      <span className="mono text-[10px] tabular-nums opacity-70 shrink-0 w-16 text-right">
        {fmt(pos)} / {fmt(dur)}
      </span>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => audioRef.current?.pause()}
        aria-label={`Ir a ${platformName(url)}`}
        title={`Ir a ${platformName(url)}`}
        className="inline-flex items-center gap-1 mono text-[10px] font-bold uppercase px-2 h-9 brutalist-border text-white shrink-0 transition-opacity hover:opacity-90"
        style={{ backgroundColor: accent }}
      >
        <RiExternalLinkLine className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Ir a {platformName(url)}</span>
      </a>
      </div>
      {error && (
        <p className="mono text-[10px] text-red-500 leading-tight">{error}</p>
      )}
    </div>
  );
}

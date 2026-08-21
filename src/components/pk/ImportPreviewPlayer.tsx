'use client';

import { useEffect, useRef, useState } from 'react';
import { RiPlayFill, RiPauseFill, RiLoader4Line, RiSkipBackFill, RiSkipForwardFill } from '@remixicon/react';

// Mini-reproductor para previsualizar un track ANTES de agregarlo, dentro del
// dropdown de import (SoundCloud / Bandcamp). Resuelve el stream con los mismos
// endpoints que el reproductor de la página (/api/pk/{soundcloud,bandcamp}/stream)
// y da play/pausa + barra de progreso. Resuelve recién al primer play (no gasta
// una resolución por cada cambio de selección en el dropdown).

const isBc = (url: string) => /bandcamp\.com/i.test(url);
const streamApi = (url: string) => (isBc(url) ? '/api/pk/bandcamp/stream' : '/api/pk/soundcloud/stream');
const accentFor = (url: string) => (isBc(url) ? '#1da0c3' : '#FF5500');

const fmt = (s: number) => {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
};

export default function ImportPreviewPlayer({
  url,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
}: {
  url: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resolvedRef = useRef<string>(''); // URL cuyo stream ya está cargado en el <audio>
  const mountedRef = useRef(false); // false en el primer render (no auto-reproduce al abrir)
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
      const res = await fetch(`${streamApi(nextUrl)}?url=${encodeURIComponent(nextUrl)}`);
      if (!res.ok) throw new Error();
      const s = await res.json();
      if (!s?.streamUrl) throw new Error();
      const a = audioRef.current;
      if (!a) return false;
      a.src = s.streamUrl;
      resolvedRef.current = nextUrl;
      return true;
    } catch {
      setError('No se pudo previsualizar este track (puede ser un EP o solo HLS).');
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

  // Al cambiar de track: reinicia el <audio>. En el primer render NO reproduce
  // (recién se abrió el selector); en cada cambio POSTERIOR (next/anterior o
  // cambio de selección) reproduce de inmediato.
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
    if (mountedRef.current) void play(url);
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

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
        onPlay={() => setPlaying(true)}
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
        className="flex-1 h-1 cursor-pointer"
        style={{ accentColor: accent }}
      />
      <span className="mono text-[10px] tabular-nums opacity-70 shrink-0 w-16 text-right">
        {fmt(pos)} / {fmt(dur)}
      </span>
      </div>
      {error && (
        <p className="mono text-[10px] text-red-500 leading-tight">{error}</p>
      )}
    </div>
  );
}

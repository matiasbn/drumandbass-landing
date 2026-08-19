'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  RiPlayFill,
  RiPauseFill,
  RiSkipBackFill,
  RiSkipForwardFill,
  RiShuffleLine,
  RiSoundcloudLine,
  RiDownloadLine,
  RiArrowDownSLine,
} from '@remixicon/react';
import dayjs from '@/src/lib/date';
import { event } from '@/src/lib/gtag';
import type { NationalRelease } from '@/src/lib/nationalReleases';

function fmt(ms: number): string {
  if (!ms || ms < 0 || !isFinite(ms)) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function downloadHref(downloadUrl: string | null, fallbackScUrl: string): string {
  return downloadUrl || fallbackScUrl;
}
const sameUrl = (a: string, b: string) => a.split('?')[0] === b.split('?')[0];
const bigArt = (art: string | null) => (art ? art.replace('-large', '-t500x500') : null);

interface SetTrack {
  title: string;
  url: string;
  downloadable: boolean;
  downloadUrl: string | null;
  durationMs: number | null;
}
type DlInfo = { downloadable: boolean; downloadUrl: string | null; canonicalUrl?: string | null };
interface Stream {
  streamUrl: string;
  protocol: 'progressive' | 'hls';
  title: string;
  artist: string;
  artwork: string | null;
  durationMs: number | null;
  permalinkUrl: string | null;
}

// Unidad reproducible: track suelto O track de un EP (así el shuffle los intercala).
interface PlayItem {
  url: string;
  title: string;
  artist: string;
  releaseIdx: number;
  epTitle: string | null;
  isEpTrack: boolean;
  downloadable: boolean;
  downloadUrl: string | null;
}

// Orden de reproducción (índices de `items`). Shuffle baraja y deja el actual al frente.
function buildQueue(len: number, shuffle: boolean, curIdx: number): { queue: number[]; pos: number } {
  const idxs = Array.from({ length: len }, (_, i) => i);
  if (!shuffle) return { queue: idxs, pos: curIdx };
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  if (curIdx >= 0) {
    const at = idxs.indexOf(curIdx);
    if (at > 0) {
      idxs.splice(at, 1);
      idxs.unshift(curIdx);
    }
    return { queue: idxs, pos: 0 };
  }
  return { queue: idxs, pos: -1 };
}

// ── Componente ───────────────────────────────────────────────────────────────
// Reproductor PROPIO: reproduce con un <audio> nativo (stream resuelto desde
// SoundCloud), no con el widget. Da la mejor UX: controles nativos del celular
// (Media Session), auto-avance, shuffle, sin gate. Es frágil por depender de la
// web de SoundCloud; si cambia, se reimplementa.
export default function ReleasesPlayer({
  releases,
  hideArtistFilter = false,
}: {
  releases: NationalRelease[];
  // En un presskit (un solo artista) el filtro por artista sobra: se oculta.
  hideArtistFilter?: boolean;
}) {
  const [filterArtist, setFilterArtist] = useState<string>('');
  // Filtro por tipo (release/set). Solo tiene sentido si conviven ambos tipos
  // (presskit); en /releases todos son 'release' y el filtro no se muestra.
  const [filterKind, setFilterKind] = useState<'' | 'set' | 'release'>('');
  const hasBothKinds = useMemo(
    () => releases.some((r) => r.kind === 'set') && releases.some((r) => r.kind === 'release'),
    [releases]
  );
  const artists = useMemo(
    () => Array.from(new Set(releases.map((r) => r.artistName))).sort((a, b) => a.localeCompare(b, 'es')),
    [releases]
  );
  const view = useMemo(
    () =>
      releases.filter(
        (r) => (!filterArtist || r.artistName === filterArtist) && (!filterKind || r.kind === filterKind)
      ),
    [releases, filterArtist, filterKind]
  );

  const [expanded, setExpanded] = useState<string | null>(null);
  const [epTracks, setEpTracks] = useState<Record<string, SetTrack[] | 'loading' | 'error'>>({});
  const [dl, setDl] = useState<Record<string, DlInfo>>({});

  // Conteos del filtro por tipo a nivel de TRACK: un EP suma sus tracks (una vez
  // precargada su tracklist), un tema suelto suma 1. Arranca en 1 por EP y crece
  // al cargarse las tracklists (se precargan en mount).
  const kindCounts = useMemo(() => {
    const n = (r: NationalRelease) => {
      const t = epTracks[r.url];
      return r.isEp && Array.isArray(t) ? t.length : 1;
    };
    let release = 0;
    let set = 0;
    for (const r of releases) {
      if (r.kind === 'set') set += n(r);
      else release += n(r);
    }
    return { release, set, all: release + set };
  }, [releases, epTracks]);

  const [shuffle, setShuffle] = useState(false);
  const [onlyDl, setOnlyDl] = useState(false); // filtro (aparte del de artista): solo descargables
  const [listOpen, setListOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  // Items reproducibles. Si `onlyDl`, deja solo los descargables (por track).
  const items = useMemo<PlayItem[]>(() => {
    const out: PlayItem[] = [];
    view.forEach((r, ri) => {
      if (r.isEp) {
        const tracks = epTracks[r.url];
        if (Array.isArray(tracks)) {
          tracks.forEach((t) => {
            if (onlyDl && !t.downloadable) return;
            out.push({ url: t.url, title: t.title, artist: r.artistName, releaseIdx: ri, epTitle: r.title, isEpTrack: true, downloadable: t.downloadable, downloadUrl: t.downloadUrl });
          });
        } else if (!onlyDl) {
          // Tracklist del EP aún no cargada → placeholder (no lo mostramos si filtramos por descarga).
          out.push({ url: r.url, title: r.title, artist: r.artistName, releaseIdx: ri, epTitle: null, isEpTrack: false, downloadable: false, downloadUrl: null });
        }
      } else {
        if (onlyDl && dl[r.url]?.downloadable !== true) return;
        out.push({ url: r.url, title: r.title, artist: r.artistName, releaseIdx: ri, epTitle: null, isEpTrack: false, downloadable: false, downloadUrl: null });
      }
    });
    return out;
  }, [view, epTracks, onlyDl, dl]);
  const shownReleaseIdx = useMemo(() => new Set(items.map((it) => it.releaseIdx)), [items]);
  const itemsRef = useRef<PlayItem[]>(items);
  itemsRef.current = items;

  const [queue, setQueue] = useState<number[]>([]);
  const [queuePos, setQueuePos] = useState(-1);
  const queueRef = useRef<number[]>([]);
  const queuePosRef = useRef(-1);
  queueRef.current = queue;
  queuePosRef.current = queuePos;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamCache = useRef<Record<string, Stream>>({});
  const loadedUrlRef = useRef<string | null>(null); // track url en curso
  const hasPlayedRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [nowPlaying, setNowPlaying] = useState<{ title: string; artist: string; artwork: string | null; permalink: string } | null>(null);
  // Track que no se pudo reproducir (HLS no soportado, sin stream, etc.) → aviso.
  const [playbackError, setPlaybackError] = useState<{ title: string; permalink: string } | null>(null);
  const errorRetryRef = useRef<string | null>(null); // url que ya reintentamos una vez

  const current = queuePos >= 0 && queue[queuePos] != null ? queue[queuePos] : -1;
  const currentItem = current >= 0 ? items[current] : null;
  const currentReleaseIdx = currentItem ? currentItem.releaseIdx : -1;

  const nextRef = useRef<() => void>(() => {});
  const prevRef = useRef<() => void>(() => {});

  const playerRef = useRef<HTMLDivElement | null>(null);
  const [playerHeight, setPlayerHeight] = useState<number | undefined>(undefined);
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPlayerHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const loadEp = useCallback(async (url: string) => {
    setEpTracks((p) => (p[url] ? p : { ...p, [url]: 'loading' }));
    try {
      const res = await fetch(`/api/pk/soundcloud/set?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEpTracks((p) => ({ ...p, [url]: (data.tracks as SetTrack[]) || [] }));
    } catch {
      setEpTracks((p) => ({ ...p, [url]: 'error' }));
    }
  }, []);
  useEffect(() => {
    view.forEach((r) => {
      if (r.isEp && epTracks[r.url] === undefined) void loadEp(r.url);
    });
  }, [view, epTracks, loadEp]);

  // Descarga en vivo (release suelto). Los EP traen su descarga por track.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        releases.map(async (r) => {
          try {
            const res = await fetch(`/api/pk/soundcloud/download?url=${encodeURIComponent(r.url)}`);
            if (!res.ok) return null;
            return [r.url, (await res.json()) as DlInfo] as const;
          } catch {
            return null;
          }
        })
      );
      if (cancelled) return;
      const map: Record<string, DlInfo> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setDl(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [releases]);

  useEffect(() => {
    const curIdx = hasPlayedRef.current ? items.findIndex((it) => sameUrl(it.url, loadedUrlRef.current || '')) : -1;
    const built = buildQueue(items.length, shuffle, curIdx);
    setQueue(built.queue);
    setQueuePos(built.pos);
    queueRef.current = built.queue;
    queuePosRef.current = built.pos;
  }, [items, shuffle]);

  // ── Stream propio ──────────────────────────────────────────────────────────
  const resolveStream = useCallback(async (trackUrl: string): Promise<Stream | null> => {
    if (streamCache.current[trackUrl]) return streamCache.current[trackUrl];
    try {
      const res = await fetch(`/api/pk/soundcloud/stream?url=${encodeURIComponent(trackUrl)}`);
      if (!res.ok) return null;
      const s = (await res.json()) as Stream;
      streamCache.current[trackUrl] = s;
      return s;
    } catch {
      return null;
    }
  }, []);

  const updateMediaSession = useCallback((s: Stream) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const art = bigArt(s.artwork);
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: s.title,
        artist: s.artist,
        album: 'Releases Nacionales · Drum and Bass Chile',
        artwork: art ? [{ src: art, sizes: '500x500', type: 'image/jpeg' }] : [],
      });
    } catch {
      // MediaMetadata puede no existir.
    }
  }, []);

  const applyStream = useCallback(
    (s: Stream, item: PlayItem) => {
      const a = audioRef.current;
      if (!a) return;
      const permalink = s.permalinkUrl || item.url;
      // Future-proof: si SoundCloud sirviera solo HLS y el navegador no lo
      // reproduce (Chrome/Firefox desktop), avisamos con link en vez de fallar mudo.
      if (s.protocol === 'hls' && !a.canPlayType('application/vnd.apple.mpegurl')) {
        setPlaybackError({ title: s.title || item.title, permalink });
        return;
      }
      loadedUrlRef.current = item.url;
      a.src = s.streamUrl;
      void a.play().catch(() => {});
      setNowPlaying({ title: s.title || item.title, artist: s.artist || item.artist, artwork: s.artwork, permalink });
      updateMediaSession(s);
    },
    [updateMediaSession]
  );

  // Reproduce la posición `qp` de la cola. Si el stream ya está cacheado, arranca
  // SÍNCRONO dentro del gesto (clave para el autoplay en móvil).
  const playQueue = useCallback(
    (qp: number) => {
      const ii = queueRef.current[qp];
      const item = ii != null ? itemsRef.current[ii] : undefined;
      if (!item) return;
      hasPlayedRef.current = true;
      setQueuePos(qp);
      queuePosRef.current = qp;
      setPosition(0);
      event('release_play', { release_title: item.title, artist: item.artist });
      setPlaybackError(null);
      errorRetryRef.current = null;
      const cached = streamCache.current[item.url];
      if (cached) {
        applyStream(cached, item);
      } else {
        setNowPlaying({ title: item.title, artist: item.artist, artwork: null, permalink: item.url });
        resolveStream(item.url).then((s) => {
          if (queuePosRef.current !== qp) return;
          if (s) applyStream(s, item);
          else setPlaybackError({ title: item.title, permalink: item.url }); // no se pudo resolver
        });
      }
    },
    [applyStream, resolveStream]
  );

  const playItemIdx = useCallback(
    (itemIdx: number) => {
      const qp = queueRef.current.indexOf(itemIdx);
      if (qp >= 0) playQueue(qp);
    },
    [playQueue]
  );
  const playRelease = useCallback(
    (viewIdx: number) => {
      const itemIdx = itemsRef.current.findIndex((it) => it.releaseIdx === viewIdx);
      if (itemIdx >= 0) playItemIdx(itemIdx);
    },
    [playItemIdx]
  );
  const playTrackUrl = useCallback(
    (url: string) => {
      const itemIdx = itemsRef.current.findIndex((it) => sameUrl(it.url, url));
      if (itemIdx >= 0) playItemIdx(itemIdx);
    },
    [playItemIdx]
  );
  const playNext = useCallback(() => {
    if (queuePosRef.current < queueRef.current.length - 1) playQueue(queuePosRef.current + 1);
  }, [playQueue]);
  const playPrev = useCallback(() => {
    if (queuePosRef.current > 0) playQueue(queuePosRef.current - 1);
  }, [playQueue]);
  nextRef.current = playNext;
  prevRef.current = playPrev;

  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) void a.play().catch(() => {});
    else a.pause();
  }, []);

  // Precarga (resuelve) el stream del actual y el siguiente → "siguiente" instantáneo.
  useEffect(() => {
    const cur = queuePos >= 0 ? queuePos : 0;
    [queue[cur], queue[cur + 1]].forEach((ii) => {
      const it = items[ii];
      if (it) void resolveStream(it.url);
    });
  }, [queue, queuePos, items, resolveStream]);

  // Controles nativos del celular (Media Session): una sola vez.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const ms = navigator.mediaSession;
    ms.setActionHandler('play', () => audioRef.current?.play().catch(() => {}));
    ms.setActionHandler('pause', () => audioRef.current?.pause());
    ms.setActionHandler('previoustrack', () => prevRef.current());
    ms.setActionHandler('nexttrack', () => nextRef.current());
    // iOS muestra por defecto los botones de ±10s (seek). Para que muestre
    // SIGUIENTE/ANTERIOR de playlist hay que deshabilitar explícitamente esos.
    for (const a of ['seekbackward', 'seekforward'] as const) {
      try {
        ms.setActionHandler(a, null);
      } catch {
        // acción no soportada
      }
    }
    // Scrubber de la pantalla bloqueada (no agrega botones de skip).
    try {
      ms.setActionHandler('seekto', (d: MediaSessionActionDetails) => {
        if (audioRef.current && typeof d.seekTime === 'number') audioRef.current.currentTime = d.seekTime;
      });
    } catch {
      // seekto puede no estar soportado.
    }
  }, []);

  const toggleExpand = useCallback(
    (url: string) => {
      setExpanded((cur) => {
        const nextVal = cur === url ? null : url;
        if (nextVal && !epTracks[url]) void loadEp(url);
        return nextVal;
      });
    },
    [epTracks, loadEp]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t?.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (current < 0) {
          if (queue.length) playQueue(0);
        } else toggle();
      } else if (e.code === 'ArrowRight' && current >= 0) {
        e.preventDefault();
        playNext();
      } else if (e.code === 'ArrowLeft' && current >= 0) {
        e.preventDefault();
        playPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, toggle, playNext, playPrev, playQueue, queue]);

  // ── Handlers del <audio> ─────────────────────────────────────────────────
  const onEnded = () => nextRef.current();
  const onError = () => {
    const url = loadedUrlRef.current;
    if (!url) return;
    const item = itemsRef.current.find((it) => sameUrl(it.url, url));
    // Reintento único: la URL firmada pudo expirar → re-resolvemos. Si ya
    // reintentamos este track, mostramos el aviso (future-proof).
    if (errorRetryRef.current === url) {
      setPlaybackError({ title: item?.title || nowPlaying?.title || '', permalink: item?.url || url });
      return;
    }
    errorRetryRef.current = url;
    delete streamCache.current[url];
    resolveStream(url).then((s) => {
      if (loadedUrlRef.current !== url) return;
      if (s && item) applyStream(s, item);
      else setPlaybackError({ title: item?.title || '', permalink: item?.url || url });
    });
  };
  const onTimeUpdate = () => {
    const a = audioRef.current;
    if (!a) return;
    setPosition(a.currentTime * 1000);
    if ('mediaSession' in navigator && a.duration && isFinite(a.duration)) {
      try {
        navigator.mediaSession.setPositionState({ duration: a.duration, position: a.currentTime, playbackRate: 1 });
      } catch {
        // no-op
      }
    }
  };
  const onLoadedMetadata = () => {
    const a = audioRef.current;
    if (a && isFinite(a.duration)) setDuration(a.duration * 1000);
  };

  const progressRatio = duration ? position / duration : 0;
  const sideStyle = isDesktop && playerHeight ? { maxHeight: playerHeight } : undefined;
  const artwork = bigArt(nowPlaying?.artwork ?? null);

  const itemDl = (it: PlayItem): DlInfo =>
    it.isEpTrack ? { downloadable: it.downloadable, downloadUrl: it.downloadUrl } : dl[it.url] || { downloadable: false, downloadUrl: null };

  const upcoming = (queuePos >= 0 ? queue.slice(queuePos + 1) : queue)
    .map((ii) => ({ item: items[ii], qp: queue.indexOf(ii) }))
    .filter((x) => x.item);

  return (
    <div>
      {/* audio propio (oculto; controlamos con nuestra UI) */}
      <audio
        ref={audioRef}
        preload="none"
        onPlay={() => {
          setPlaying(true);
          setPlaybackError(null);
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        }}
        onPause={() => {
          setPlaying(false);
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
        }}
        onEnded={onEnded}
        onError={onError}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
      />

      {/* ── Filtro por artista (oculto en presskit de un solo artista) ────── */}
      {!hideArtistFilter && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="mono text-[11px] font-black uppercase opacity-60 mr-1">Artista:</span>
          <button
            onClick={() => setFilterArtist('')}
            className={`mono text-[11px] font-black uppercase px-2.5 py-1 brutalist-border ${filterArtist === '' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
          >
            {/* Conteo por track (EPs expandidos) para coordinar con "Próximos". */}
            Todos ({kindCounts.all})
          </button>
          {artists.map((a) => {
            const active = filterArtist === a;
            return (
              <button
                key={a}
                onClick={() => setFilterArtist(active ? '' : a)}
                aria-pressed={active}
                className={`mono text-[11px] font-black uppercase px-2.5 py-1 brutalist-border inline-flex items-center gap-1 ${active ? 'bg-[#FF5500] text-white' : 'bg-white hover:bg-gray-100'}`}
              >
                {a}
                {active && <span aria-hidden className="opacity-80">×</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filtro por tipo (release/set) — solo si conviven ambos ────────── */}
      {hasBothKinds && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="mono text-[11px] font-black uppercase opacity-60 mr-1">Tipo:</span>
          {([
            { k: '', label: `Todos (${kindCounts.all})` },
            { k: 'release', label: `Releases (${kindCounts.release})` },
            { k: 'set', label: `Sets (${kindCounts.set})` },
          ] as const).map(({ k, label }) => {
            const active = filterKind === k;
            return (
              <button
                key={k || 'all'}
                onClick={() => setFilterKind(k)}
                aria-pressed={active}
                className={`mono text-[11px] font-black uppercase px-2.5 py-1 brutalist-border ${
                  active ? 'bg-[#0000ff] text-white' : 'bg-white hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Filtro por descarga (aparte del de artista) ───────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="mono text-[11px] font-black uppercase opacity-60 mr-1">Descarga:</span>
        <button
          onClick={() => setOnlyDl((v) => !v)}
          aria-pressed={onlyDl}
          className={`mono text-[11px] font-black uppercase px-2.5 py-1 brutalist-border inline-flex items-center gap-1 ${onlyDl ? 'bg-[#00b341] text-white' : 'bg-white hover:bg-gray-100'}`}
        >
          <RiDownloadLine className="w-3.5 h-3.5" />
          Solo descargables
          {onlyDl && <span aria-hidden className="opacity-80">×</span>}
        </button>
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-2 xl:grid-cols-[minmax(240px,300px)_1fr_minmax(200px,280px)] lg:gap-4 lg:items-start">
        {/* ── Lista de tracks ──────────────────────────────────────────── */}
        <div className="order-3 lg:order-1 mt-4 lg:mt-0">
          <button
            onClick={() => setListOpen((o) => !o)}
            aria-expanded={listOpen}
            className="lg:hidden w-full flex items-center justify-between px-3 py-2.5 brutalist-border bg-black text-white mono text-xs font-black uppercase mb-2"
          >
            <span>Tracks ({onlyDl ? shownReleaseIdx.size : view.length})</span>
            <RiArrowDownSLine className={`w-5 h-5 transition-transform ${listOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`${listOpen ? 'block' : 'hidden'} lg:block space-y-2 lg:overflow-y-auto lg:pr-1`} style={sideStyle}>
            {view.map((r, vi) => {
              // Con el filtro de descarga, oculta releases sin ningún track descargable.
              if (onlyDl && !shownReleaseIdx.has(vi)) return null;
              const isCurrent = currentReleaseIdx === vi;
              // Un track suelto en curso pinta toda la tarjeta; en un EP NO (solo
              // se resalta el track específico que suena, en la lista anidada).
              const isCurrentSingle = isCurrent && !r.isEp;
              const isExpanded = expanded === r.url;
              const tracks = epTracks[r.url];
              const info = dl[r.url];
              return (
                <div key={`${r.url}-${vi}`} className={`brutalist-border transition-colors ${isCurrentSingle ? 'bg-[#FF5500] text-white' : 'bg-white'}`}>
                  <div className="flex items-stretch">
                    <button
                      onClick={() => (isCurrent ? toggle() : playRelease(vi))}
                      aria-label={isCurrent && playing ? `Pausar ${r.title}` : `Reproducir ${r.title}`}
                      className={`shrink-0 w-12 flex items-center justify-center border-r-4 border-black ${isCurrentSingle ? 'bg-black text-[#FF5500]' : 'bg-[#FF5500] text-white hover:bg-[#e64d00]'}`}
                    >
                      {isCurrent && playing ? <RiPauseFill className="w-6 h-6" /> : <RiPlayFill className="w-6 h-6" />}
                    </button>
                    <div className="flex-1 min-w-0 p-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {/* El tipo declarado por el DJ (kind) manda: un /sets/ marcado
                            como 'set' es un SET, no un EP. Sin kind (p.ej. /releases)
                            cae al comportamiento por isEp. */}
                        {r.kind === 'set' ? (
                          <span className={`mono text-[9px] font-black uppercase px-1.5 py-0.5 ${isCurrentSingle ? 'bg-white text-black' : 'bg-black text-white'}`}>SET</span>
                        ) : r.isEp ? (
                          <span className="mono text-[9px] font-black uppercase bg-[#7C3AED] text-white px-1.5 py-0.5">
                            EP{Array.isArray(tracks) ? ` · ${tracks.length} ${tracks.length === 1 ? 'track' : 'tracks'}` : ''}
                          </span>
                        ) : (
                          <span className={`mono text-[9px] font-black uppercase px-1.5 py-0.5 ${isCurrentSingle ? 'bg-black text-white' : 'bg-[#FF5500] text-white'}`}>RELEASE</span>
                        )}
                        {!r.isEp && info?.downloadable && (
                          <a
                            href={downloadHref(info.downloadUrl, r.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Descargar ${r.title}`}
                            onClick={() => event('release_download_click', { release_title: r.title, gate: info.downloadUrl ? 'externo' : 'nativo' })}
                            className="mono text-[9px] font-black uppercase bg-[#00b341] text-white px-1 py-0.5 inline-flex items-center hover:opacity-80"
                          >
                            <RiDownloadLine className="w-3 h-3" />
                          </a>
                        )}
                        {r.releasedAt && (
                          <span className={`mono text-[9px] font-bold uppercase ml-auto ${isCurrentSingle ? 'opacity-80' : 'opacity-50'}`}>
                            {dayjs(r.releasedAt).format('DD MMM YYYY')}
                          </span>
                        )}
                      </div>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => event('release_open_soundcloud', { release_title: r.title, artist: r.artistName })}
                        className="inline-flex items-start gap-1 text-sm font-black uppercase leading-tight break-words hover:underline"
                      >
                        {r.title}
                        <RiSoundcloudLine className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isCurrentSingle ? 'text-white' : 'text-[#FF5500]'}`} />
                      </a>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={`mono text-[11px] font-bold uppercase truncate ${isCurrentSingle ? 'opacity-90' : 'opacity-70'}`}>
                          {r.slug ? <Link href={`/pk/${r.slug}`} className="hover:underline">{r.artistName}</Link> : r.artistName}
                        </span>
                        {r.isEp && (
                          <button
                            onClick={() => toggleExpand(r.url)}
                            aria-label={isExpanded ? 'Ocultar tracks' : 'Ver tracks del EP'}
                            className={`shrink-0 inline-flex items-center gap-0.5 mono text-[9px] font-black uppercase text-[#7C3AED]`}
                          >
                            Tracks
                            <RiArrowDownSLine className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {r.isEp && isExpanded && (
                    <div className="border-t-4 border-black">
                      {tracks === 'loading' || tracks === undefined ? (
                        <p className="mono text-[11px] uppercase opacity-60 p-2">Cargando tracks…</p>
                      ) : tracks === 'error' ? (
                        <p className="mono text-[11px] uppercase opacity-60 p-2">No se pudieron cargar.</p>
                      ) : tracks.length === 0 ? (
                        <p className="mono text-[11px] uppercase opacity-60 p-2">Sin tracks.</p>
                      ) : (
                        <ul>
                          {(onlyDl ? tracks.filter((t) => t.downloadable) : tracks).map((t, ti) => {
                            const isThis = currentItem && sameUrl(currentItem.url, t.url);
                            return (
                              <li key={t.url} className={`flex items-center gap-1 px-2 border-t border-black/20 ${isThis ? 'bg-[#FF5500] text-white' : ''}`}>
                                <button
                                  onClick={() => (isThis ? toggle() : playTrackUrl(t.url))}
                                  aria-label={`Reproducir ${t.title}`}
                                  className="flex items-center gap-2 py-1.5 text-left flex-1 min-w-0 hover:opacity-70"
                                >
                                  <span className="mono text-[10px] font-black opacity-60 w-5 shrink-0">
                                    {isThis && playing ? <RiPauseFill className="w-3.5 h-3.5" /> : String(ti + 1).padStart(2, '0')}
                                  </span>
                                  <span className="mono text-[11px] font-bold truncate flex-1">{t.title}</span>
                                  {t.durationMs != null && <span className="mono text-[9px] opacity-50 shrink-0">{fmt(t.durationMs)}</span>}
                                </button>
                                {t.downloadable && (
                                  <a href={downloadHref(t.downloadUrl, t.url)} target="_blank" rel="noopener noreferrer" aria-label={`Descargar ${t.title}`} className="shrink-0 p-1 text-[#00b341] hover:opacity-70">
                                    <RiDownloadLine className="w-3.5 h-3.5" />
                                  </a>
                                )}
                                <a href={t.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${t.title} en SoundCloud`} className={`shrink-0 p-1 hover:opacity-70 ${isThis ? 'text-white' : 'text-[#FF5500]'}`}>
                                  <RiSoundcloudLine className="w-3.5 h-3.5" />
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {view.length === 0 && <p className="mono text-xs uppercase opacity-50 p-2">Sin releases de este artista.</p>}
            {view.length > 0 && onlyDl && shownReleaseIdx.size === 0 && (
              <p className="mono text-xs uppercase opacity-50 p-2">Ninguno tiene descarga disponible.</p>
            )}
          </div>
        </div>

        {/* ── Reproductor (centro) ─────────────────────────────────────── */}
        <div ref={playerRef} className="order-1 lg:order-2 lg:sticky lg:top-6 lg:z-20 bg-black text-white brutalist-border brutalist-shadow-soundcloud">
          <div className="flex items-center gap-1.5 p-3 border-b-4 border-[#FF5500]">
            <button
              onClick={() => setShuffle((s) => !s)}
              aria-label="Modo aleatorio"
              aria-pressed={shuffle}
              className={`p-1.5 border-2 ${shuffle ? 'bg-[#FF5500] text-black border-[#FF5500]' : 'border-white/40 hover:bg-white/10'}`}
              title="Aleatorio"
            >
              <RiShuffleLine className="w-4 h-4" />
            </button>
            <button onClick={() => playPrev()} disabled={current < 0} aria-label="Anterior" className="p-1.5 hover:text-[#FF5500] disabled:opacity-30">
              <RiSkipBackFill className="w-5 h-5" />
            </button>
            <button
              onClick={() => (current < 0 ? (queue.length ? playQueue(0) : undefined) : toggle())}
              disabled={items.length === 0}
              aria-label={playing ? 'Pausar' : 'Reproducir'}
              className="w-10 h-10 flex items-center justify-center bg-[#FF5500] text-black hover:bg-white disabled:opacity-30 shrink-0"
            >
              {playing ? <RiPauseFill className="w-6 h-6" /> : <RiPlayFill className="w-6 h-6" />}
            </button>
            <button onClick={() => playNext()} disabled={current < 0} aria-label="Siguiente" className="p-1.5 hover:text-[#FF5500] disabled:opacity-30">
              <RiSkipForwardFill className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex-1 px-1">
              <p className="font-black uppercase text-sm leading-tight truncate">{nowPlaying?.title || 'Elige un track'}</p>
              <p className="mono text-[11px] uppercase opacity-60 truncate">
                {nowPlaying ? `${nowPlaying.artist} · ${fmt(position)} / ${fmt(duration)}` : 'Reproductor de releases'}
              </p>
            </div>

            {currentItem && itemDl(currentItem).downloadable && (
              <a
                href={downloadHref(itemDl(currentItem).downloadUrl, nowPlaying?.permalink || currentItem.url)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Descargar"
                onClick={() => event('release_download_click', { release_title: currentItem.title, gate: itemDl(currentItem).downloadUrl ? 'externo' : 'nativo' })}
                className="p-1.5 text-[#00b341] hover:opacity-70 shrink-0"
              >
                <RiDownloadLine className="w-5 h-5" />
              </a>
            )}
            {nowPlaying?.permalink && (
              <a href={nowPlaying.permalink} target="_blank" rel="noopener noreferrer" aria-label="Abrir en SoundCloud" className="p-1.5 hover:text-[#FF5500] shrink-0">
                <RiSoundcloudLine className="w-5 h-5" />
              </a>
            )}
          </div>

          {/* Barra de progreso (clickeable) */}
          <button
            aria-label="Buscar en la pista"
            className="block w-full h-2 bg-white/15"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const a = audioRef.current;
              if (a && duration) a.currentTime = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * (duration / 1000);
            }}
          >
            <span className="block h-full bg-[#FF5500]" style={{ width: `${progressRatio * 100}%` }} />
          </button>

          {/* Carátula (visual limpio, nuestro) */}
          <div className="relative w-full aspect-square max-h-[240px] sm:max-h-[300px] lg:max-h-[420px] bg-neutral-900 overflow-hidden flex items-center justify-center">
            {artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={artwork} alt="" className="w-full h-full object-cover" />
            ) : (
              <RiSoundcloudLine className="w-16 h-16 text-[#FF5500] opacity-40" />
            )}
            {nowPlaying && !playbackError && (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
                <p className="font-black uppercase text-lg leading-tight break-words">{nowPlaying.title}</p>
                <p className="mono text-xs uppercase opacity-80">{nowPlaying.artist}</p>
              </div>
            )}
            {/* Aviso nativo si el track no se puede reproducir acá (p.ej. solo HLS). */}
            {playbackError && (
              <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center text-center gap-3 p-6">
                <p className="mono text-xs uppercase opacity-80 leading-relaxed">
                  No se pudo reproducir «{playbackError.title}» aquí.
                  <br />
                  Escúchalo en SoundCloud.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <a
                    href={playbackError.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono text-xs font-black uppercase bg-[#FF5500] text-black px-3 py-1.5 inline-flex items-center gap-1 hover:bg-white"
                  >
                    <RiSoundcloudLine className="w-4 h-4" /> Abrir en SoundCloud
                  </a>
                  <button
                    onClick={() => playNext()}
                    className="mono text-xs font-black uppercase border-2 border-white/50 px-3 py-1.5 hover:bg-white/10"
                  >
                    Saltar →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Próximos ─────────────────────────────────────────────────── */}
        <div className="order-2 lg:order-3 lg:col-span-2 xl:col-span-1 mt-4 lg:mt-0 xl:mt-0 brutalist-border bg-white lg:overflow-hidden">
          <button
            onClick={() => setQueueOpen((o) => !o)}
            aria-expanded={queueOpen}
            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 lg:py-2 border-b-4 border-black bg-white"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className="mono text-[11px] font-black uppercase">Próximos ({upcoming.length})</span>
              {shuffle && (
                <span className="mono text-[9px] font-black uppercase bg-[#FF5500] text-white px-1.5 py-0.5 inline-flex items-center gap-1 shrink-0">
                  <RiShuffleLine className="w-3 h-3" /> Aleatorio
                </span>
              )}
            </span>
            <RiArrowDownSLine className={`w-5 h-5 shrink-0 lg:hidden transition-transform ${queueOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`${queueOpen ? 'block' : 'hidden'} lg:block lg:overflow-y-auto`} style={sideStyle}>
            {upcoming.length === 0 ? (
              <p className="mono text-[11px] uppercase opacity-50 p-3">Nada en cola.</p>
            ) : (
              <ul>
                {upcoming.map(({ item, qp }) => (
                  <li key={`up-${qp}-${item.url}`}>
                    <button onClick={() => playQueue(qp)} className="w-full flex items-center gap-2 px-3 py-2 border-t border-black/15 text-left hover:bg-gray-50">
                      {item.isEpTrack && <span className="mono text-[8px] font-black uppercase bg-[#7C3AED] text-white px-1 py-0.5 shrink-0">EP</span>}
                      <span className="min-w-0 flex-1">
                        <span className="block mono text-[11px] font-black uppercase truncate">{item.title}</span>
                        <span className="block mono text-[9px] uppercase opacity-60 truncate">
                          {item.isEpTrack && item.epTitle ? `${item.artist} · ${item.epTitle}` : item.artist}
                        </span>
                      </span>
                      {itemDl(item).downloadable && <RiDownloadLine className="w-3.5 h-3.5 text-[#00b341] shrink-0" />}
                      <RiPlayFill className="w-4 h-4 opacity-30 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

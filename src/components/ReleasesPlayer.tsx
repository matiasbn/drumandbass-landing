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

// ── SoundCloud Widget API ────────────────────────────────────────────────────
const SC_API = 'https://w.soundcloud.com/player/api.js';

interface ScWidget {
  bind(ev: string, cb: (e?: { currentPosition?: number }) => void): void;
  load(url: string, opts: { auto_play?: boolean; visual?: boolean; callback?: () => void }): void;
  play(): void;
  pause(): void;
  toggle(): void;
  seekTo(ms: number): void;
  getDuration(cb: (ms: number) => void): void;
  getCurrentSound(cb: (s: ScSound) => void): void;
}
interface ScSound {
  title?: string;
  permalink_url?: string;
  artwork_url?: string | null;
  user?: { username?: string };
}
type ScGlobal = { Widget: ((el: HTMLIFrameElement) => ScWidget) & { Events: Record<string, string> } };
function scGlobal(): ScGlobal | undefined {
  return (window as unknown as Record<string, unknown>).SC as ScGlobal | undefined;
}
function loadScApi(): Promise<ScGlobal> {
  return new Promise((resolve, reject) => {
    const ready = scGlobal();
    if (ready) return resolve(ready);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SC_API}"]`);
    const onload = () => {
      const sc = scGlobal();
      if (sc) resolve(sc);
      else reject(new Error('SC no cargó'));
    };
    if (existing) {
      existing.addEventListener('load', onload);
      existing.addEventListener('error', () => reject(new Error('SC error')));
      return;
    }
    const s = document.createElement('script');
    s.src = SC_API;
    s.async = true;
    s.onload = onload;
    s.onerror = () => reject(new Error('SC error'));
    document.head.appendChild(s);
  });
}

function playerUrl(trackUrl: string): string {
  return `https://w.soundcloud.com/player/?url=${encodeURIComponent(
    trackUrl
  )}&auto_play=false&visual=true&show_comments=false&hide_related=true`;
}
function fmt(ms: number): string {
  if (!ms || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
function downloadHref(downloadUrl: string | null, fallbackScUrl: string): string {
  return downloadUrl || fallbackScUrl;
}
const sameUrl = (a: string, b: string) => a.split('?')[0] === b.split('?')[0];

interface SetTrack {
  title: string;
  url: string;
  downloadable: boolean;
  downloadUrl: string | null;
  durationMs: number | null;
}
type DlInfo = { downloadable: boolean; downloadUrl: string | null; canonicalUrl?: string | null };

// Unidad reproducible: un track suelto O un track dentro de un EP. La cola opera
// sobre estos ítems, así los tracks de un EP se barajan individualmente (no en
// bloque) y aparecen sueltos en "Próximos".
interface PlayItem {
  url: string;
  title: string;
  artist: string;
  releaseIdx: number; // índice dentro de `view` (para resaltar la tarjeta)
  epTitle: string | null; // nombre del EP si el ítem es un track de EP
  isEpTrack: boolean;
  downloadable: boolean;
  downloadUrl: string | null;
}

// Orden de reproducción (índices de `items`). En shuffle baraja y deja el ítem
// actual al frente; secuencial devuelve el orden natural.
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
export default function ReleasesPlayer({ releases }: { releases: NationalRelease[] }) {
  const [filterArtist, setFilterArtist] = useState<string>('');
  const artists = useMemo(
    () => Array.from(new Set(releases.map((r) => r.artistName))).sort((a, b) => a.localeCompare(b, 'es')),
    [releases]
  );
  const view = useMemo(
    () => (filterArtist ? releases.filter((r) => r.artistName === filterArtist) : releases),
    [releases, filterArtist]
  );

  const [expanded, setExpanded] = useState<string | null>(null);
  const [epTracks, setEpTracks] = useState<Record<string, SetTrack[] | 'loading' | 'error'>>({});
  const [dl, setDl] = useState<Record<string, DlInfo>>({});
  const dlRef = useRef<Record<string, DlInfo>>({});
  dlRef.current = dl;

  const [shuffle, setShuffle] = useState(false);
  const shuffleRef = useRef(false);
  shuffleRef.current = shuffle;

  const [listOpen, setListOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);

  // Ítems reproducibles: cada track suelto y cada track de EP por separado.
  const items = useMemo<PlayItem[]>(() => {
    const out: PlayItem[] = [];
    view.forEach((r, ri) => {
      const tracks = r.isEp ? epTracks[r.url] : undefined;
      if (r.isEp && Array.isArray(tracks) && tracks.length) {
        tracks.forEach((t) =>
          out.push({
            url: t.url,
            title: t.title,
            artist: r.artistName,
            releaseIdx: ri,
            epTitle: r.title,
            isEpTrack: true,
            downloadable: t.downloadable,
            downloadUrl: t.downloadUrl,
          })
        );
      } else {
        // Track suelto (o EP cuya lista aún no cargó → se trata como un ítem).
        out.push({
          url: r.url,
          title: r.title,
          artist: r.artistName,
          releaseIdx: ri,
          epTitle: null,
          isEpTrack: false,
          downloadable: false,
          downloadUrl: null,
        });
      }
    });
    return out;
  }, [view, epTracks]);
  const itemsRef = useRef<PlayItem[]>(items);
  itemsRef.current = items;

  const [queue, setQueue] = useState<number[]>([]);
  const [queuePos, setQueuePos] = useState(-1);
  const queueRef = useRef<number[]>([]);
  const queuePosRef = useRef(-1);
  queueRef.current = queue;
  queuePosRef.current = queuePos;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<ScWidget | null>(null);
  const readyRef = useRef(false);
  const pendingLoadRef = useRef<(() => void) | null>(null);
  const loadedUrlRef = useRef<string | null>(releases[0]?.url ?? null);
  const hasPlayedRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sound, setSound] = useState<{ title: string; artist: string; artwork: string | null; permalink: string } | null>(null);

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

  // Precarga la lista de tracks de TODOS los EPs para poder barajarlos por track.
  useEffect(() => {
    view.forEach((r) => {
      if (r.isEp && epTracks[r.url] === undefined) void loadEp(r.url);
    });
  }, [view, epTracks, loadEp]);

  // Descarga EN VIVO (por release suelto). Los EP traen su descarga por track.
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

  // (Re)construye la cola cuando cambian los ítems (filtro / EP cargado) o el
  // shuffle, manteniendo el ítem en curso.
  useEffect(() => {
    const curIdx = hasPlayedRef.current
      ? items.findIndex((it) => sameUrl(it.url, loadedUrlRef.current || ''))
      : -1;
    const built = buildQueue(items.length, shuffle, curIdx);
    setQueue(built.queue);
    setQueuePos(built.pos);
    queueRef.current = built.queue;
    queuePosRef.current = built.pos;
  }, [items, shuffle]);

  const updateMediaSession = useCallback((s: ScSound) => {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    const art = s.artwork_url || null;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: s.title || '',
        artist: s.user?.username || '',
        album: 'Releases Nacionales · Drum and Bass Chile',
        artwork: art
          ? [
              { src: art.replace('-large', '-t120x120'), sizes: '120x120', type: 'image/jpeg' },
              { src: art.replace('-large', '-t500x500'), sizes: '500x500', type: 'image/jpeg' },
            ]
          : [],
      });
    } catch {
      // MediaMetadata puede no existir.
    }
  }, []);

  const refreshSound = useCallback(() => {
    const w = widgetRef.current;
    if (!w) return;
    w.getCurrentSound((s) => {
      if (!s) return;
      setSound({
        title: s.title || '',
        artist: s.user?.username || '',
        artwork: s.artwork_url ? s.artwork_url.replace('-large', '-t120x120') : null,
        permalink: s.permalink_url || '',
      });
      updateMediaSession(s);
    });
    w.getDuration((ms) => setDuration(ms));
  }, [updateMediaSession]);

  const ensureWidget = useCallback(async (): Promise<ScWidget | null> => {
    if (widgetRef.current) return widgetRef.current;
    if (!iframeRef.current) return null;
    const SC = await loadScApi();
    const w = SC.Widget(iframeRef.current);
    widgetRef.current = w;
    const E = SC.Widget.Events;
    w.bind(E.READY, () => {
      readyRef.current = true;
      if (pendingLoadRef.current) {
        const fn = pendingLoadRef.current;
        pendingLoadRef.current = null;
        fn();
      }
    });
    w.bind(E.PLAY, () => {
      setPlaying(true);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
      refreshSound();
    });
    w.bind(E.PAUSE, () => {
      setPlaying(false);
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    });
    w.bind(E.PLAY_PROGRESS, (e) => {
      if (e?.currentPosition != null) setPosition(e.currentPosition);
    });
    w.bind(E.FINISH, () => nextRef.current());
    if ('mediaSession' in navigator) {
      const ms = navigator.mediaSession;
      ms.setActionHandler('play', () => w.play());
      ms.setActionHandler('pause', () => w.pause());
      ms.setActionHandler('previoustrack', () => prevRef.current());
      ms.setActionHandler('nexttrack', () => nextRef.current());
    }
    return w;
  }, [refreshSound]);

  // Reproduce la posición `qp` de la cola. SÍNCRONO: el load()/play() debe ocurrir
  // dentro del gesto de usuario o SoundCloud bloquea el autoplay (móvil).
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
      const playUrl = dlRef.current[item.url]?.canonicalUrl || item.url;
      const doLoad = () => {
        const w = widgetRef.current;
        if (!w) return;
        if (loadedUrlRef.current && sameUrl(loadedUrlRef.current, playUrl)) {
          w.play();
          refreshSound();
          return;
        }
        loadedUrlRef.current = playUrl;
        w.load(playUrl, {
          auto_play: true,
          visual: true,
          callback: () => {
            w.play();
            refreshSound();
          },
        });
      };
      if (widgetRef.current && readyRef.current) doLoad();
      else {
        pendingLoadRef.current = doLoad;
        void ensureWidget();
      }
    },
    [ensureWidget, refreshSound]
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

  useEffect(() => {
    void ensureWidget();
  }, [ensureWidget]);

  const toggle = useCallback(() => {
    widgetRef.current?.toggle();
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

  const progressRatio = duration ? position / duration : 0;
  const sideStyle = isDesktop && playerHeight ? { maxHeight: playerHeight } : undefined;

  // Info de descarga de un ítem: EP-track la trae en sí; suelto la lee de `dl`.
  const itemDl = (it: PlayItem): DlInfo =>
    it.isEpTrack ? { downloadable: it.downloadable, downloadUrl: it.downloadUrl } : dl[it.url] || { downloadable: false, downloadUrl: null };

  // Próximos: ítems (tracks individuales) después del actual; si no empezó, toda la cola.
  const upcoming = (queuePos >= 0 ? queue.slice(queuePos + 1) : queue)
    .map((ii) => ({ item: items[ii], qp: queue.indexOf(ii) }))
    .filter((x) => x.item);

  return (
    <div>
      {/* ── Filtro por artista ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="mono text-[11px] font-black uppercase opacity-60 mr-1">Artista:</span>
        <button
          onClick={() => setFilterArtist('')}
          className={`mono text-[11px] font-black uppercase px-2.5 py-1 brutalist-border ${filterArtist === '' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'}`}
        >
          Todos ({releases.length})
        </button>
        {artists.map((a) => (
          <button
            key={a}
            onClick={() => setFilterArtist(a)}
            className={`mono text-[11px] font-black uppercase px-2.5 py-1 brutalist-border ${filterArtist === a ? 'bg-[#FF5500] text-white' : 'bg-white hover:bg-gray-100'}`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-2 xl:grid-cols-[minmax(240px,300px)_1fr_minmax(200px,280px)] lg:gap-4 lg:items-start">
        {/* ── Lista de tracks (izquierda en desktop; última en móvil) ───── */}
        <div className="order-3 lg:order-1 mt-4 lg:mt-0">
          <button
            onClick={() => setListOpen((o) => !o)}
            aria-expanded={listOpen}
            className="lg:hidden w-full flex items-center justify-between px-3 py-2.5 brutalist-border bg-black text-white mono text-xs font-black uppercase mb-2"
          >
            <span>Tracks ({view.length})</span>
            <RiArrowDownSLine className={`w-5 h-5 transition-transform ${listOpen ? 'rotate-180' : ''}`} />
          </button>
          <div className={`${listOpen ? 'block' : 'hidden'} lg:block space-y-2 lg:overflow-y-auto lg:pr-1`} style={sideStyle}>
            {view.map((r, vi) => {
              const isCurrent = currentReleaseIdx === vi;
              const isExpanded = expanded === r.url;
              const tracks = epTracks[r.url];
              const info = dl[r.url];
              return (
                <div key={`${r.url}-${vi}`} className={`brutalist-border transition-colors ${isCurrent ? 'bg-[#FF5500] text-white' : 'bg-white'}`}>
                  <div className="flex items-stretch">
                    <button
                      onClick={() => (isCurrent ? toggle() : playRelease(vi))}
                      aria-label={isCurrent && playing ? `Pausar ${r.title}` : `Reproducir ${r.title}`}
                      className={`shrink-0 w-12 flex items-center justify-center border-r-4 border-black ${isCurrent ? 'bg-black text-[#FF5500]' : 'bg-[#FF5500] text-white hover:bg-[#e64d00]'}`}
                    >
                      {isCurrent && playing ? <RiPauseFill className="w-6 h-6" /> : <RiPlayFill className="w-6 h-6" />}
                    </button>
                    <div className="flex-1 min-w-0 p-3">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {r.isEp ? (
                          <span className="mono text-[9px] font-black uppercase bg-[#7C3AED] text-white px-1.5 py-0.5">EP</span>
                        ) : (
                          <span className={`mono text-[9px] font-black uppercase px-1.5 py-0.5 ${isCurrent ? 'bg-black text-white' : 'bg-[#FF5500] text-white'}`}>RELEASE</span>
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
                          <span className={`mono text-[9px] font-bold uppercase ml-auto ${isCurrent ? 'opacity-80' : 'opacity-50'}`}>
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
                        <RiSoundcloudLine className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${isCurrent ? 'text-white' : 'text-[#FF5500]'}`} />
                      </a>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className={`mono text-[11px] font-bold uppercase truncate ${isCurrent ? 'opacity-90' : 'opacity-70'}`}>
                          {r.slug ? <Link href={`/pk/${r.slug}`} className="hover:underline">{r.artistName}</Link> : r.artistName}
                        </span>
                        {r.isEp && (
                          <button
                            onClick={() => toggleExpand(r.url)}
                            aria-label={isExpanded ? 'Ocultar tracks' : 'Ver tracks del EP'}
                            className={`shrink-0 inline-flex items-center gap-0.5 mono text-[9px] font-black uppercase ${isCurrent ? 'text-white' : 'text-[#7C3AED]'}`}
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
                          {tracks.map((t, ti) => {
                            const isThis = currentItem && sameUrl(currentItem.url, t.url);
                            return (
                              <li key={t.url} className={`flex items-center gap-1 px-2 border-t border-black/20 ${isCurrent ? 'text-white' : ''}`}>
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
                                <a href={t.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${t.title} en SoundCloud`} className={`shrink-0 p-1 ${isCurrent ? 'text-white hover:opacity-70' : 'text-[#FF5500] hover:opacity-70'}`}>
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
          </div>
        </div>

        {/* ── Reproductor (centro) ─────────────────────────────────────── */}
        <div ref={playerRef} className="order-1 lg:order-2 lg:sticky lg:top-6 lg:z-20 bg-white brutalist-border brutalist-shadow-soundcloud">
          <div className="flex items-center gap-1.5 p-3 border-b-4 border-black">
            <button
              onClick={() => setShuffle((s) => !s)}
              aria-label="Modo aleatorio"
              aria-pressed={shuffle}
              className={`p-1.5 border-2 border-black ${shuffle ? 'bg-[#FF5500] text-black' : 'bg-white hover:bg-gray-100'}`}
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
              className="w-10 h-10 flex items-center justify-center bg-[#FF5500] text-black hover:bg-black hover:text-[#FF5500] disabled:opacity-30 shrink-0"
            >
              {playing ? <RiPauseFill className="w-6 h-6" /> : <RiPlayFill className="w-6 h-6" />}
            </button>
            <button onClick={() => playNext()} disabled={current < 0} aria-label="Siguiente" className="p-1.5 hover:text-[#FF5500] disabled:opacity-30">
              <RiSkipForwardFill className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex-1 px-1">
              <p className="font-black uppercase text-sm leading-tight truncate">{sound?.title || currentItem?.title || 'Elige un track'}</p>
              <p className="mono text-[11px] uppercase opacity-60 truncate">
                {sound ? `${sound.artist} · ${fmt(position)} / ${fmt(duration)}` : 'Reproductor de releases'}
              </p>
            </div>

            {currentItem && itemDl(currentItem).downloadable && (
              <a
                href={downloadHref(itemDl(currentItem).downloadUrl, sound?.permalink || currentItem.url)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Descargar"
                onClick={() => event('release_download_click', { release_title: currentItem.title, gate: itemDl(currentItem).downloadUrl ? 'externo' : 'nativo' })}
                className="p-1.5 text-[#00b341] hover:opacity-70 shrink-0"
              >
                <RiDownloadLine className="w-5 h-5" />
              </a>
            )}
            {sound?.permalink && (
              <a href={sound.permalink} target="_blank" rel="noopener noreferrer" aria-label="Abrir en SoundCloud" className="p-1.5 hover:text-[#FF5500] shrink-0">
                <RiSoundcloudLine className="w-5 h-5" />
              </a>
            )}
          </div>

          <button
            aria-label="Buscar en la pista"
            className="block w-full h-1.5 bg-black/10"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const w = widgetRef.current;
              if (w && duration) w.seekTo(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * duration);
            }}
          >
            <span className="block h-full bg-[#FF5500]" style={{ width: `${progressRatio * 100}%` }} />
          </button>

          <iframe
            ref={iframeRef}
            title="Reproductor de SoundCloud"
            src={releases[0] ? playerUrl(releases[0].url) : undefined}
            allow="autoplay; encrypted-media"
            className="block w-full h-[200px] sm:h-[280px] lg:h-[360px] xl:h-[400px] border-0"
          />
        </div>

        {/* ── Próximos (derecha en desktop; antes de la lista en móvil) ─── */}
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

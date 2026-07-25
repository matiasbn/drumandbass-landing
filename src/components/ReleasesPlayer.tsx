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
  skip(index: number): void;
  getDuration(cb: (ms: number) => void): void;
  getCurrentSound(cb: (s: ScSound) => void): void;
  getCurrentSoundIndex(cb: (i: number) => void): void;
  getSounds(cb: (s: ScSound[]) => void): void;
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

interface SetTrack {
  title: string;
  url: string;
  downloadable: boolean;
  downloadUrl: string | null;
  durationMs: number | null;
}
type DlInfo = { downloadable: boolean; downloadUrl: string | null; canonicalUrl?: string | null };

// Construye el orden de reproducción (índices de `view`). En shuffle, baraja y
// deja el track actual al frente; secuencial devuelve el orden natural.
function buildQueue(len: number, shuffle: boolean, currentViewIdx: number): { queue: number[]; pos: number } {
  const idxs = Array.from({ length: len }, (_, i) => i);
  if (!shuffle) return { queue: idxs, pos: currentViewIdx };
  for (let i = idxs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idxs[i], idxs[j]] = [idxs[j], idxs[i]];
  }
  if (currentViewIdx >= 0) {
    const at = idxs.indexOf(currentViewIdx);
    if (at > 0) {
      idxs.splice(at, 1);
      idxs.unshift(currentViewIdx);
    }
    return { queue: idxs, pos: 0 };
  }
  return { queue: idxs, pos: -1 };
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function ReleasesPlayer({ releases }: { releases: NationalRelease[] }) {
  // Filtro por artista.
  const [filterArtist, setFilterArtist] = useState<string>('');
  const artists = useMemo(
    () => Array.from(new Set(releases.map((r) => r.artistName))).sort((a, b) => a.localeCompare(b, 'es')),
    [releases]
  );
  const view = useMemo(
    () => (filterArtist ? releases.filter((r) => r.artistName === filterArtist) : releases),
    [releases, filterArtist]
  );
  const viewRef = useRef(view);
  viewRef.current = view;

  // Cola de reproducción (orden). El shuffle se refleja acá y en la lista de "próximos".
  const [shuffle, setShuffle] = useState(false);
  const shuffleRef = useRef(false);
  shuffleRef.current = shuffle;
  const [queue, setQueue] = useState<number[]>([]);
  const [queuePos, setQueuePos] = useState(-1);
  const queueRef = useRef<number[]>([]);
  const queuePosRef = useRef(-1);
  queueRef.current = queue;
  queuePosRef.current = queuePos;

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const widgetRef = useRef<ScWidget | null>(null);
  const indexRef = useRef(-1); // view index en curso
  const readyRef = useRef(false);
  const pendingLoadRef = useRef<(() => void) | null>(null);
  const loadedUrlRef = useRef<string | null>(releases[0]?.url ?? null);
  const hasPlayedRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [sound, setSound] = useState<{
    title: string;
    artist: string;
    artwork: string | null;
    permalink: string;
  } | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [epTracks, setEpTracks] = useState<Record<string, SetTrack[] | 'loading' | 'error'>>({});
  const [dl, setDl] = useState<Record<string, DlInfo>>({});
  const dlRef = useRef<Record<string, DlInfo>>({});
  dlRef.current = dl;

  const current = queuePos >= 0 && queue[queuePos] != null ? queue[queuePos] : -1;
  const currentRelease = current >= 0 ? view[current] : null;
  indexRef.current = current;

  const nextReleaseRef = useRef<() => void>(() => {});
  const nextRef = useRef<() => void>(() => {});
  const prevRef = useRef<() => void>(() => {});

  // Alto del player para igualar la altura de las columnas laterales (desktop).
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

  // Descarga EN VIVO desde SoundCloud (no de la DB), por release, cacheada en el edge.
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

  // (Re)construye la cola cuando cambia el filtro o el shuffle, manteniendo el
  // track en curso. Se ejecuta también en el montaje (orden inicial).
  useEffect(() => {
    const curIdx = hasPlayedRef.current
      ? view.findIndex((r) => r.url === loadedUrlRef.current)
      : -1;
    const built = buildQueue(view.length, shuffle, curIdx);
    setQueue(built.queue);
    setQueuePos(built.pos);
    queueRef.current = built.queue;
    queuePosRef.current = built.pos;
  }, [view, shuffle]);

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
    w.bind(E.FINISH, () => {
      w.getSounds((sounds) => {
        w.getCurrentSoundIndex((idx) => {
          if (sounds.length > 1 && idx < sounds.length - 1) return; // el set sigue solo
          nextReleaseRef.current();
        });
      });
    });
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
  // dentro del gesto de usuario o SoundCloud bloquea el autoplay.
  const playQueue = useCallback(
    (qp: number, skipTo?: number) => {
      const q = queueRef.current;
      const vi = q[qp];
      const rel = vi != null ? viewRef.current[vi] : undefined;
      if (!rel) return;
      hasPlayedRef.current = true;
      setQueuePos(qp);
      queuePosRef.current = qp;
      indexRef.current = vi;
      setPosition(0);
      event('release_play', { release_title: rel.title, artist: rel.artistName });
      // Reproduce la URL canónica cuando la tenemos (del endpoint en vivo): así un
      // link corto on.soundcloud.com de la DB no rompe el widget.
      const playUrl = dlRef.current[rel.url]?.canonicalUrl || rel.url;
      const doLoad = () => {
        const w = widgetRef.current;
        if (!w) return;
        if (loadedUrlRef.current === playUrl && typeof skipTo !== 'number') {
          w.play();
          refreshSound();
          return;
        }
        loadedUrlRef.current = playUrl;
        w.load(playUrl, {
          auto_play: true,
          visual: true,
          callback: () => {
            if (typeof skipTo === 'number') w.skip(skipTo);
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

  // Reproduce por índice de `view` (click en la lista): ubica su posición en la cola.
  const playViewIdx = useCallback(
    (vi: number, skipTo?: number) => {
      const qp = queueRef.current.indexOf(vi);
      if (qp >= 0) playQueue(qp, skipTo);
    },
    [playQueue]
  );

  const nextRelease = useCallback(() => {
    if (queuePosRef.current < queueRef.current.length - 1) playQueue(queuePosRef.current + 1);
  }, [playQueue]);
  nextReleaseRef.current = nextRelease;
  const prevRelease = useCallback(() => {
    if (queuePosRef.current > 0) playQueue(queuePosRef.current - 1);
  }, [playQueue]);

  // Siguiente/anterior EP-aware: dentro de un EP recorre sus tracks; al borde salta de release.
  const playNext = useCallback(() => {
    const w = widgetRef.current;
    const rel = viewRef.current[indexRef.current];
    if (w && rel?.isEp) {
      w.getSounds((sounds) =>
        w.getCurrentSoundIndex((si) => {
          if (sounds.length > 1 && si < sounds.length - 1) {
            w.skip(si + 1);
            refreshSound();
          } else nextRelease();
        })
      );
    } else nextRelease();
  }, [nextRelease, refreshSound]);
  const playPrev = useCallback(() => {
    const w = widgetRef.current;
    const rel = viewRef.current[indexRef.current];
    if (w && rel?.isEp) {
      w.getSounds((sounds) =>
        w.getCurrentSoundIndex((si) => {
          if (sounds.length > 1 && si > 0) {
            w.skip(si - 1);
            refreshSound();
          } else prevRelease();
        })
      );
    } else prevRelease();
  }, [prevRelease, refreshSound]);
  nextRef.current = playNext;
  prevRef.current = playPrev;

  useEffect(() => {
    void ensureWidget();
  }, [ensureWidget]);

  const toggle = useCallback(() => {
    widgetRef.current?.toggle();
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

  // Atajos de teclado: espacio = play/pausa, ← / → = anterior/siguiente.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (current < 0) return;
      const t = e.target as HTMLElement;
      if (t?.closest('input,textarea,select,a,button')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggle();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        playNext();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        playPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, toggle, playNext, playPrev]);

  const progressRatio = duration ? position / duration : 0;
  const sideStyle = isDesktop && playerHeight ? { maxHeight: playerHeight } : undefined;

  // Próximos en la cola (después del actual). Si no empezó, muestra toda la cola.
  const upcoming = (queuePos >= 0 ? queue.slice(queuePos + 1) : queue)
    .map((vi) => ({ rel: view[vi], qp: queue.indexOf(vi) }))
    .filter((x) => x.rel);

  const dlOf = (url: string): DlInfo | undefined => dl[url];

  return (
    <div>
      {/* ── Filtro por artista ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <span className="mono text-[11px] font-black uppercase opacity-60 mr-1">Artista:</span>
        <button
          onClick={() => setFilterArtist('')}
          className={`mono text-[11px] font-black uppercase px-2.5 py-1 brutalist-border ${
            filterArtist === '' ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
          }`}
        >
          Todos ({releases.length})
        </button>
        {artists.map((a) => (
          <button
            key={a}
            onClick={() => setFilterArtist(a)}
            className={`mono text-[11px] font-black uppercase px-2.5 py-1 brutalist-border ${
              filterArtist === a ? 'bg-[#FF5500] text-white' : 'bg-white hover:bg-gray-100'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:grid lg:grid-cols-2 xl:grid-cols-[minmax(240px,300px)_1fr_minmax(200px,280px)] lg:gap-4 lg:items-start">
        {/* ── Lista de tracks (izquierda) ──────────────────────────────── */}
        <div
          className="lg:overflow-y-auto lg:pr-1 order-2 lg:order-1 space-y-2 mt-4 lg:mt-0"
          style={sideStyle}
        >
          {view.map((r) => {
            const i = releases.indexOf(r); // índice estable para keys
            const vi = view.indexOf(r);
            const isCurrent = vi === current;
            const isExpanded = expanded === r.url;
            const tracks = epTracks[r.url];
            const info = dlOf(r.url);
            return (
              <div
                key={`${r.url}-${i}`}
                className={`brutalist-border transition-colors ${isCurrent ? 'bg-[#FF5500] text-white' : 'bg-white'}`}
              >
                <div className="flex items-stretch">
                  <button
                    onClick={() => (isCurrent ? toggle() : playViewIdx(vi))}
                    aria-label={isCurrent && playing ? `Pausar ${r.title}` : `Reproducir ${r.title}`}
                    className={`shrink-0 w-12 flex items-center justify-center border-r-4 border-black ${
                      isCurrent ? 'bg-black text-[#FF5500]' : 'bg-[#FF5500] text-white hover:bg-[#e64d00]'
                    }`}
                  >
                    {isCurrent && playing ? <RiPauseFill className="w-6 h-6" /> : <RiPlayFill className="w-6 h-6" />}
                  </button>
                  <div className="flex-1 min-w-0 p-3">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {r.isEp ? (
                        <span className="mono text-[9px] font-black uppercase bg-[#7C3AED] text-white px-1.5 py-0.5">EP</span>
                      ) : (
                        <span className={`mono text-[9px] font-black uppercase px-1.5 py-0.5 ${isCurrent ? 'bg-black text-white' : 'bg-[#FF5500] text-white'}`}>
                          RELEASE
                        </span>
                      )}
                      {info?.downloadable && (
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
                        {r.slug ? (
                          <Link href={`/pk/${r.slug}`} className="hover:underline">{r.artistName}</Link>
                        ) : (
                          r.artistName
                        )}
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
                          const isThis =
                            isCurrent && sound?.permalink && t.url && sound.permalink.split('?')[0] === t.url.split('?')[0];
                          return (
                            <li key={t.url} className={`flex items-center gap-1 px-2 border-t border-black/20 ${isCurrent ? 'text-white' : ''}`}>
                              <button
                                onClick={() => playViewIdx(vi, ti)}
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
                                <a
                                  href={downloadHref(t.downloadUrl, t.url)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`Descargar ${t.title}`}
                                  className="shrink-0 p-1 text-[#00b341] hover:opacity-70"
                                >
                                  <RiDownloadLine className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <a
                                href={t.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Abrir ${t.title} en SoundCloud`}
                                className={`shrink-0 p-1 ${isCurrent ? 'text-white hover:opacity-70' : 'text-[#FF5500] hover:opacity-70'}`}
                              >
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

        {/* ── Reproductor (centro) ─────────────────────────────────────── */}
        <div
          ref={playerRef}
          className="order-1 lg:order-2 lg:sticky lg:top-6 sticky top-16 z-20 bg-white brutalist-border brutalist-shadow-soundcloud"
        >
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
              disabled={view.length === 0}
              aria-label={playing ? 'Pausar' : 'Reproducir'}
              className="w-10 h-10 flex items-center justify-center bg-[#FF5500] text-black hover:bg-black hover:text-[#FF5500] disabled:opacity-30 shrink-0"
            >
              {playing ? <RiPauseFill className="w-6 h-6" /> : <RiPlayFill className="w-6 h-6" />}
            </button>
            <button onClick={() => playNext()} disabled={current < 0} aria-label="Siguiente" className="p-1.5 hover:text-[#FF5500] disabled:opacity-30">
              <RiSkipForwardFill className="w-5 h-5" />
            </button>

            <div className="min-w-0 flex-1 px-1">
              <p className="font-black uppercase text-sm leading-tight truncate">{sound?.title || 'Elige un track'}</p>
              <p className="mono text-[11px] uppercase opacity-60 truncate">
                {sound ? `${sound.artist} · ${fmt(position)} / ${fmt(duration)}` : 'Reproductor de releases'}
              </p>
            </div>

            {currentRelease && dlOf(currentRelease.url)?.downloadable && (
              <a
                href={downloadHref(dlOf(currentRelease.url)!.downloadUrl, sound?.permalink || currentRelease.url)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Descargar"
                onClick={() => event('release_download_click', { release_title: sound?.title || '', gate: dlOf(currentRelease.url)!.downloadUrl ? 'externo' : 'nativo' })}
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
            allow="autoplay"
            className="block w-full h-[200px] sm:h-[280px] lg:h-[360px] xl:h-[400px] border-0"
          />
        </div>

        {/* ── Próximos (derecha) ───────────────────────────────────────── */}
        <div
          className="order-3 lg:col-span-2 xl:col-span-1 mt-4 xl:mt-0 lg:overflow-y-auto brutalist-border bg-white"
          style={sideStyle}
        >
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b-4 border-black sticky top-0 bg-white">
            <span className="mono text-[11px] font-black uppercase">Próximos</span>
            {shuffle && (
              <span className="mono text-[9px] font-black uppercase bg-[#FF5500] text-white px-1.5 py-0.5 inline-flex items-center gap-1">
                <RiShuffleLine className="w-3 h-3" /> Aleatorio
              </span>
            )}
          </div>
          {upcoming.length === 0 ? (
            <p className="mono text-[11px] uppercase opacity-50 p-3">Nada en cola.</p>
          ) : (
            <ul>
              {upcoming.map(({ rel, qp }) => (
                <li key={`up-${rel.url}`}>
                  <button
                    onClick={() => playQueue(qp)}
                    className="w-full flex items-center gap-2 px-3 py-2 border-t border-black/15 text-left hover:bg-gray-50"
                  >
                    {rel.isEp && <span className="mono text-[8px] font-black uppercase bg-[#7C3AED] text-white px-1 py-0.5 shrink-0">EP</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block mono text-[11px] font-black uppercase truncate">{rel.title}</span>
                      <span className="block mono text-[9px] uppercase opacity-60 truncate">{rel.artistName}</span>
                    </span>
                    {dlOf(rel.url)?.downloadable && <RiDownloadLine className="w-3.5 h-3.5 text-[#00b341] shrink-0" />}
                    <RiPlayFill className="w-4 h-4 opacity-30 shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RiPlayFill, RiPauseFill, RiVolumeMuteLine, RiSkipBackFill, RiSkipForwardFill, RiShuffleLine } from '@remixicon/react';
import { usePlayback } from '../PlaybackContext';

declare global {
  interface Window {
    SC: {
      Widget: {
        (iframe: HTMLIFrameElement): SCWidget;
        Events: {
          READY: string;
          PLAY: string;
          PAUSE: string;
          FINISH: string;
          PLAY_PROGRESS: string;
        };
      };
    };
  }
}

interface SCWidget {
  bind: (event: string, callback: (data?: unknown) => void) => void;
  play: () => void;
  pause: () => void;
  skip: (index: number) => void;
  next: () => void;
  prev: () => void;
  seekTo: (milliseconds: number) => void;
  setVolume: (volume: number) => void;
  getVolume: (callback: (volume: number) => void) => void;
  getDuration: (callback: (duration: number) => void) => void;
  getPosition: (callback: (position: number) => void) => void;
  getSounds: (callback: (sounds: Array<{ title: string; user: { username: string } }>) => void) => void;
  getCurrentSoundIndex: (callback: (index: number) => void) => void;
  getCurrentSound: (callback: (sound: { title: string; user: { username: string }; duration: number }) => void) => void;
  isPaused: (callback: (paused: boolean) => void) => void;
}

const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioPlayer: React.FC = () => {
  const { setIsPlaying, setTrackTitle: setContextTrackTitle, registerTogglePlay } = usePlayback();
  const [localIsPlaying, setLocalIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackTitle, setTrackTitle] = useState('Loading...');
  const [artistName, setArtistName] = useState('');
  const [isShuffled, setIsShuffled] = useState(true);
  const [trackCount, setTrackCount] = useState(0);
  const widgetRef = useRef<SCWidget | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const shuffleRef = useRef(true);
  const trackCountRef = useRef(0);
  const lastProgressUpdateRef = useRef(0);

  const updatePlayState = useCallback((playing: boolean) => {
    setLocalIsPlaying(playing);
    setIsPlaying(playing);
  }, [setIsPlaying]);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://w.soundcloud.com/player/api.js';
    script.onload = () => {
      if (iframeRef.current && window.SC) {
        const widget = window.SC.Widget(iframeRef.current);
        widgetRef.current = widget;

        widget.bind(window.SC.Widget.Events.READY, () => {
          widget.setVolume(70);
          widget.getSounds((sounds) => {
            const count = sounds?.length || 0;
            setTrackCount(count);
            trackCountRef.current = count;
            if (count > 1) {
              const randomIndex = Math.floor(Math.random() * count);
              widget.skip(randomIndex);
            }
          });
          widget.getCurrentSound((sound) => {
            if (sound) {
              setTrackTitle(sound.title || 'Unknown Track');
              setArtistName(sound.user?.username || '');
              setDuration(sound.duration || 0);
            }
          });
          setIsReady(true);
        });

        widget.bind(window.SC.Widget.Events.PLAY, () => {
          updatePlayState(true);
          widget.getCurrentSound((sound) => {
            if (sound) {
              setTrackTitle(sound.title || 'Unknown Track');
              setArtistName(sound.user?.username || '');
              setDuration(sound.duration || 0);
            }
          });
        });

        widget.bind(window.SC.Widget.Events.PAUSE, () => {
          updatePlayState(false);
        });

        widget.bind(window.SC.Widget.Events.FINISH, () => {
          if (shuffleRef.current && trackCountRef.current > 1) {
            const randomIndex = Math.floor(Math.random() * trackCountRef.current);
            widget.skip(randomIndex);
          } else {
            widget.next();
          }
        });

        widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (data: unknown) => {
          const now = Date.now();
          if (now - lastProgressUpdateRef.current < 100) return;
          lastProgressUpdateRef.current = now;

          const progressData = data as { currentPosition: number; relativePosition: number };
          setCurrentTime(progressData.currentPosition);
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [updatePlayState]);

  const togglePlay = useCallback(() => {
    if (!widgetRef.current || !isReady) return;
    if (localIsPlaying) {
      widgetRef.current.pause();
    } else {
      widgetRef.current.play();
    }
  }, [isReady, localIsPlaying]);

  // Sync track title and togglePlay to context
  useEffect(() => {
    setContextTrackTitle(trackTitle);
  }, [trackTitle, setContextTrackTitle]);

  useEffect(() => {
    registerTogglePlay(togglePlay);
  }, [togglePlay, registerTogglePlay]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!widgetRef.current || !isReady || !progressRef.current || duration === 0) return;

    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const seekTime = percentage * duration;

    widgetRef.current.seekTo(seekTime);
    setCurrentTime(seekTime);
  };

  const skipBack = () => {
    if (!widgetRef.current || !isReady) return;
    widgetRef.current.prev();
  };

  const skipForward = () => {
    if (!widgetRef.current || !isReady) return;
    if (isShuffled && trackCount > 1) {
      const randomIndex = Math.floor(Math.random() * trackCount);
      widgetRef.current.skip(randomIndex);
    } else {
      widgetRef.current.next();
    }
  };

  const toggleShuffle = () => {
    const newShuffled = !isShuffled;
    setIsShuffled(newShuffled);
    shuffleRef.current = newShuffled;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const soundcloudUrl = 'https://soundcloud.com/drum-and-bass-chile';
  const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(soundcloudUrl)}&color=%23ff0055&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=true&show_teaser=false&visual=false`;

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden SoundCloud player */}
      <iframe
        ref={iframeRef}
        id="sc-player"
        width="100%"
        height="166"
        scrolling="no"
        frameBorder="no"
        allow="autoplay"
        src={embedUrl}
        style={{ position: 'absolute', top: -9999, left: -9999 }}
      />

      {/* Main player container */}
      <div className={`
        bg-black/70 backdrop-blur border min-w-[280px]
        ${localIsPlaying ? 'border-[#00ff41]/40' : 'border-[#ff0055]/40'}
        transition-colors
      `}>
        {/* Track info header */}
        <div className="px-3 pt-3 pb-1 border-b border-white/5">
          <div className="text-xs text-white/90 font-medium truncate" title={trackTitle}>
            {trackTitle.length > 35 ? trackTitle.substring(0, 35) + '...' : trackTitle}
          </div>
          {artistName && (
            <div className="text-[10px] text-white/50 truncate">{artistName}</div>
          )}
        </div>

        {/* Transport bar */}
        <div className="px-3 pt-2 pb-2">
          <div
            ref={progressRef}
            onClick={handleSeek}
            className="relative h-2 bg-white/10 cursor-pointer group"
          >
            <div
              className={`absolute top-0 left-0 h-full transition-all ${
                localIsPlaying ? 'bg-[#00ff41]' : 'bg-[#ff0055]'
              }`}
              style={{ width: `${progress}%` }}
            />
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${
                localIsPlaying ? 'bg-[#00ff41]' : 'bg-[#ff0055]'
              }`}
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          <div className="flex justify-between mt-1 text-[10px] font-mono text-white/50">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 px-3 pb-3">
          <button
            onClick={skipBack}
            disabled={!isReady}
            className="p-2 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
            title="Previous track"
          >
            <RiSkipBackFill className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!isReady}
            className={`
              w-10 h-10 rounded-full flex items-center justify-center
              ${localIsPlaying ? 'bg-[#00ff41]/20 border border-[#00ff41]' : 'bg-[#ff0055]/20 border border-[#ff0055]'}
              hover:scale-105 transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            {localIsPlaying ? (
              <RiPauseFill className="w-5 h-5 text-[#00ff41]" />
            ) : (
              <RiPlayFill className="w-5 h-5 text-[#ff0055] ml-0.5" />
            )}
          </button>

          <button
            onClick={skipForward}
            disabled={!isReady}
            className="p-2 text-white/60 hover:text-white disabled:opacity-30 transition-colors"
            title="Next track"
          >
            <RiSkipForwardFill className="w-4 h-4" />
          </button>

          <button
            onClick={toggleShuffle}
            disabled={!isReady}
            className={`
              p-2 transition-colors disabled:opacity-30
              ${isShuffled ? 'text-[#00ff41]' : 'text-white/40 hover:text-white/60'}
            `}
            title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
          >
            <RiShuffleLine className="w-4 h-4" />
          </button>

          <div className="flex flex-col items-start ml-1">
            <span className="text-[10px] text-white/40 uppercase tracking-wider">
              {isReady ? (localIsPlaying ? 'PLAYING' : 'PAUSED') : 'LOADING...'}
            </span>
            <span className="text-[10px] text-[#ff5500] flex items-center gap-1">
              <RiVolumeMuteLine className="w-3 h-3" />
              SOUNDCLOUD
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

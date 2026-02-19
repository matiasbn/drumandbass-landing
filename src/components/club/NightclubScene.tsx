'use client';

import React, { useState } from 'react';
import { RiLogoutBoxLine, RiPlayFill, RiPauseFill, RiArrowDownSLine, RiArrowUpSLine, RiUserLine } from '@remixicon/react';
import { NightclubCanvas } from './NightclubCanvas';
import { AudioPlayer } from './components/AudioPlayer';
import { Chat } from './components/Chat';
import { MobileControls } from './components/MobileControls';
import { PlaybackProvider, usePlayback } from './PlaybackContext';
import { MultiplayerProvider } from './MultiplayerContext';
import { LiveProvider, useLive } from './LiveContext';
import { useAuth } from './AuthContext';

const MobilePlayerToggle: React.FC<{ open: boolean; onToggle: () => void }> = ({ open, onToggle }) => {
  const { isPlaying, trackTitle, togglePlay } = usePlayback();
  const color = isPlaying ? '#00ff41' : '#ff0055';

  return (
    <div
      className="flex items-stretch bg-black/60 backdrop-blur border font-mono text-xs tracking-wider transition-colors overflow-hidden"
      style={{ borderColor: `${color}66`, width: 220 }}
    >
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="flex items-center justify-center px-2.5 border-r transition-colors"
        style={{ borderColor: `${color}33`, color }}
      >
        {isPlaying ? <RiPauseFill className="w-4 h-4" /> : <RiPlayFill className="w-4 h-4" />}
      </button>

      {/* Track info + expand toggle */}
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2.5 py-2 min-w-0 flex-1"
        style={{ color }}
      >
        <div className="flex-1 min-w-0 marquee-container">
          {isPlaying ? (
            <div className="marquee-content">
              {trackTitle}&nbsp;&nbsp;&bull;&nbsp;&nbsp;{trackTitle}&nbsp;&nbsp;&bull;&nbsp;&nbsp;
            </div>
          ) : (
            <div className="truncate opacity-70">PAUSED</div>
          )}
        </div>
        {open ? <RiArrowUpSLine className="w-4 h-4 shrink-0" /> : <RiArrowDownSLine className="w-4 h-4 shrink-0" />}
      </button>
    </div>
  );
};

const YouTubePanel: React.FC<{ videoId: string; title: string | null }> = ({ videoId, title }) => (
  <div data-testid="youtube-panel" className="absolute top-16 right-4 z-20 w-[340px] md:w-[400px]">
    <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
      <iframe
        src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
        className="absolute inset-0 w-full h-full border border-red-500/40"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
    {title && (
      <div className="px-2 py-1 bg-black/80 backdrop-blur border border-t-0 border-red-500/30 font-mono text-[10px] text-red-400 flex items-center gap-2">
        <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        LIVE: {title}
      </div>
    )}
  </div>
);

const NightclubSceneInner: React.FC = () => {
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const { profile, signOut } = useAuth();
  const { isLive, youtubeVideoId, liveTitle } = useLive();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <PlaybackProvider>
      <div className="relative w-full h-screen bg-black">
        {/* Navigation overlay */}
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur border border-white/20 text-white font-mono text-sm hover:bg-white/10 hover:border-white/40 transition-all"
          >
            <RiLogoutBoxLine className="w-4 h-4" />
            SALIR
          </button>
          {profile && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-black/50 backdrop-blur border border-[#00ff41]/30 text-[#00ff41] font-mono text-xs">
              <RiUserLine className="w-3 h-3" />
              @{profile.username}
            </div>
          )}
        </div>

        {/* YouTube live panel - picture in picture style */}
        {isLive && youtubeVideoId && (
          <YouTubePanel videoId={youtubeVideoId} title={liveTitle} />
        )}

        {/* Audio player - desktop: bottom left, above controls hint (hidden when live) */}
        {!isLive && (
          <div className="absolute bottom-24 left-4 z-10 hidden md:block">
            <AudioPlayer />
          </div>
        )}

        {/* Mobile: mini player toggle + collapsible player at top right (hidden when live) */}
        {!isLive && (
          <div className="absolute top-4 right-4 z-10 md:hidden flex flex-col items-end">
            <MobilePlayerToggle open={mobilePlayerOpen} onToggle={() => setMobilePlayerOpen(o => !o)} />
            <div className={mobilePlayerOpen ? 'mt-2' : 'hidden'}>
              <AudioPlayer />
            </div>
          </div>
        )}

        {/* Controls hint - desktop: bottom left */}
        <div className="absolute bottom-4 left-4 z-10 hidden md:block">
          <div className="px-3 py-1.5 bg-black/50 backdrop-blur border border-white/10 text-white/60 font-mono text-[10px] space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#00ff41]" />
              ARRASTRA PARA ROTAR &bull; SCROLL PARA ZOOM
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#ffff00]" />
              FLECHAS PARA MOVER
            </div>
          </div>
        </div>

        {/* Mobile touch controls */}
        <MobileControls />

        {/* 3D Canvas */}
        <NightclubCanvas />

        {/* Chat */}
        <Chat />
      </div>
    </PlaybackProvider>
  );
};

const NightclubScene: React.FC = () => {
  return (
    <MultiplayerProvider>
    <LiveProvider>
      <NightclubSceneInner />
    </LiveProvider>
    </MultiplayerProvider>
  );
};

export default NightclubScene;

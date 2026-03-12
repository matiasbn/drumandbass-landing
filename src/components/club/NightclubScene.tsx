'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RiMenuLine, RiLogoutBoxLine, RiSettings3Line, RiPaletteLine, RiPlayFill, RiPauseFill, RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { NightclubCanvas } from './NightclubCanvas';
import { AudioPlayer } from './components/AudioPlayer';
import { Chat } from './components/Chat';
import { YouTubeChatIframe } from './components/YouTubeChatIframe';
import { MobileControls } from './components/MobileControls';
import { SettingsModal } from './components/SettingsModal';
import { CharacterCustomModal } from './components/CharacterCustomModal';
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

const NightclubSceneInner: React.FC = () => {
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { profile, signOut } = useAuth();
  const { isLive, liveTitle, youtubeVideoId } = useLive();

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOut();
  };

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <PlaybackProvider>
      <div className="relative w-full h-screen bg-black overflow-hidden touch-none">
        {/* Navigation overlay */}
        <div className="absolute top-4 left-4 z-50 flex items-center gap-2">
          <div ref={menuRef} className="relative">
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="flex items-center justify-center w-10 h-10 bg-black/50 backdrop-blur border border-white/20 text-white hover:bg-white/10 hover:border-white/40 transition-all"
            >
              <RiMenuLine className="w-5 h-5" />
            </button>

            {menuOpen && (
              <div className="absolute top-12 left-0 min-w-[200px] bg-black/90 backdrop-blur border border-white/20 font-mono text-sm shadow-2xl">
                {profile && (
                  <div className="px-4 py-3 border-b border-white/10 text-[#00ff41] text-xs truncate">
                    @{profile.username}
                  </div>
                )}
                <button
                  onClick={() => { setMenuOpen(false); setCustomizeOpen(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-white hover:bg-white/10 transition-colors text-left"
                >
                  <RiPaletteLine className="w-4 h-4" />
                  PERSONALIZAR
                </button>
                <button
                  onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}
                  className="flex items-center gap-3 w-full px-4 py-3 text-white hover:bg-white/10 transition-colors text-left"
                >
                  <RiSettings3Line className="w-4 h-4" />
                  CONFIGURACIÓN
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-3 w-full px-4 py-3 text-white hover:bg-white/10 transition-colors border-t border-white/10 text-left"
                >
                  <RiLogoutBoxLine className="w-4 h-4" />
                  SALIR
                </button>
              </div>
            )}
          </div>

          {isLive && liveTitle && (
            <div className="flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur border border-red-500/30 font-mono text-xs text-red-400">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              LIVE: {liveTitle}
            </div>
          )}
        </div>

        {/* Modals */}
        <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <CharacterCustomModal isOpen={customizeOpen} onClose={() => setCustomizeOpen(false)} />

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
        {isLive && youtubeVideoId ? (
          <YouTubeChatIframe youtubeVideoId={youtubeVideoId} />
        ) : (
          <Chat />
        )}
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

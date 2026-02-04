'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { RiArrowLeftLine, RiPlayFill, RiPauseFill, RiArrowDownSLine, RiArrowUpSLine } from '@remixicon/react';
import { NightclubCanvas } from './NightclubCanvas';
import { AudioPlayer } from './components/AudioPlayer';
import { Chat } from './components/Chat';
import { MobileControls } from './components/MobileControls';
import { PlaybackProvider, usePlayback } from './PlaybackContext';
import { MultiplayerProvider } from './MultiplayerContext';

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

const NightclubScene: React.FC = () => {
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);

  return (
    <MultiplayerProvider>
    <PlaybackProvider>
      <div className="relative w-full h-screen bg-black">
        {/* Navigation overlay */}
        <div className="absolute top-4 left-4 z-10">
          <Link
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-black/50 backdrop-blur border border-white/20 text-white font-mono text-sm hover:bg-white/10 hover:border-white/40 transition-all"
          >
            <RiArrowLeftLine className="w-4 h-4" />
            SALIR
          </Link>
        </div>

        {/* Audio player - desktop: bottom left, above controls hint */}
        <div className="absolute bottom-24 left-4 z-10 hidden md:block">
          <AudioPlayer />
        </div>

        {/* Mobile: mini player toggle + collapsible player at top right */}
        <div className="absolute top-4 right-4 z-10 md:hidden flex flex-col items-end">
          <MobilePlayerToggle open={mobilePlayerOpen} onToggle={() => setMobilePlayerOpen(o => !o)} />
          <div className={mobilePlayerOpen ? 'mt-2' : 'hidden'}>
            <AudioPlayer />
          </div>
        </div>

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
    </MultiplayerProvider>
  );
};

export default NightclubScene;

'use client';

import React from 'react';
import Link from 'next/link';
import { RiArrowLeftLine } from '@remixicon/react';
import { NightclubCanvas } from './NightclubCanvas';
import { AudioPlayer } from './components/AudioPlayer';
import { Chat } from './components/Chat';
import { PlaybackProvider } from './PlaybackContext';
import { MultiplayerProvider } from './MultiplayerContext';

const NightclubScene: React.FC = () => {
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
            EXIT CLUB
          </Link>
        </div>

        {/* Title overlay */}
        <div className="absolute top-4 right-4 z-10">
          <div className="px-4 py-2 bg-black/50 backdrop-blur border border-[#ff0055]/50 text-[#ff0055] font-mono text-sm tracking-wider">
            DNB CHILE // LIVE
          </div>
        </div>

        {/* Audio player - bottom left */}
        <div className="absolute bottom-4 left-4 z-10">
          <AudioPlayer />
          <div className="mt-2 px-3 py-1.5 bg-black/50 backdrop-blur border border-white/10 text-white/60 font-mono text-[10px] space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#00ff41]" />
              DRAG TO ROTATE &bull; SCROLL TO ZOOM
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#ffff00]" />
              ARROWS TO MOVE
            </div>
          </div>
        </div>

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

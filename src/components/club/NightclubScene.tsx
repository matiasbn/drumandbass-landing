'use client';

import React, { useState, useRef, useEffect } from 'react';
import { RiMenuLine, RiLogoutBoxLine, RiSettings3Line, RiPaletteLine } from '@remixicon/react';
import { NightclubCanvas } from './NightclubCanvas';
import { Chat } from './components/Chat';
import { LiveChat } from './components/LiveChat';
import { MobileControls } from './components/MobileControls';
import { SettingsModal } from './components/SettingsModal';
import { CharacterCustomModal } from './components/CharacterCustomModal';
import { PlaybackProvider } from './PlaybackContext';
import { MultiplayerProvider } from './MultiplayerContext';
import { LiveProvider, useLive } from './LiveContext';
import { ScoreProvider } from './ScoreContext';
import { EnergyProvider } from './EnergyContext';
import { ProjectileProvider } from './ProjectileContext';
import { NpcPositionsProvider } from './NpcPositionsContext';
import { CameraProvider } from './CameraContext';
import { HealthProvider } from './HealthContext';
import { RoundProvider } from './RoundContext';
import { ScoreHUD } from './components/ScoreHUD';
import { CrosshairHUD } from './components/CrosshairHUD';
import { RoundOverlay } from './components/RoundOverlay';
import { SessionSummary } from './components/SessionSummary';
import { GameInstructions } from './components/GameInstructions';
import { DamageOverlay } from './components/DamageOverlay';
import { useAuth } from './AuthContext';

const NightclubSceneInner: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  // El toggle vive en SettingsModal (escribe localStorage y pide recargar)
  const [antialias] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('dnb_antialias') !== '0';
    }
    return true;
  });
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
                  onClick={() => { setMenuOpen(false); setSummaryOpen(true); }}
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

        {/* (El player de SoundCloud se quitó: la música del club sale de la
            pantalla — el stream en vivo o el video por defecto — y tener dos
            fuentes de audio a la vez se pisaba.) */}

        {/* Controls hint - desktop: bottom left */}
        <div className="absolute bottom-4 left-4 z-10 hidden md:block">
          <div className="px-3 py-1.5 bg-black/50 backdrop-blur border border-white/10 text-white/60 font-mono text-[10px] space-y-0.5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#00ff41]" />
              WASD MOVER &bull; CLICK ENERGIA
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#ff8800]" />
              CLICK DERECHO GRANADA &bull; ESPACIO SALTAR
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-[#ff0055]" />
              1-5 BAILAR &bull; ESC SOLTAR MOUSE
            </div>
          </div>
        </div>

        {/* Damage overlay (flash + death screen) */}
        <DamageOverlay />

        {/* 3D Canvas */}
        <NightclubCanvas antialias={antialias} />

        {/* Mobile touch controls — after canvas so they render on top */}
        <MobileControls />

        {/* Score HUD */}
        <ScoreHUD />

        {/* Crosshair del Bass Cannon (WS-2): cooldown, hitmarkers, carga, combo */}
        <CrosshairHUD />

        {/* Rounds de 3 min: temporizador + pantalla de ganadores (durante el stream) */}
        <RoundOverlay />

        {/* Game Instructions */}
        <GameInstructions />

        {/* Resumen de sesión (WS-4/M15) — se abre desde SALIR; confirmar cierra sesión */}
        <SessionSummary
          isOpen={summaryOpen}
          onClose={() => setSummaryOpen(false)}
          onExit={handleLogout}
        />

        {/* Chat */}
        {isLive ? <LiveChat videoId={youtubeVideoId ?? undefined} /> : <Chat />}
      </div>
    </PlaybackProvider>
  );
};

const NightclubScene: React.FC = () => {
  return (
    <MultiplayerProvider>
    <LiveProvider>
    <ScoreProvider>
    {/* EnergyProvider necesita Live+Score+Multiplayer arriba; Health lo consume abajo */}
    <EnergyProvider>
    <ProjectileProvider>
    <NpcPositionsProvider>
    <CameraProvider>
    <HealthProvider>
      <RoundProvider>
        <NightclubSceneInner />
      </RoundProvider>
    </HealthProvider>
    </CameraProvider>
    </NpcPositionsProvider>
    </ProjectileProvider>
    </EnergyProvider>
    </ScoreProvider>
    </LiveProvider>
    </MultiplayerProvider>
  );
};

export default NightclubScene;

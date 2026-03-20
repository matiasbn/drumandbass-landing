'use client';

import React, { useState, useEffect } from 'react';
import { RiCloseLine, RiQuestionLine } from '@remixicon/react';

const STORAGE_KEY = 'dnbchile_instructions_seen';

export const GameInstructions: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setIsOpen(true);
      localStorage.setItem(STORAGE_KEY, '1');
    }
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="absolute bottom-4 right-4 z-50 w-8 h-8 bg-black/50 backdrop-blur border border-white/20 text-white/60 hover:text-[#00ccff] hover:border-[#00ccff]/40 transition-all flex items-center justify-center md:flex hidden"
      >
        <RiQuestionLine className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-black/95 border border-[#00ccff]/40 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="font-mono text-sm text-[#00ccff] tracking-wider">DRUM & BASS CLUB</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/60 hover:text-white transition-colors"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 font-mono text-xs">
          {/* Movement */}
          <section>
            <h3 className="text-[#00ff41] text-sm mb-2">CONTROLES</h3>
            <div className="space-y-1 text-white/70">
              <Row keys="Flechas" desc="Mover personaje" />
              <Row keys="Espacio" desc="Saltar (+1pt)" />
              <Row keys="1-5" desc="Movimientos de baile (+5pt)" />
              <Row keys="6" desc="Saludar a jugador cercano" />
              <Row keys="Mouse" desc="Rotar camara & zoom" />
            </div>
          </section>

          {/* Dance Moves */}
          <section>
            <h3 className="text-[#ff0055] text-sm mb-2">BAILES</h3>
            <div className="space-y-1 text-white/70">
              <Row keys="1" desc="Hands Up" />
              <Row keys="2" desc="Spin" />
              <Row keys="3" desc="Headbang" />
              <Row keys="4" desc="Split Leg" />
              <Row keys="5" desc="Backflip" />
            </div>
          </section>

          {/* Scoring */}
          <section>
            <h3 className="text-[#ffff00] text-sm mb-2">PUNTUACION</h3>
            <div className="space-y-1 text-white/70">
              <Row keys="+1" desc="Saltar" />
              <Row keys="+1/s" desc="Mientras bailas" />
              <Row keys="+3" desc="Mensaje en chat (10s cooldown)" />
              <Row keys="+5" desc="Completar un baile" />
              <Row keys="+8" desc="Choque con otro jugador" />
              <Row keys="+10" desc="Por minuto en el club" />
              <Row keys="+15" desc="Sync con otro jugador" />
            </div>
          </section>

          {/* Combos */}
          <section>
            <h3 className="text-[#ff8800] text-sm mb-2">COMBOS & ESPECIALES</h3>
            <div className="space-y-1 text-white/70">
              <div className="leading-relaxed">
                Acciones consecutivas dentro de 5 segundos aumentan el multiplicador de combo (max x5).
              </div>
              <div className="leading-relaxed mt-2">
                Cada <span className="text-[#ff0055]">100 puntos</span> desbloquea un movimiento especial:
              </div>
              <Row keys="100" desc="Onda" />
              <Row keys="200" desc="Spotlight" />
              <Row keys="300" desc="Confetti" />
              <Row keys="400" desc="Levitar" />
              <Row keys="500" desc="Terremoto" />
            </div>
          </section>

          {/* Interactions */}
          <section>
            <h3 className="text-[#00ccff] text-sm mb-2">INTERACCIONES CON JUGADORES</h3>
            <div className="space-y-1 text-white/70">
              <div className="leading-relaxed"><span className="text-[#00ccff]">Dance Sync</span> — Haz el mismo baile cerca de otro jugador (+15)</div>
              <div className="leading-relaxed"><span className="text-[#00ccff]">Bump</span> — Camina hacia otro jugador para chocar (+8)</div>
              <div className="leading-relaxed"><span className="text-[#00ccff]">Crowd Hype</span> — 3+ jugadores bailando juntos = x2 multiplicador</div>
              <div className="leading-relaxed"><span className="text-[#00ccff]">Wave</span> — Presiona 6 cerca de un jugador para saludar</div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-2 bg-[#00ccff]/20 border border-[#00ccff]/40 text-[#00ccff] font-mono text-sm hover:bg-[#00ccff]/30 transition-colors"
          >
            ENTRAR AL CLUB
          </button>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ keys: string; desc: string }> = ({ keys, desc }) => (
  <div className="flex items-center gap-2">
    <span className="inline-block min-w-[60px] px-1.5 py-0.5 bg-white/10 text-white/90 text-center text-[10px]">
      {keys}
    </span>
    <span>{desc}</span>
  </div>
);

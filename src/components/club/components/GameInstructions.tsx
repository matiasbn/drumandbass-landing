'use client';

// SUBIDÓN — instrucciones del juego (WS-4). Copy nuevo en español: beat-shot,
// granada con carga, VIP, Energía del Club, GLORIA y la economía "gana puntos
// energizando al club" (§6 del diseño).

import React, { useState, useEffect } from 'react';
import { RiCloseLine, RiQuestionLine } from '@remixicon/react';

const STORAGE_KEY = 'dnbchile_instructions_seen_subidon';

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
        className="absolute bottom-4 right-4 z-50 w-8 h-8 bg-black/50 backdrop-blur border border-white/20 text-white/60 hover:text-[#00ccff] hover:border-[#00ccff]/40 transition-colors duration-150 flex items-center justify-center md:flex hidden"
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
          <h2 className="font-mono text-sm text-[#00ccff] tracking-wider">SUBIDÓN — TÚ MANTIENES LA FIESTA VIVA</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white/60 hover:text-white transition-colors duration-150"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 font-mono text-xs">
          {/* Pitch */}
          <section>
            <div className="leading-relaxed text-white/70">
              Tu <span className="text-[#00ff41]">Bass Cannon</span> dispara energía que hace bailar
              a la gente. La fiesta se apaga sola — tú la mantienes viva.
              Nada muere ni te ataca: lo único que puede morir es la fiesta.
            </div>
          </section>

          {/* Controles */}
          <section>
            <h3 className="text-[#00ff41] text-sm mb-2">CONTROLES</h3>
            <div className="space-y-1 text-white/70">
              <Row keys="WASD" desc="Moverte por el club (A/D de costado)" />
              <Row keys="← →" desc="Girar · ↑ ↓ avanzar y retroceder" />
              <Row keys="Mouse" desc="Apuntar (click para capturar el mouse)" />
              <Row keys="Click Izq" desc="Disparar energía" />
              <Row keys="Click Der" desc="Bomba de Bajo: mantener para cargar, soltar para lanzar" />
              <Row keys="Espacio" desc="Saltar (doble salto en el aire)" />
              <Row keys="1-5" desc="Bailes (bailar cerca de un NPC frena su bajón)" />
              <Row keys="6-0" desc="Movimientos especiales (según los que tengas desbloqueados)" />
              <Row keys="Q" desc="Saludar a un jugador cercano" />
              <Row keys="ESC" desc="Soltar el mouse" />
            </div>
          </section>

          {/* Beat-shot */}
          <section>
            <h3 className="text-[#ffdd00] text-sm mb-2">BEAT-SHOT — DISPARA AL RITMO</h3>
            <div className="space-y-1 text-white/70">
              <div className="leading-relaxed">
                El club late a <span className="text-[#ffdd00]">174 BPM</span> — míralo en los strobes.
                Dispara en el pulso y el tiro sale <span className="text-[#ffdd00]">dorado</span>:
                hype x1.5 y puntos x2. El Bass Cannon es un instrumento.
              </div>
            </div>
          </section>

          {/* Hype + Energía */}
          <section>
            <h3 className="text-[#9933ff] text-sm mb-2">HYPE Y ENERGÍA DEL CLUB</h3>
            <div className="space-y-1 text-white/70">
              <div className="leading-relaxed">
                Los bailarines se aburren: se apagan, se encorvan y miran el celular.
                Dispárales energía para que vuelvan a bailar. Al llegar a 100 →{' '}
                <span className="text-[#9933ff]">HYPE DROP</span>: celebración + puntos + energía para el club.
              </div>
              <div className="leading-relaxed">
                La barra de arriba es la <span className="text-[#00ff41]">Energía del Club</span>. Si cae al{' '}
                <span className="text-[#ff0055]">BAJÓN</span>, las luces se apagan (nunca es game over).
                Al llenarla → <span className="text-[#ffdd00]">CLUB DROP</span>: +100 pts y todo el club estalla.
              </div>
              <div className="leading-relaxed">
                Después de cada CLUB DROP viene la <span className="text-[#ffdd00]">GLORIA</span>: 25 segundos de
                fiesta total sin exigencias. Es tu momento para mirar el stream del DJ.
              </div>
            </div>
          </section>

          {/* Granada + VIP */}
          <section>
            <h3 className="text-[#ff8800] text-sm mb-2">BOMBA DE BAJO Y VIP</h3>
            <div className="space-y-1 text-white/70">
              <div className="leading-relaxed">
                <span className="text-[#ff8800]">Bomba de Bajo</span> — mantén el click derecho: más carga,
                más lejos y más hype. Alcanza a 3+ bailarines de un golpe →{' '}
                <span className="text-[#ff8800]">MULTI-HYPE xN</span> con bonus por cada extra.
              </div>
              <div className="leading-relaxed">
                <span className="text-[#ffdd00]">VIP</span> — cada tanto un bailarín se tiñe de dorado y corre.
                3 hits antes de que se le pase → <span className="text-[#ffdd00]">+40 pts</span> y +15 energía.
              </div>
              <div className="leading-relaxed">
                <span className="text-[#00ccff]">Airshot</span> — acierta en el aire o desde lejos: +10 extra.
              </div>
            </div>
          </section>

          {/* Economía */}
          <section>
            <h3 className="text-[#ffff00] text-sm mb-2">GANA PUNTOS ENERGIZANDO AL CLUB</h3>
            <div className="space-y-1 text-white/70">
              <div className="leading-relaxed mb-1">
                Los puntos vienen de tu puntería, no de la presencia:
              </div>
              <Row keys="+2" desc="Hit de energía a un bailarín" />
              <Row keys="+4" desc="BEAT-SHOT (hit en el ritmo)" />
              <Row keys="+10" desc="Airshot" />
              <Row keys="+15" desc="HYPE DROP (bailarín a 100)" />
              <Row keys="+8/NPC" desc="Bomba de Bajo por alcanzado" />
              <Row keys="+40" desc="VIP capturado" />
              <Row keys="+100" desc="CLUB DROP" />
              <Row keys="+8" desc="Energizar a otro jugador (ambos ganan)" />
              <Row keys="+5" desc="Completar un baile" />
              <Row keys="+3" desc="Mensaje en el chat" />
              <div className="leading-relaxed mt-1">
                Los hits encadenados suben el <span className="text-[#ffff00]">combo</span> (hasta x5).
                Fallar no lo rompe: solo expira si dejas de acertar 4 segundos.
              </div>
            </div>
          </section>

          {/* Especiales */}
          <section>
            <h3 className="text-[#ff0055] text-sm mb-2">ESPECIALES</h3>
            <div className="space-y-1 text-white/70">
              <div className="leading-relaxed mb-1">
                Se desbloquean con puntos de la sesión y ganas 1 carga cada 250 pts:
              </div>
              <Row keys="100" desc="Onda — +15 hype a todos en 8u" />
              <Row keys="200" desc="Spotlight — el foco te sigue, hits +50%" />
              <Row keys="300" desc="Confetti — los apagados suben a 60" />
              <Row keys="400" desc="Levitar — vuela y encadena airshots" />
              <Row keys="500" desc="Terremoto — +25 Energía del Club" />
            </div>
          </section>

          {/* Chill */}
          <section>
            <h3 className="text-[#00ccff] text-sm mb-2">¿SOLO VIENES A VER EL SET?</h3>
            <div className="leading-relaxed text-white/70">
              Perfecto. Si no disparas, el club entra en <span className="text-[#00ccff]">modo chill</span> y
              la fiesta se sostiene sola. Baila cerca de un bailarín para mantenerlo arriba sin disparar.
              Aquí nadie pierde por mirar el stream.
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10">
          <button
            onClick={() => setIsOpen(false)}
            className="w-full py-2 bg-[#00ccff]/20 border border-[#00ccff]/40 text-[#00ccff] font-mono text-sm hover:bg-[#00ccff]/30 transition-colors duration-150"
          >
            A ENCENDER EL CLUB
          </button>
        </div>
      </div>
    </div>
  );
};

const Row: React.FC<{ keys: string; desc: string }> = ({ keys, desc }) => (
  <div className="flex items-center gap-2">
    <span className="inline-block min-w-[60px] px-1.5 py-0.5 bg-white/10 text-white/90 text-center text-[10px] tabular-nums">
      {keys}
    </span>
    <span>{desc}</span>
  </div>
);

'use client';

// SUBIDÓN — Resumen de sesión (M15 / §2 "Salida").
// Modal que aparece al pulsar SALIR en el menú del club: drops, mejor combo,
// VIPs, posición en el leaderboard y título cosmético si subió. Dispara el
// evento GA club_session_summary (duration_min, club_drops, best_combo, score).

import React, { useEffect, useRef, useState } from 'react';
import { RiCloseLine, RiTrophyLine, RiFireLine, RiFlashlightLine, RiVipCrownLine, RiLogoutBoxLine, RiMusic2Line } from '@remixicon/react';
import { useScore } from '../ScoreContext';
import { useAuth } from '../AuthContext';
import { event as gaEvent } from '@/src/lib/gtag';

/** Título cosmético según best_club_drops histórico (M15). null = sin título aún. */
export const clubTitleFor = (bestClubDrops: number): string | null => {
  if (bestClubDrops >= 5) return 'Hype Master';
  if (bestClubDrops >= 3) return 'Selector';
  if (bestClubDrops >= 1) return 'Warm-up';
  return null;
};

/** Color del chip de título (comparte escala con el chat) */
export const clubTitleColor = (title: string): string => {
  if (title === 'Hype Master') return '#ffdd00';
  if (title === 'Selector') return '#00ccff';
  return '#00ff41'; // Warm-up
};

interface SessionSummaryProps {
  isOpen: boolean;
  /** Seguir en la fiesta (cerrar el modal sin salir) */
  onClose: () => void;
  /** Confirmar la salida del club (signOut) */
  onExit: () => void;
}

export const SessionSummary: React.FC<SessionSummaryProps> = ({ isOpen, onClose, onExit }) => {
  const { score, sessionScore, sessionStatsRef, leaderboard } = useScore();
  const { profile } = useAuth();

  // Inicio de sesión de juego: el componente se monta con la escena
  const sessionStartRef = useRef(Date.now());
  const trackedRef = useRef(false);
  const [exiting, setExiting] = useState(false);

  const stats = sessionStatsRef.current;
  const durationMin = Math.max(1, Math.round((Date.now() - sessionStartRef.current) / 60000));

  // Récords previos (columnas de la migración M15; pueden no existir aún)
  const p = (profile ?? {}) as { best_club_drops?: number; username?: string };
  const prevBestDrops = p.best_club_drops ?? 0;
  const prevTitle = clubTitleFor(prevBestDrops);
  const newTitle = clubTitleFor(Math.max(prevBestDrops, stats.clubDrops));
  const titleUpgraded = newTitle !== null && newTitle !== prevTitle;

  // Posición en el leaderboard con el score total (perfil + sesión)
  const others = leaderboard.filter((e) => e.username !== profile?.username);
  const rank = others.filter((e) => e.score > score).length + 1;

  // Tracking GA una sola vez por apertura
  useEffect(() => {
    if (isOpen && !trackedRef.current) {
      trackedRef.current = true;
      gaEvent('club_session_summary', {
        duration_min: durationMin,
        club_drops: stats.clubDrops,
        best_combo: stats.bestCombo,
        score: sessionScore,
      });
    }
    if (!isOpen) trackedRef.current = false;
  }, [isOpen, durationMin, stats.clubDrops, stats.bestCombo, sessionScore]);

  if (!isOpen) return null;

  const handleExit = () => {
    if (exiting) return;
    setExiting(true);
    onExit();
  };

  return (
    <div className="absolute inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-black/95 border border-[#ffdd00]/40 max-w-md w-full mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="font-mono text-sm text-[#ffdd00] tracking-wider">RESUMEN DE SESIÓN</h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors duration-150"
            aria-label="Cerrar"
          >
            <RiCloseLine className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4 font-mono">
          {/* Puntos de la sesión */}
          <div className="text-center py-2">
            <div className="text-[10px] text-white/50 tracking-wider">PUNTOS DE LA SESIÓN</div>
            <div className="text-3xl text-[#00ff41] font-bold tabular-nums">
              {sessionScore.toLocaleString('es-CL')}
            </div>
            <div className="text-[10px] text-white/40 tabular-nums">
              {durationMin} min en el club
            </div>
          </div>

          {/* Stats principales */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Stat
              icon={<RiFlashlightLine className="w-4 h-4" />}
              label="CLUB DROPS"
              value={stats.clubDrops}
              color="#ffdd00"
            />
            <Stat
              icon={<RiFireLine className="w-4 h-4" />}
              label="MEJOR COMBO"
              value={stats.bestCombo}
              color="#ff8800"
            />
            <Stat
              icon={<RiMusic2Line className="w-4 h-4" />}
              label="HYPE DROPS"
              value={stats.hypeDrops}
              color="#9933ff"
            />
            <Stat
              icon={<RiVipCrownLine className="w-4 h-4" />}
              label="VIPS CAZADOS"
              value={stats.vips}
              color="#00ccff"
            />
          </div>

          {/* Posición en el leaderboard */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 text-xs text-white/70">
            <RiTrophyLine className="w-4 h-4 text-[#ffff00] shrink-0" />
            {rank <= 10 ? (
              <span>
                Vas <span className="text-[#ffff00] tabular-nums">#{rank}</span> en el TOP 10 con{' '}
                <span className="text-[#00ff41] tabular-nums">{score.toLocaleString('es-CL')}</span> pts totales
              </span>
            ) : (
              <span>
                <span className="text-[#00ff41] tabular-nums">{score.toLocaleString('es-CL')}</span> pts totales —
                sigue energizando para entrar al TOP 10
              </span>
            )}
          </div>

          {/* Título cosmético (M15) */}
          {titleUpgraded ? (
            <div className="px-3 py-2 border text-center text-xs"
              style={{ borderColor: `${clubTitleColor(newTitle!)}66`, color: clubTitleColor(newTitle!) }}
            >
              ¡NUEVO TÍTULO: <span className="font-bold">{newTitle!.toUpperCase()}</span>! Ya luce junto a tu nombre en el chat.
            </div>
          ) : newTitle ? (
            <div className="text-center text-[10px] text-white/40">
              Título actual: <span style={{ color: clubTitleColor(newTitle) }}>{newTitle}</span>
              {newTitle !== 'Hype Master' && ' — consigue más CLUB DROPS en una sesión para subir'}
            </div>
          ) : (
            <div className="text-center text-[10px] text-white/40">
              Logra 1 CLUB DROP en una sesión para ganar tu primer título
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-[#00ff41]/20 border border-[#00ff41]/40 text-[#00ff41] font-mono text-xs hover:bg-[#00ff41]/30 transition-colors duration-150"
          >
            SEGUIR EN LA FIESTA
          </button>
          <button
            onClick={handleExit}
            disabled={exiting}
            className="flex-1 py-2 bg-white/5 border border-white/20 text-white/70 font-mono text-xs hover:bg-white/10 hover:text-white transition-colors duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <RiLogoutBoxLine className="w-4 h-4" />
            {exiting ? 'SALIENDO…' : 'SALIR DEL CLUB'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; label: string; value: number; color: string }> = ({
  icon,
  label,
  value,
  color,
}) => (
  <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10">
    <span style={{ color }}>{icon}</span>
    <div className="flex-1">
      <div className="text-[9px] text-white/50 tracking-wider">{label}</div>
      <div className="text-base font-bold tabular-nums" style={{ color }}>
        {value.toLocaleString('es-CL')}
      </div>
    </div>
  </div>
);

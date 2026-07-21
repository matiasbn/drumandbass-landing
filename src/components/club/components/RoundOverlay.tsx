'use client';

import React from 'react';
import { useRound, Standing } from '../RoundContext';

// HUD de los rounds: temporizador arriba a la izquierda durante la partida y
// una tarjeta central de ganadores entre rounds. La tarjeta NO tapa toda la
// pantalla a propósito: el stream sigue visible detrás (es una segunda pantalla).

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export const RoundOverlay: React.FC = () => {
  const { phase, roundId, secondsLeft, myScore, standings } = useRound();

  if (phase === 'waiting') {
    // Sólo se avisa si el stream está por venir (secondsLeft>0 = entramos entre rounds).
    if (secondsLeft <= 0) return null;
    return (
      <div className="pointer-events-none absolute left-1/2 top-3 z-40 -translate-x-1/2">
        <div className="border border-white/20 bg-black/70 px-4 py-2 font-mono text-xs uppercase tracking-wider text-white/70 backdrop-blur">
          Próximo round en <span className="tabular-nums text-[#00ccff]">{secondsLeft}s</span>
        </div>
      </div>
    );
  }

  if (phase === 'countdown') {
    // Cuenta atrás 5→1 antes de arrancar: el juego está congelado.
    return (
      <div className="pointer-events-none absolute inset-0 z-[60] flex flex-col items-center justify-center">
        <div className="font-mono text-xs uppercase tracking-[0.4em] text-[#00ccff]">
          Prepárate
        </div>
        <div
          key={secondsLeft}
          className="mt-2 animate-pulse text-[7rem] font-black leading-none tabular-nums text-white drop-shadow-[0_0_30px_rgba(0,204,255,0.9)]"
        >
          {secondsLeft}
        </div>
        <div className="mt-2 font-mono text-sm uppercase tracking-widest text-white/60">
          El round empieza
        </div>
      </div>
    );
  }

  if (phase === 'active') {
    const low = secondsLeft <= 15; // últimos 15s en rojo
    return (
      <div className="pointer-events-none absolute left-3 top-16 z-40 md:top-3">
        <div className="flex items-center gap-2 border border-[#00ccff]/40 bg-black/70 px-3 py-1.5 font-mono backdrop-blur">
          <span className="text-[10px] uppercase tracking-widest text-white/50">Round</span>
          <span
            className={`text-lg font-black tabular-nums ${low ? 'animate-pulse text-[#ff0055]' : 'text-[#00ff41]'}`}
          >
            {fmt(secondsLeft)}
          </span>
          <span className="ml-2 text-[10px] uppercase tracking-wider text-white/40">Tu puntaje</span>
          <span className="tabular-nums text-sm font-bold text-[#ffff00]">{myScore}</span>
        </div>
      </div>
    );
  }

  // phase === 'results'
  const winner: Standing | undefined = standings[0];
  const top = standings.slice(0, 3);
  const myPlace = standings.findIndex((s) => s.isMe) + 1;
  const iWon = winner?.isMe;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-16 z-[60] flex justify-center px-4 md:top-24">
      <div className="w-full max-w-sm border-2 border-[#ffdd00]/60 bg-black/90 shadow-[0_0_40px_rgba(255,221,0,0.25)] backdrop-blur">
        <div className="border-b border-white/10 px-4 py-2 text-center font-mono text-xs uppercase tracking-[0.3em] text-[#ffdd00]">
          Fin del Round
        </div>

        {/* Ganador */}
        <div className="px-4 pt-4 text-center">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Ganador</div>
          <div className="mt-1 truncate text-2xl font-black uppercase italic text-white">
            {winner ? `🏆 ${winner.username}` : '—'}
          </div>
          {winner && (
            <div className="tabular-nums font-mono text-sm text-[#ffff00]">{winner.score} pts</div>
          )}
        </div>

        {/* Ranking top 3 */}
        <div className="space-y-1 px-4 py-4">
          {top.map((s, i) => (
            <div
              key={`${s.username}-${i}`}
              className={`flex items-center justify-between border px-3 py-1.5 font-mono text-sm ${
                s.isMe ? 'border-[#00ccff]/50 bg-[#00ccff]/10 text-white' : 'border-white/10 text-white/70'
              }`}
            >
              <span className="truncate">
                <span className="mr-2">{MEDALS[i] ?? `${i + 1}.`}</span>
                {s.username}
                {s.isMe && <span className="ml-1 text-[10px] text-[#00ccff]">(tú)</span>}
              </span>
              <span className="tabular-nums font-bold">{s.score}</span>
            </div>
          ))}
        </div>

        {/* Tu posición (si no estás en el top 3) + próximo round */}
        <div className="border-t border-white/10 px-4 py-2 text-center font-mono text-xs">
          {iWon ? (
            <span className="text-[#00ff41]">¡Ganaste este round! 🎉</span>
          ) : myPlace > 3 ? (
            <span className="text-white/50">
              Terminaste #{myPlace} · {myScore} pts
            </span>
          ) : (
            <span className="text-white/50">Sigue así</span>
          )}
          <div className="mt-1 text-white/40">
            Siguiente round en <span className="tabular-nums text-[#00ccff]">{secondsLeft}s</span>
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-wider text-white/30">
            Juego en pausa
          </div>
        </div>
      </div>
      {/* roundId presente por si se quiere numerar el round en el futuro */}
      <span className="hidden">{roundId}</span>
    </div>
  );
};

'use client';

import React, { useState } from 'react';
import { RiTrophyLine, RiFlashlightLine, RiEyeLine, RiEyeOffLine } from '@remixicon/react';
import { useScore, SPECIAL_NAMES, SPECIAL_THRESHOLDS } from '../ScoreContext';

const Leaderboard: React.FC = () => {
  const { leaderboard } = useScore();

  if (leaderboard.length === 0) return null;

  return (
    <div className="bg-black/90 border border-white/20 backdrop-blur p-3 min-w-[200px]">
      <div className="text-[10px] text-[#ffff00] font-mono mb-2 flex items-center gap-1">
        <RiTrophyLine className="w-3 h-3" />
        TOP 10
      </div>
      {leaderboard.map((entry, i) => (
        <div
          key={entry.username}
          className="flex items-center gap-2 py-1 text-xs font-mono"
        >
          <span className="w-4 text-right text-white/40">{i + 1}</span>
          <span
            className="w-2 h-2 shrink-0"
            style={{ backgroundColor: entry.player_color }}
          />
          <span className="flex-1 truncate" style={{ color: i === 0 ? '#ffff00' : i < 3 ? '#00ff41' : '#ffffff99' }}>
            {entry.username}
          </span>
          <span className="text-white/60">{entry.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const SPECIAL_NAMES_ES = ['Onda', 'Spotlight', 'Confetti', 'Levitar', 'Terremoto'];

export const ScoreHUD: React.FC = () => {
  const {
    sessionScore,
    combo,
    specialCharges,
    unlockedSpecials,
    popups,
    enabled,
    setEnabled,
    useSpecial,
  } = useScore();

  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Charge meter: progress toward next unlock
  const nextThreshold = SPECIAL_THRESHOLDS.find(t => sessionScore < t) ?? SPECIAL_THRESHOLDS[SPECIAL_THRESHOLDS.length - 1];
  const prevThreshold = SPECIAL_THRESHOLDS[SPECIAL_THRESHOLDS.indexOf(nextThreshold) - 1] ?? 0;
  const chargeProgress = sessionScore >= nextThreshold
    ? 1
    : (sessionScore - prevThreshold) / (nextThreshold - prevThreshold);

  return (
    <>
      {/* Score popups - floating text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50">
        {popups.map(popup => (
          <div
            key={popup.id}
            className="absolute whitespace-nowrap font-mono font-bold animate-score-popup"
            style={{
              left: popup.x,
              color: popup.points >= 10 ? '#ffff00' : '#00ff41',
              fontSize: popup.points >= 10 ? '18px' : '14px',
              textShadow: `0 0 10px ${popup.points >= 10 ? '#ffff00' : '#00ff41'}`,
            }}
          >
            +{popup.points} {popup.label}
          </div>
        ))}
      </div>

      {/* Main HUD - top right */}
      <div className="absolute top-4 right-4 z-50 flex flex-col items-end gap-2 hidden md:flex">
        {/* Score display */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEnabled(!enabled)}
            className="flex items-center justify-center w-8 h-8 bg-black/50 backdrop-blur border border-white/20 text-white/60 hover:text-white hover:border-white/40 transition-all"
            title={enabled ? 'Desactivar score' : 'Activar score'}
          >
            {enabled ? <RiEyeLine className="w-4 h-4" /> : <RiEyeOffLine className="w-4 h-4" />}
          </button>

          <div className="bg-black/70 backdrop-blur border border-[#00ff41]/40 px-3 py-1.5 font-mono">
            <div className="text-[10px] text-white/50">PUNTAJE</div>
            <div className="text-lg text-[#00ff41] leading-tight">
              {sessionScore.toLocaleString()}
            </div>
            {combo > 1 && (
              <div className="text-[10px] text-[#ffff00] animate-pulse">
                COMBO x{Math.min(combo, 5)}
              </div>
            )}
          </div>
        </div>

        {/* Charge meter */}
        {enabled && (
          <div className="w-[140px]">
            <div className="bg-black/70 backdrop-blur border border-[#ff0055]/30 p-1.5">
              <div className="flex items-center justify-between text-[9px] font-mono text-white/50 mb-1">
                <span>ESPECIAL</span>
                <span>{specialCharges > 0 ? `${specialCharges} listo` : `${Math.round(chargeProgress * 100)}%`}</span>
              </div>
              <div className="h-1.5 bg-white/10 overflow-hidden">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${chargeProgress * 100}%`,
                    backgroundColor: specialCharges > 0 ? '#ff0055' : '#ff005580',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard toggle */}
        <button
          onClick={() => setShowLeaderboard(!showLeaderboard)}
          className="flex items-center gap-1 px-2 py-1 bg-black/50 backdrop-blur border border-white/20 text-white/60 hover:text-[#ffff00] hover:border-[#ffff00]/40 transition-all font-mono text-[10px]"
        >
          <RiTrophyLine className="w-3 h-3" />
          TOP 10
        </button>

        {showLeaderboard && <Leaderboard />}

        {/* Special move buttons - always visible when unlocked */}
        {enabled && unlockedSpecials > 0 && (
          <div className="flex flex-col gap-1 w-[140px]">
            <div className="text-[9px] font-mono text-white/40 text-center">
              MOVIMIENTOS ESPECIALES {specialCharges > 0 && <span className="text-[#ff0055]">({specialCharges})</span>}
            </div>
            {SPECIAL_NAMES_ES.map((name, i) => {
              const unlocked = i < unlockedSpecials;
              const canUse = unlocked && specialCharges > 0;
              return (
                <button
                  key={i}
                  onClick={() => { if (canUse) useSpecial(i); }}
                  disabled={!canUse}
                  className={`w-full px-2 py-1 text-[10px] font-mono flex items-center gap-1.5 transition-all border ${
                    canUse
                      ? 'bg-black/70 border-[#ff0055]/50 text-[#ff0055] hover:bg-[#ff0055]/20 hover:border-[#ff0055] cursor-pointer'
                      : unlocked
                        ? 'bg-black/50 border-white/10 text-white/30 cursor-not-allowed'
                        : 'bg-black/30 border-white/5 text-white/15 cursor-not-allowed'
                  }`}
                >
                  <RiFlashlightLine className="w-3 h-3 shrink-0" />
                  <span className="flex-1 text-left">{unlocked ? name : `??? (${SPECIAL_THRESHOLDS[i]}pts)`}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

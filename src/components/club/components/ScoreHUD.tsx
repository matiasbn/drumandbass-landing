'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RiTrophyLine, RiFlashlightLine, RiEyeLine, RiEyeOffLine, RiZzzLine } from '@remixicon/react';
import { useScore, SPECIAL_THRESHOLDS } from '../ScoreContext';
import { useEnergy, EnergyStage } from '../EnergyContext';
import { useLive } from '../LiveContext';
import { useAuth } from '../AuthContext';
import { hud } from '../juice';

// ── Barra de Energía del Club (M4) + banners (M5/M6) — WS-4 ──
// La energía vive en refs (EnergyContext): la barra se actualiza vía rAF
// escribiendo al DOM directo (cero setState por frame); los banners y etapas
// son eventos discretos vía subscribe.

const STAGE_UI: Record<EnergyStage, { color: string; label: string }> = {
  full: { color: '#00ff41', label: 'A FULL' },
  media: { color: '#ffff00', label: 'BAJANDO' },
  bajon: { color: '#ff0055', label: 'EL BAJÓN' },
};

const ClubEnergyHUD: React.FC = () => {
  const { energyRef, umbralRef, stageRef, chillRef, dropActiveRef, dropEndsAtRef, subscribe } = useEnergy();
  const { liveTitle } = useLive();
  const { profile } = useAuth();

  const [stage, setStage] = useState<EnergyStage>(stageRef.current);
  const [chill, setChill] = useState(chillRef.current);
  const [gloria, setGloria] = useState(false);
  const [ventana, setVentana] = useState<{ mult: number; live: boolean } | null>(null);
  const [dropFlash, setDropFlash] = useState<{ by?: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [drops, setDrops] = useState(0);
  const [showRecordHint, setShowRecordHint] = useState(true);

  const fillRef = useRef<HTMLDivElement>(null);
  const pctRef = useRef<HTMLSpanElement>(null);
  const vipRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Récord personal al entrar (M15): "Récord: N drops — supéralo"
  const record = ((profile ?? {}) as { best_club_drops?: number }).best_club_drops ?? 0;
  useEffect(() => {
    const t = setTimeout(() => setShowRecordHint(false), 8000);
    return () => clearTimeout(t);
  }, []);

  // Eventos discretos de energía → estado React (nunca por frame)
  useEffect(() => {
    const unsub = subscribe((e) => {
      switch (e.type) {
        case 'stage': setStage(e.stage); break;
        case 'chillStart': setChill(true); break;
        case 'chillEnd': setChill(false); break;
        case 'gloriaStart': setGloria(true); break;
        case 'gloriaEnd': setGloria(false); break;
        case 'ventanaStart': setVentana({ mult: e.mult, live: e.live }); break;
        case 'ventanaEnd': setVentana(null); break;
        case 'clubDrop':
          setDrops((d) => d + 1);
          setDropFlash({ by: e.by });
          if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
          dropTimerRef.current = setTimeout(() => setDropFlash(null), 5000);
          break;
        case 'remoteHypeDrop':
          setToast(`¡${e.from} encendió la pista!`);
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = setTimeout(() => setToast(null), 3500);
          break;
      }
    });
    return () => {
      unsub();
      if (dropTimerRef.current) clearTimeout(dropTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [subscribe]);

  // Relleno y % de la barra + banner VIP por rAF, directo al DOM (cero re-renders)
  useEffect(() => {
    let raf = 0;
    let lastPct = -1;
    let lastVipSec = -1;
    let lastDropSec = -1;
    const tick = () => {
      const pct = Math.round((energyRef.current / umbralRef.current) * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        if (fillRef.current) fillRef.current.style.width = `${pct}%`;
        if (pctRef.current) pctRef.current.textContent = String(pct);
      }
      // Banner VIP con countdown (§4, M7) — hud.vipUntilEpoch lo escribe HealthContext
      const vipLeft = hud.vipUntilEpoch - Date.now();
      const vipSec = vipLeft > 0 ? Math.ceil(vipLeft / 1000) : 0;
      if (vipSec !== lastVipSec) {
        lastVipSec = vipSec;
        if (vipRef.current) {
          vipRef.current.style.display = vipSec > 0 ? 'block' : 'none';
          if (vipSec > 0) vipRef.current.textContent = `★ VIP EN LA PISTA — 3 hits · ${vipSec}s`;
        }
      }
      // Contador de lo que queda del CLUB DROP (celebración + GLORIA)
      const dropLeft = dropActiveRef.current ? dropEndsAtRef.current - Date.now() : 0;
      const dropSec = dropLeft > 0 ? Math.ceil(dropLeft / 1000) : 0;
      if (dropSec !== lastDropSec) {
        lastDropSec = dropSec;
        if (dropRef.current) {
          dropRef.current.style.display = dropSec > 0 ? 'block' : 'none';
          if (dropSec > 0) dropRef.current.textContent = `★ CLUB DROP — ${dropSec}s`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [energyRef, umbralRef, dropActiveRef, dropEndsAtRef]);

  const ui = STAGE_UI[stage];
  const barColor = gloria ? '#ffdd00' : ui.color;

  return (
    <>
      {/* Barra de Energía del Club — arriba al centro (desktop) */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 hidden md:block w-[360px] pointer-events-none font-mono">
        <div
          className={`bg-black/70 backdrop-blur border p-2 ${stage === 'bajon' && !gloria ? 'animate-pulse' : ''}`}
          style={{
            borderColor: gloria ? '#ffdd00' : `${ui.color}66`,
            transition: 'border-color 300ms ease',
          }}
        >
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="text-white/60 flex items-center gap-1">
              <RiFlashlightLine className="w-3 h-3" style={{ color: barColor, transition: 'color 300ms ease' }} />
              ENERGÍA DEL CLUB
            </span>
            <span className="flex items-center gap-2">
              {chill ? (
                <span className="text-[#00ccff] flex items-center gap-1">
                  <RiZzzLine className="w-3 h-3" />
                  CHILL
                </span>
              ) : (
                <span style={{ color: barColor, transition: 'color 300ms ease' }}>
                  {gloria ? 'GLORIA' : ui.label}
                </span>
              )}
              <span className="text-white/50 tabular-nums">
                <span ref={pctRef}>0</span>%
              </span>
            </span>
          </div>
          <div className="h-2 bg-white/10 overflow-hidden">
            <div
              ref={fillRef}
              className="h-full"
              style={{
                width: '0%',
                backgroundColor: barColor,
                boxShadow: `0 0 8px ${barColor}`,
                transition: 'background-color 300ms ease, box-shadow 300ms ease',
              }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-white/40 mt-1">
            <span className="tabular-nums">CLUB DROPS: {drops}{record > 0 ? ` · RÉCORD: ${record}` : ''}</span>
            {showRecordHint && (
              <span className="text-[#ffdd00]/80 tabular-nums">
                {record > 0 ? `Récord: ${record} drops — supéralo` : 'Dispara energía a los que se apagan'}
              </span>
            )}
          </div>
        </div>

        {/* Banner VIP (M7): countdown por rAF directo al DOM (cero setState) */}
        <div
          ref={vipRef}
          className="mt-2 px-3 py-1.5 text-center text-[10px] bg-black/80 backdrop-blur border border-[#ffdd00]/60 text-[#ffdd00] tabular-nums"
          style={{ display: 'none' }}
        />

        {/* Cuánto queda del CLUB DROP (celebración + GLORIA) */}
        <div
          ref={dropRef}
          className="mt-2 px-3 py-2 text-center text-sm font-black tracking-wider bg-black/85 backdrop-blur border-2 border-[#ff00ff]/70 text-white tabular-nums shadow-[0_0_25px_rgba(255,0,255,0.5)]"
          style={{ display: 'none' }}
        />

        {/* Banner de GLORIA / VENTANA DE DROP / DROP INMINENTE */}
        {(gloria || ventana) && (
          <div
            className="mt-2 px-3 py-2 text-center text-xs bg-black/80 backdrop-blur border"
            style={{
              borderColor: gloria ? '#ffdd00' : ventana?.live ? '#ff0055' : '#00ccff',
              color: gloria ? '#ffdd00' : ventana?.live ? '#ff0055' : '#00ccff',
            }}
          >
            {gloria ? (
              <span>GLORIA — disfruta el set</span>
            ) : ventana?.live ? (
              <span className="animate-pulse">
                🔴 DROP INMINENTE x{ventana.mult}
                {liveTitle ? ` — ${liveTitle}` : ''}
              </span>
            ) : (
              <span>¡VENTANA DE DROP! Hype x{ventana?.mult}</span>
            )}
          </div>
        )}

        {/* Toast: HYPE DROP de otro jugador (§5) */}
        {toast && (
          <div className="mt-2 px-3 py-1.5 text-center text-[10px] bg-black/70 backdrop-blur border border-[#9933ff]/50 text-[#9933ff]">
            {toast}
          </div>
        )}
      </div>

      {/* Flash central del CLUB DROP */}
      {dropFlash && (
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 z-50 pointer-events-none text-center font-mono hidden md:block">
          <div
            className="text-4xl font-bold text-[#ffdd00] animate-score-popup"
            style={{ textShadow: '0 0 24px #ffdd00' }}
          >
            +100 CLUB DROP
          </div>
          {dropFlash.by && (
            <div className="text-sm text-white/80 mt-1">¡{dropFlash.by} encendió el club!</div>
          )}
        </div>
      )}
    </>
  );
};

// "Te faltan N pts para superar a <siguiente>" (M15) — usa el leaderboard existente
const NextRivalHint: React.FC = () => {
  const { score, leaderboard } = useScore();
  const { profile } = useAuth();

  if (leaderboard.length === 0) return null;
  const next = leaderboard
    .filter((e) => e.username !== profile?.username && e.score > score)
    .sort((a, b) => a.score - b.score)[0];

  return (
    <div className="text-[9px] font-mono text-white/50 text-right max-w-[200px] tabular-nums">
      {next ? (
        <>
          te faltan <span className="text-[#ffff00]">{(next.score - score + 1).toLocaleString('es-CL')}</span> pts
          para superar a <span className="text-white/80">{next.username}</span>
        </>
      ) : (
        <span className="text-[#ffff00]">¡Vas #1 del club!</span>
      )}
    </div>
  );
};

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
const SPECIAL_EMOJIS = ['\u{1F30A}', '\u{1F4A1}', '\u{1F389}', '\u{1F9D8}', '\u{1F4A5}'];
// Roles t\u00e1cticos del re-rol M12
const SPECIAL_DESCRIPTIONS = ['+15 hype en 8u', 'Tus hits +50% por 10s', 'Apagados suben a 60', 'Levitaci\u00f3n (airshots)', '+25 Energ\u00eda del Club'];

export const ScoreHUD: React.FC = () => {
  const {
    sessionScore,
    combo,
    comboMult,
    specialCharges,
    unlockedSpecials,
    popups,
    enabled,
    setEnabled,
    useSpecial: activateSpecial, // alias: evita el falso positivo de rules-of-hooks en callbacks
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
      {/* Energía del Club: barra por etapas + banners (WS-4) */}
      <ClubEnergyHUD />

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
            {combo > 0 && (
              <div className="text-[10px] text-[#ffff00] animate-pulse tabular-nums">
                COMBO {combo} {comboMult > 1 ? `· x${comboMult}` : ''}
              </div>
            )}
          </div>
        </div>

        {/* Distancia al siguiente del leaderboard (M15) */}
        {enabled && <NextRivalHint />}

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
          <div className="flex flex-col gap-1.5 w-[180px]">
            <div className="text-[9px] font-mono text-white/40 text-center">
              MOVIMIENTOS ESPECIALES {specialCharges > 0 && <span className="text-[#ff0055]">({specialCharges})</span>}
            </div>
            {SPECIAL_NAMES_ES.map((name, i) => {
              const unlocked = i < unlockedSpecials;
              const canUse = unlocked && specialCharges > 0;
              return (
                <button
                  key={i}
                  onClick={() => { if (canUse) activateSpecial(i); }}
                  disabled={!canUse}
                  className={`w-full px-2.5 py-2 font-mono flex items-center gap-2.5 transition-all border min-h-[36px] ${
                    canUse
                      ? 'bg-black/70 border-[#ff0055]/60 text-[#ff0055] hover:bg-[#ff0055]/20 hover:border-[#ff0055] cursor-pointer animate-pulse-glow'
                      : unlocked
                        ? 'bg-black/50 border-white/10 text-white/30 cursor-not-allowed'
                        : 'bg-black/30 border-white/5 text-white/15 cursor-not-allowed'
                  }`}
                  style={canUse ? {
                    boxShadow: '0 0 8px rgba(255,0,85,0.4), inset 0 0 8px rgba(255,0,85,0.1)',
                    animation: 'pulseGlow 2s ease-in-out infinite',
                  } : undefined}
                >
                  <span className="text-lg shrink-0 leading-none">{unlocked ? SPECIAL_EMOJIS[i] : '\u{1F512}'}</span>
                  <div className="flex-1 text-left">
                    {unlocked ? (
                      <>
                        <div className="text-[11px] font-bold leading-tight">{name}</div>
                        <div className="text-[9px] opacity-60 leading-tight">{SPECIAL_DESCRIPTIONS[i]}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-[11px] font-bold leading-tight">???</div>
                        <div className="text-[9px] opacity-40 leading-tight">{SPECIAL_THRESHOLDS[i]} pts</div>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
            <style>{`
              @keyframes pulseGlow {
                0%, 100% { box-shadow: 0 0 6px rgba(255,0,85,0.3), inset 0 0 6px rgba(255,0,85,0.05); }
                50% { box-shadow: 0 0 14px rgba(255,0,85,0.6), inset 0 0 14px rgba(255,0,85,0.15); }
              }
            `}</style>
          </div>
        )}
      </div>
    </>
  );
};

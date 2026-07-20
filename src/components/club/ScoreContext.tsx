'use client';

// SUBIDÓN — economía de puntos (§6) + combo de puntería (M10) + récords (M15).
// Regla de oro: 0 puntos por presencia o por disparar al aire. El combo SOLO lo
// alimentan acciones de puntería y solo multiplica hitNpc/beatShot/hypeDropNpc.
// PERF: la posición del jugador ya NO vive en estado React — se lee del
// singleton `playerState` (cero re-renders por frame en HUD/Chat).

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, useMemo, ReactNode } from 'react';
import { supabase, UserProfile } from '../../lib/supabase';
import { useAuth } from './AuthContext';
import { TUNING } from './tuning';

// Puntos por acción (§6). Los nombres legacy quedan en 0 para que los call
// sites existentes (PlayerDancer, etc.) sigan compilando sin premiar spam.
const POINTS: Record<string, number> = {
  // Puntería (alimenta el combo)
  hitNpc: TUNING.puntos.hitNpc, // ×combo
  beatShot: TUNING.puntos.beatShot, // ×combo — sustituye a hitNpc en ese hit
  airshot: TUNING.puntos.airshot, // flat
  hypeDropNpc: TUNING.puntos.hypeDropNpc, // ×combo
  grenadeNpc: TUNING.puntos.grenadeNpc, // flat, por NPC alcanzado
  multiHype: TUNING.puntos.multiHypeExtra, // flat, por NPC extra (≥3)
  vip: TUNING.puntos.vip, // flat
  clubDrop: TUNING.puntos.clubDrop, // flat
  hypeBump: TUNING.puntos.hypeBump, // flat (cooldown por pareja en HealthContext)
  // Participación social (sin combo)
  danceComplete: TUNING.puntos.danceComplete,
  chat: TUNING.puntos.chat,
  timePerMinute: TUNING.puntos.vibingPorMinuto, // SOLO con ≥1 hit ese minuto
  // Legacy / movilidad — 0 puntos (se conservan los nombres para los call sites)
  shoot: TUNING.puntos.shoot,
  jump: TUNING.puntos.jump,
  wave: 0,
  bump: 0,
  danceSync: 0,
  crowdHype: 0,
  hitTarget: 0,
  gotHit: 0,
  grenadeHit: 0,
};

// Cooldowns en ms (solo para acciones que puntúan)
const COOLDOWNS: Record<string, number> = {
  chat: 10000,
  airshot: TUNING.airshot.cooldownS * 1000,
};

// Acciones de puntería: alimentan el combo (M10) y cuentan como "hit del minuto"
const COMBO_ACTIONS = new Set([
  'hitNpc', 'beatShot', 'airshot', 'hypeDropNpc', 'grenadeNpc', 'multiHype', 'vip', 'hypeBump',
]);
// Solo estas se multiplican por el combo (§6, columna ×Combo)
const COMBO_MULT_ACTIONS = new Set(['hitNpc', 'beatShot', 'hypeDropNpc']);

// Umbrales de desbloqueo de especiales (sin cambio) — cargas cada 250 pts (§6)
const SPECIAL_THRESHOLDS = [...TUNING.puntos.umbralesDesbloqueo];
const SPECIAL_NAMES = ['Onda', 'Spotlight', 'Confetti', 'Levitar', 'Terremoto'];

/** Multiplicador del combo según hits encadenados (escalones de TUNING) */
function comboMultiplierFor(hits: number): number {
  let mult = 1;
  for (const esc of TUNING.combo.escalones) {
    if (hits >= esc.hits) mult = esc.mult;
  }
  return mult;
}

export interface ScorePopup {
  id: number;
  points: number;
  label: string;
  x: number;
  y: number;
}

/** Estadísticas de sesión (M15 / SessionSummary de WS-4) — leer bajo demanda */
export interface SessionStats {
  bestCombo: number;
  clubDrops: number;
  hypeDrops: number;
  vips: number;
}

interface ScoreContextType {
  score: number;
  sessionScore: number;
  /** Hits encadenados del combo (0 = sin combo) */
  combo: number;
  /** Multiplicador vigente del combo (1/2/3/4/5) */
  comboMult: number;
  /** performance del combo: epoch ms en que expira (para la barra de decay de WS-2) */
  comboExpiresAtRef: React.MutableRefObject<number>;
  specialCharges: number;
  unlockedSpecials: number;
  activeSpecial: number | null;
  popups: ScorePopup[];
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  /** count multiplica los puntos base (p.ej. granada a N NPCs en un solo popup) */
  scoreAction: (action: string, label?: string, count?: number) => void;
  useSpecial: (index: number) => boolean;
  /** LEGACY no-op: la posición vive en playerState.ts (PlayerDancer ya la escribe) */
  setPlayerPosition: (x: number, y: number, z: number) => void;
  /** Récords y stats de la sesión (M15) — ref, sin re-renders */
  sessionStatsRef: React.MutableRefObject<SessionStats>;
  leaderboard: LeaderboardEntry[];
  refreshLeaderboard: () => void;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  player_color: string;
}

// Las columnas best_combo/best_club_drops las crea la migración de WS-4;
// hasta entonces el update de récords falla en silencio (try/catch aparte).
type ProfileWithRecords = UserProfile & { best_combo?: number; best_club_drops?: number };

const ScoreContext = createContext<ScoreContextType | null>(null);

let popupIdCounter = 0;

export const ScoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [sessionScore, setSessionScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [popups, setPopups] = useState<ScorePopup[]>([]);
  const [enabled, setEnabled] = useState(true);
  const [activeSpecial, setActiveSpecial] = useState<number | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const lastActionTimeRef = useRef<Record<string, number>>({});
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboHitsRef = useRef(0);
  const comboExpiresAtRef = useRef(0);
  const timeAccumRef = useRef(0);
  const hitsThisMinuteRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScoreRef = useRef(0);
  const sessionStatsRef = useRef<SessionStats>({ bestCombo: 0, clubDrops: 0, hypeDrops: 0, vips: 0 });

  // All-time score = profile score + session score
  const allTimeScore = (profile?.score ?? 0) + sessionScore;

  // Desbloqueos por puntaje de sesión (curva intra-sesión, sin cambio)
  const unlockedSpecials = SPECIAL_THRESHOLDS.filter(t => sessionScore >= t).length;

  // Cargas: 1 cada 250 pts (§6 — la nueva economía rinde más pts/min)
  const totalChargesEarned = Math.floor(sessionScore / TUNING.puntos.cargaEspecialCada);
  const [chargesUsed, setChargesUsed] = useState(0);
  const specialCharges = Math.max(0, totalChargesEarned - chargesUsed);

  // Guardado en lote del score + récords (M15)
  const flushScore = useCallback(async () => {
    if (!profile) return;
    const p = profile as ProfileWithRecords;

    // Récords de sesión → columnas best_combo/best_club_drops (update aparte:
    // si la migración aún no está aplicada, no bloquea el guardado del score)
    const stats = sessionStatsRef.current;
    const bestCombo = Math.max(p.best_combo ?? 0, stats.bestCombo);
    const bestDrops = Math.max(p.best_club_drops ?? 0, stats.clubDrops);
    if (bestCombo > (p.best_combo ?? 0) || bestDrops > (p.best_club_drops ?? 0)) {
      try {
        await supabase
          .from('profiles')
          .update({ best_combo: bestCombo, best_club_drops: bestDrops })
          .eq('user_id', profile.user_id);
      } catch {
        // Columnas aún no migradas (WS-4) — silencioso a propósito
      }
    }

    if (pendingScoreRef.current === 0) return;
    const points = pendingScoreRef.current;
    pendingScoreRef.current = 0;

    try {
      const newScore = (profile.score ?? 0) + points;
      const newHighScore = Math.max(profile.high_score ?? 0, newScore);
      await supabase
        .from('profiles')
        .update({ score: newScore, high_score: newHighScore })
        .eq('user_id', profile.user_id);
    } catch (e) {
      console.error('Failed to save score:', e);
      // Reintenta en el próximo flush
      pendingScoreRef.current += points;
    }
  }, [profile]);

  // Flush on unmount
  useEffect(() => {
    return () => {
      flushScore();
    };
  }, [flushScore]);

  const addPopup = useCallback((points: number, label: string) => {
    const id = ++popupIdCounter;
    const x = (Math.random() - 0.5) * 60;
    setPopups(prev => [...prev, { id, points, label, x, y: 0 }]);
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 1500);
  }, []);

  const scoreAction = useCallback((action: string, label?: string, count = 1) => {
    if (!enabled) return;

    const now = Date.now();
    const cooldown = COOLDOWNS[action] ?? 0;
    const lastTime = lastActionTimeRef.current[action] ?? 0;
    if (cooldown > 0 && now - lastTime < cooldown) return;
    lastActionTimeRef.current[action] = now;

    const basePoints = POINTS[action] ?? 0;

    // Combo (M10): SOLO puntería. Fallar un disparo NO lo rompe — solo expira
    // por tiempo (ventana 4s). Cada acción de puntería suma 1 hit encadenado.
    let multiplier = 1;
    if (COMBO_ACTIONS.has(action)) {
      hitsThisMinuteRef.current++;
      const newHits = comboHitsRef.current + 1;
      comboHitsRef.current = newHits;
      comboExpiresAtRef.current = now + TUNING.combo.ventanaS * 1000;
      if (COMBO_MULT_ACTIONS.has(action)) multiplier = comboMultiplierFor(newHits);
      setCombo(newHits);
      if (newHits > sessionStatsRef.current.bestCombo) sessionStatsRef.current.bestCombo = newHits;
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
      comboTimerRef.current = setTimeout(() => {
        // Expiración suave: sin castigo de puntos (el fade lo pinta el HUD)
        comboHitsRef.current = 0;
        comboExpiresAtRef.current = 0;
        setCombo(0);
      }, TUNING.combo.ventanaS * 1000);
    }

    if (basePoints === 0) return; // acciones legacy/movilidad: silencio total

    // Stats de sesión (M15 / analytics de WS-4)
    if (action === 'clubDrop') sessionStatsRef.current.clubDrops++;
    else if (action === 'hypeDropNpc') sessionStatsRef.current.hypeDrops++;
    else if (action === 'vip') sessionStatsRef.current.vips++;

    const totalPoints = basePoints * count * multiplier;
    setSessionScore(s => s + totalPoints);
    pendingScoreRef.current += totalPoints;

    const displayLabel = label || action;
    const comboText = multiplier > 1 ? ` x${multiplier}` : '';
    addPopup(totalPoints, `${displayLabel}${comboText}`);

    // Guardado en lote cada 10s
    if (!saveTimerRef.current) {
      saveTimerRef.current = setTimeout(() => {
        flushScore();
        saveTimerRef.current = null;
      }, 10000);
    }
  }, [enabled, addPopup, flushScore]);

  // "Vibing" +10/min — SOLO si registraste ≥1 hit en ese minuto (mata el AFK
  // sin castigar al que juega tranquilo)
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      timeAccumRef.current += 1;
      if (timeAccumRef.current >= 60) {
        timeAccumRef.current = 0;
        if (hitsThisMinuteRef.current > 0) {
          scoreAction('timePerMinute', 'Vibing');
        }
        hitsThisMinuteRef.current = 0;
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [enabled, scoreAction]);

  const useSpecial = useCallback((index: number): boolean => {
    if (index >= unlockedSpecials || specialCharges <= 0) return false;
    setChargesUsed(prev => prev + 1);
    setActiveSpecial(index);
    // Clear after 5s
    setTimeout(() => setActiveSpecial(null), 5000);
    return true;
  }, [unlockedSpecials, specialCharges]);

  // LEGACY no-op: PlayerDancer ya escribe la pose en playerState.ts cada frame.
  // Mantener la firma evita tocar archivos ajenos; NO debe volver a ser estado React.
  const setPlayerPosition = useCallback((_x: number, _y: number, _z: number) => {}, []);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('username, score, player_color')
        .order('score', { ascending: false })
        .limit(10);
      if (data) {
        setLeaderboard(data.map(d => ({
          username: d.username,
          score: d.score ?? 0,
          player_color: d.player_color ?? '#ffffff',
        })));
      }
    } catch (e) {
      console.error('Failed to fetch leaderboard:', e);
    }
  }, []);

  // Fetch leaderboard on mount and periodically
  useEffect(() => {
    refreshLeaderboard();
    const interval = setInterval(refreshLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [refreshLeaderboard]);

  const comboMult = comboMultiplierFor(combo);

  const contextValue = useMemo(() => ({
    score: allTimeScore,
    sessionScore,
    combo,
    comboMult,
    comboExpiresAtRef,
    specialCharges,
    unlockedSpecials,
    activeSpecial,
    popups,
    enabled,
    setEnabled,
    scoreAction,
    useSpecial,
    setPlayerPosition,
    sessionStatsRef,
    leaderboard,
    refreshLeaderboard,
  }), [allTimeScore, sessionScore, combo, comboMult, specialCharges, unlockedSpecials, activeSpecial,
       popups, enabled, setEnabled, scoreAction, useSpecial, setPlayerPosition,
       leaderboard, refreshLeaderboard]);

  return (
    <ScoreContext.Provider value={contextValue}>
      {children}
    </ScoreContext.Provider>
  );
};

export const useScore = () => {
  const context = useContext(ScoreContext);
  if (!context) throw new Error('useScore must be used within ScoreProvider');
  return context;
};

export { SPECIAL_NAMES, SPECIAL_THRESHOLDS, POINTS };

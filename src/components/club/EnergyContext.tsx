'use client';

// Energía del Club (M4) + GLORIA (M5) + VENTANA DE DROP / DROP INMINENTE (M6)
// + modo chill (M13) + energía compartida multiplayer (§5, max-wins).
// Todo el estado caliente vive en refs; los consumidores (Lighting, StrobeWalls,
// LaserFloor, HUD) leen refs por frame y se suscriben a eventos discretos.
// El driver es un setInterval de 100ms — precisión de sobra para decay 1–2/s
// sin ocupar el frame loop de r3f.

import React, { createContext, useContext, useRef, useCallback, useEffect, ReactNode } from 'react';
import { TUNING } from './tuning';
import { useLive } from './LiveContext';
import { useScore } from './ScoreContext';
import { useMultiplayer, ClubFxPayload } from './MultiplayerContext';

/** Etapas visibles del club: full (≥60), media (30–60), bajon (<30 = EL BAJÓN) */
export type EnergyStage = 'full' | 'media' | 'bajon';

/** Fuentes que suman energía (§ M4) */
export type EnergySource = 'hypeDrop' | 'vip' | 'especial' | 'remoto';

export type EnergyEvent =
  | { type: 'stage'; stage: EnergyStage; energy: number }
  | { type: 'clubDrop'; energy: number }
  | { type: 'gloriaStart' }
  | { type: 'gloriaEnd' }
  | { type: 'ventanaStart'; mult: number; live: boolean }
  | { type: 'ventanaEnd' }
  | { type: 'chillStart' }
  | { type: 'chillEnd' };

export type EnergyListener = (event: EnergyEvent) => void;

interface EnergyContextType {
  /** Energía global 0–umbral — leer por frame, nunca en estado React */
  energyRef: React.MutableRefObject<number>;
  /** Umbral vigente del CLUB DROP (100 + 30% por jugador extra presente) */
  umbralRef: React.MutableRefObject<number>;
  /** Etapa actual (derivada de energyRef) */
  stageRef: React.MutableRefObject<EnergyStage>;
  /** true durante los 25s de GLORIA post CLUB DROP */
  gloriaActiveRef: React.MutableRefObject<boolean>;
  /** Multiplicador de hype vigente (1 normal, x2 ventana, x3 DROP INMINENTE) */
  hypeMultRef: React.MutableRefObject<number>;
  /** true en modo chill (120s sin disparar) */
  chillRef: React.MutableRefObject<boolean>;
  /** Suma energía (clamp 0–umbral); source decide popups/analytics */
  addEnergy: (amount: number, source: EnergySource) => void;
  /** Avisar de un disparo del jugador (resetea el timer del modo chill) */
  notifyShot: () => void;
  /** Suscripción a eventos discretos; devuelve el unsubscribe */
  subscribe: (listener: EnergyListener) => () => void;
}

const EnergyContext = createContext<EnergyContextType | null>(null);

const stageFor = (energy: number): EnergyStage => {
  if (energy >= TUNING.energia.etapaMedia) return 'full';
  if (energy >= TUNING.energia.etapaBajon) return 'media';
  return 'bajon';
};

const randBetween = (range: readonly [number, number]) =>
  range[0] + Math.random() * (range[1] - range[0]);

export const EnergyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isLive } = useLive();
  const { scoreAction } = useScore();
  const { players, username, sendClubFx, subscribeClubFx } = useMultiplayer();

  const energyRef = useRef<number>(TUNING.energia.start);
  const umbralRef = useRef<number>(TUNING.energia.clubDropUmbral);
  const stageRef = useRef<EnergyStage>(stageFor(TUNING.energia.start));
  const gloriaActiveRef = useRef(false);
  const hypeMultRef = useRef(1);
  const chillRef = useRef(false);
  const listenersRef = useRef<Set<EnergyListener>>(new Set());

  // Refs de identidad inestable (para que el value del contexto sea estable)
  const scoreActionRef = useRef(scoreAction);
  scoreActionRef.current = scoreAction;
  const isLiveRef = useRef(isLive);
  isLiveRef.current = isLive;
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const sendClubFxRef = useRef(sendClubFx);
  sendClubFxRef.current = sendClubFx;

  // Umbral del CLUB DROP: +30% por jugador extra presente (players excluye al local)
  umbralRef.current = TUNING.energia.clubDropUmbral *
    (1 + TUNING.energia.umbralPorJugadorExtra * players.size);

  // Estado interno del ciclo (todo en refs — cero React)
  const decayRef = useRef<number>(TUNING.energia.decayPerS); // escala +10% por ciclo post-drop
  const lastShotAtRef = useRef(Date.now());
  const dropActiveRef = useRef(false); // celebración (5s) + GLORIA (25s)
  const gloriaStartAtRef = useRef(0);
  const gloriaEndAtRef = useRef(0);
  const ventanaActiveRef = useRef(false);
  const ventanaEndAtRef = useRef(0);
  const nextVentanaAtRef = useRef(0);
  const sessionStartRef = useRef(0);
  const lastTickRef = useRef(0);
  const lastBroadcastValueRef = useRef<number>(TUNING.energia.start);

  const emit = useCallback((event: EnergyEvent) => {
    listenersRef.current.forEach((fn) => fn(event));
  }, []);

  const subscribe = useCallback((listener: EnergyListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  /** Clamp + recomputar etapa + emitir cambio de etapa. NO chequea el umbral. */
  const setEnergy = useCallback((value: number) => {
    const next = Math.max(0, Math.min(umbralRef.current, value));
    energyRef.current = next;
    const stage = stageFor(next);
    if (stage !== stageRef.current) {
      stageRef.current = stage;
      emit({ type: 'stage', stage, energy: next });
    }
  }, [emit]);

  /** CLUB DROP (M4→M5): celebración 5s → GLORIA 25s. remote = disparado por otro jugador. */
  const triggerClubDrop = useCallback((remote: boolean) => {
    if (dropActiveRef.current) return; // ya celebrando/GLORIA
    dropActiveRef.current = true;
    const now = Date.now();
    gloriaStartAtRef.current = now + 5000;
    gloriaEndAtRef.current = now + 5000 + TUNING.energia.gloriaS * 1000;
    // La barra queda llena durante toda la celebración + GLORIA
    energyRef.current = umbralRef.current;
    if (stageRef.current !== 'full') {
      stageRef.current = 'full';
      emit({ type: 'stage', stage: 'full', energy: energyRef.current });
    }
    // Ventana activa (si la hubiera) se corta: la GLORIA manda
    if (ventanaActiveRef.current) {
      ventanaActiveRef.current = false;
      hypeMultRef.current = 1;
      emit({ type: 'ventanaEnd' });
    }
    emit({ type: 'clubDrop', energy: energyRef.current });
    // +100 pts para todos los presentes: el logro de uno es el ambiente de todos (§5)
    scoreActionRef.current('clubDrop', 'CLUB DROP');
    if (!remote && usernameRef.current) {
      sendClubFxRef.current({ kind: 'club_drop', from: usernameRef.current });
    }
  }, [emit]);

  const addEnergy = useCallback((amount: number, source: EnergySource) => {
    if (dropActiveRef.current) return; // durante celebración/GLORIA la barra está llena
    setEnergy(energyRef.current + amount);
    if (energyRef.current >= umbralRef.current) {
      triggerClubDrop(false);
      return;
    }
    // Energía compartida (§5): broadcast al cambiar ≥2 puntos (solo en subidas locales)
    if (source !== 'remoto' && usernameRef.current &&
        Math.abs(energyRef.current - lastBroadcastValueRef.current) >= 2) {
      lastBroadcastValueRef.current = energyRef.current;
      sendClubFxRef.current({
        kind: 'energy',
        from: usernameRef.current,
        value: energyRef.current,
        ts: Date.now(),
      });
    }
  }, [setEnergy, triggerClubDrop]);

  const notifyShot = useCallback(() => {
    lastShotAtRef.current = Date.now();
    if (chillRef.current) {
      chillRef.current = false;
      emit({ type: 'chillEnd' });
    }
  }, [emit]);

  // ── Driver del ciclo (100ms): decay, GLORIA, ventanas, chill ──
  useEffect(() => {
    const now = Date.now();
    sessionStartRef.current = now;
    lastTickRef.current = now;
    lastShotAtRef.current = now;
    nextVentanaAtRef.current = now + randBetween(TUNING.ventanas.dropEventCadaS) * 1000;

    const interval = setInterval(() => {
      const t = Date.now();
      const dt = Math.min((t - lastTickRef.current) / 1000, 1); // clamp 1s (tab oculta)
      lastTickRef.current = t;

      // Fin de celebración → GLORIA
      if (dropActiveRef.current && !gloriaActiveRef.current && t >= gloriaStartAtRef.current) {
        gloriaActiveRef.current = true;
        emit({ type: 'gloriaStart' });
      }
      // Fin de GLORIA → energía 55, decay del ciclo siguiente +10% (cap 2.0)
      if (gloriaActiveRef.current && t >= gloriaEndAtRef.current) {
        gloriaActiveRef.current = false;
        dropActiveRef.current = false;
        decayRef.current = Math.min(decayRef.current * TUNING.energia.decayEscalada, TUNING.energia.decayCap);
        setEnergy(TUNING.energia.postGloriaEnergia);
        lastBroadcastValueRef.current = energyRef.current;
        emit({ type: 'gloriaEnd' });
        nextVentanaAtRef.current = t + randBetween(TUNING.ventanas.dropEventCadaS) * 1000;
      }

      // Modo chill (M13): 120s sin disparar → decay 0, energía se asienta
      if (!chillRef.current && !dropActiveRef.current &&
          t - lastShotAtRef.current >= TUNING.energia.chillTrasSinDisparoS * 1000) {
        chillRef.current = true;
        setEnergy(Math.min(energyRef.current, TUNING.energia.chillTecho));
        emit({ type: 'chillStart' });
      }

      // Decay base (pausado en GLORIA/celebración, chill y con la pestaña oculta)
      if (!dropActiveRef.current && !chillRef.current &&
          !(typeof document !== 'undefined' && document.hidden)) {
        setEnergy(energyRef.current - decayRef.current * dt);
      }

      // Ventanas de drop (M6)
      if (ventanaActiveRef.current && t >= ventanaEndAtRef.current) {
        ventanaActiveRef.current = false;
        hypeMultRef.current = 1;
        emit({ type: 'ventanaEnd' });
      }
      if (!ventanaActiveRef.current && !dropActiveRef.current && t >= nextVentanaAtRef.current) {
        const live = isLiveRef.current;
        ventanaActiveRef.current = true;
        ventanaEndAtRef.current = t + TUNING.ventanas.dropEventDuraS * 1000;
        hypeMultRef.current = live ? TUNING.ventanas.liveMult : TUNING.ventanas.dropEventMult;
        emit({ type: 'ventanaStart', mult: hypeMultRef.current, live });
        // Próxima ventana: con live cada 5 min exactos; sin live 90–120s
        // (acortando a 75s pasado el minuto 8 de sesión)
        if (live) {
          nextVentanaAtRef.current = t + TUNING.ventanas.liveCadaS * 1000;
        } else {
          const minute = (t - sessionStartRef.current) / 60000;
          nextVentanaAtRef.current = t + (minute >= 8 ? 75 : randBetween(TUNING.ventanas.dropEventCadaS)) * 1000;
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [emit, setEnergy]);

  // ── Energía compartida (§5): reconciliación max-wins + drops ajenos ──
  useEffect(() => {
    const unsub = subscribeClubFx((fx: ClubFxPayload) => {
      if (fx.kind === 'energy') {
        // Max-wins: adoptar solo si el remoto va por delante (el decay es simétrico)
        if (!dropActiveRef.current && fx.value > energyRef.current + 0.5) {
          setEnergy(fx.value);
          lastBroadcastValueRef.current = energyRef.current;
          if (energyRef.current >= umbralRef.current) triggerClubDrop(true);
        }
      } else if (fx.kind === 'hype_drop') {
        addEnergy(TUNING.energia.porHypeDrop, 'remoto');
      } else if (fx.kind === 'club_drop') {
        triggerClubDrop(true);
      }
    });
    return unsub;
  }, [subscribeClubFx, setEnergy, addEnergy, triggerClubDrop]);

  // Valor estable — todos los campos son refs o callbacks estables
  const contextValue = useRef<EnergyContextType>({
    energyRef,
    umbralRef,
    stageRef,
    gloriaActiveRef,
    hypeMultRef,
    chillRef,
    addEnergy,
    notifyShot,
    subscribe,
  }).current;

  return <EnergyContext.Provider value={contextValue}>{children}</EnergyContext.Provider>;
};

export const useEnergy = () => {
  const ctx = useContext(EnergyContext);
  if (!ctx) throw new Error('useEnergy must be used within EnergyProvider');
  return ctx;
};

'use client';

// Sistema de ROUNDS del club: partidas de 3 minutos mientras el stream está en
// vivo. Al terminar cada round se muestra a los ganadores y arranca el siguiente;
// el primero empieza cuando el stream se pone en vivo y el ciclo se detiene
// cuando el stream termina.
//
// Sincronización sin servidor: las fronteras de round se derivan del RELOJ de
// pared (floor(now / CYCLE)), así todos los clientes coinciden en qué round es y
// cuánto falta, sin necesidad de un host. El puntaje del round es local
// (sessionScore − snapshot al inicio) y se comparte por broadcast para armar el
// ranking entre jugadores; en solitario el ranking es solo el jugador.

import React, {
  createContext,
  useContext,
  useRef,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useLive } from './LiveContext';
import { useScore } from './ScoreContext';
import { useMultiplayer } from './MultiplayerContext';
import { event as gaEvent } from '@/src/lib/gtag';

const COUNTDOWN_MS = 5_000; // cuenta atrás 5→1 antes de arrancar
const ROUND_MS = 180_000; // 3 minutos de juego
const RESULTS_MS = 15_000; // pantalla de ganadores
const CYCLE_MS = COUNTDOWN_MS + ROUND_MS + RESULTS_MS;

export type RoundPhase = 'waiting' | 'countdown' | 'active' | 'results';

/**
 * Puerta de juego para el resto de la app (la lee PlayerDancer en su bucle sin
 * suscribirse al contexto → cero re-renders). Sólo se puede caminar/disparar
 * durante la fase activa del round; en la cuenta atrás y en la pantalla de
 * ganadores el jugador queda quieto.
 */
export const roundGate = { canPlay: true };

export interface Standing {
  username: string;
  score: number;
  isMe: boolean;
}

interface RoundState {
  phase: RoundPhase;
  roundId: number;
  secondsLeft: number; // active: al fin del round · results: al próximo round · waiting: al próximo round
  myScore: number;
  standings: Standing[];
}

const RoundContext = createContext<RoundState | null>(null);

export const useRound = (): RoundState => {
  const ctx = useContext(RoundContext);
  if (!ctx) throw new Error('useRound must be used within RoundProvider');
  return ctx;
};

export const RoundProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isLive } = useLive();
  const { sessionScore } = useScore();
  const { sendClubFx, subscribeClubFx, username } = useMultiplayer();

  const [state, setState] = useState<RoundState>({
    phase: 'waiting',
    roundId: -1,
    secondsLeft: 0,
    myScore: 0,
    standings: [],
  });

  // Espejos por ref para leer valores frescos dentro del intervalo sin re-armarlo.
  const sessionScoreRef = useRef(sessionScore);
  sessionScoreRef.current = sessionScore;
  const isLiveRef = useRef(isLive);
  isLiveRef.current = isLive;
  const usernameRef = useRef(username);
  usernameRef.current = username;

  const roundStartScoreRef = useRef(0); // sessionScore al inicio del round actual
  const curRoundIdRef = useRef(-1);
  const curPhaseRef = useRef<RoundPhase>('waiting');
  const othersRef = useRef<Map<string, { round: number; score: number }>>(new Map());
  const frozenStandingsRef = useRef<Standing[] | null>(null); // congelado durante results
  const lastBroadcastRef = useRef(0);

  // Recibir el puntaje de round de otros jugadores.
  useEffect(() => {
    const unsub = subscribeClubFx((fx) => {
      if (fx.kind === 'round_score' && fx.from && fx.from !== usernameRef.current) {
        othersRef.current.set(fx.from, { round: fx.round, score: fx.score });
      }
    });
    return unsub;
  }, [subscribeClubFx]);

  const computeStandings = useCallback((roundId: number, myScore: number): Standing[] => {
    const me = usernameRef.current || 'Tú';
    const list: Standing[] = [{ username: me, score: myScore, isMe: true }];
    othersRef.current.forEach((v, name) => {
      if (v.round === roundId) list.push({ username: name, score: v.score, isMe: false });
    });
    list.sort((a, b) => b.score - a.score);
    return list;
  }, []);

  useEffect(() => {
    const tick = () => {
      const now = Date.now();

      // Sin stream en vivo → no hay rounds (y se puede jugar libremente).
      if (!isLiveRef.current) {
        roundGate.canPlay = true;
        if (curPhaseRef.current !== 'waiting') {
          curPhaseRef.current = 'waiting';
          curRoundIdRef.current = -1;
          othersRef.current.clear();
          frozenStandingsRef.current = null;
        }
        setState((s) =>
          s.phase === 'waiting' && s.roundId === -1
            ? s
            : { phase: 'waiting', roundId: -1, secondsLeft: 0, myScore: 0, standings: [] },
        );
        return;
      }

      const roundId = Math.floor(now / CYCLE_MS);
      const cyclePos = now % CYCLE_MS;
      const inCountdown = cyclePos < COUNTDOWN_MS;
      const inActive = !inCountdown && cyclePos < COUNTDOWN_MS + ROUND_MS;

      // Al empezar la cuenta atrás (o al entrar en vivo) se fija el snapshot:
      // el puntaje del round arranca en 0.
      if (inCountdown && curRoundIdRef.current !== roundId) {
        curRoundIdRef.current = roundId;
        roundStartScoreRef.current = sessionScoreRef.current;
        othersRef.current.clear();
        frozenStandingsRef.current = null;
        gaEvent('club_round_start', { round: roundId });
      }
      // Entrar en vivo a mitad de ciclo: fija snapshot para no arrastrar puntos.
      if (curRoundIdRef.current === -1) {
        roundStartScoreRef.current = sessionScoreRef.current;
        othersRef.current.clear();
        if (inActive) curRoundIdRef.current = roundId; // se suma al round en curso
      }

      const myScore = Math.max(0, Math.round(sessionScoreRef.current - roundStartScoreRef.current));

      if (inCountdown) {
        // Cuenta atrás 5→1: nadie se mueve ni dispara.
        roundGate.canPlay = false;
        curPhaseRef.current = 'countdown';
        const secondsLeft = Math.ceil((COUNTDOWN_MS - cyclePos) / 1000);
        setState({ phase: 'countdown', roundId, secondsLeft, myScore: 0, standings: [] });
      } else if (inActive) {
        roundGate.canPlay = true;
        curPhaseRef.current = 'active';
        const secondsLeft = Math.ceil((COUNTDOWN_MS + ROUND_MS - cyclePos) / 1000);
        if (now - lastBroadcastRef.current > 3000 && usernameRef.current) {
          lastBroadcastRef.current = now;
          sendClubFx({ kind: 'round_score', from: usernameRef.current, round: roundId, score: myScore });
        }
        setState({ phase: 'active', roundId, secondsLeft, myScore, standings: computeStandings(roundId, myScore) });
      } else {
        // Terminó el round: se congela el juego hasta el próximo.
        roundGate.canPlay = false;
        // Ventana de resultados: congela el ranking una vez.
        const secondsLeft = Math.ceil((CYCLE_MS - cyclePos) / 1000);
        if (curPhaseRef.current !== 'results') {
          curPhaseRef.current = 'results';
          if (usernameRef.current) {
            sendClubFx({ kind: 'round_score', from: usernameRef.current, round: roundId, score: myScore });
          }
          const standings = computeStandings(roundId, myScore);
          frozenStandingsRef.current = standings;
          const placement = standings.findIndex((s) => s.isMe) + 1;
          gaEvent('club_round_end', {
            round: roundId,
            winner: standings[0]?.username ?? '',
            my_score: myScore,
            placement,
            players: standings.length,
          });
        }
        setState({
          phase: 'results',
          roundId,
          secondsLeft,
          myScore,
          standings: frozenStandingsRef.current ?? computeStandings(roundId, myScore),
        });
      }
    };

    const id = setInterval(tick, 500);
    tick();
    return () => clearInterval(id);
  }, [sendClubFx, computeStandings]);

  return <RoundContext.Provider value={state}>{children}</RoundContext.Provider>;
};

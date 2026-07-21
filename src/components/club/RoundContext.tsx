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

const ROUND_MS = 180_000; // 3 minutos de juego
const RESULTS_MS = 15_000; // pantalla de ganadores
const CYCLE_MS = ROUND_MS + RESULTS_MS;

export type RoundPhase = 'waiting' | 'active' | 'results';

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

      // Sin stream en vivo → no hay rounds.
      if (!isLiveRef.current) {
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
      const inActive = cyclePos < ROUND_MS;

      // Recién puesto en vivo: fija el snapshot para no contar puntos previos.
      if (curRoundIdRef.current === -1) {
        roundStartScoreRef.current = sessionScoreRef.current;
        othersRef.current.clear();
        if (!inActive) {
          // Entramos durante la pantalla de ganadores: esperamos al próximo round.
          const secondsLeft = Math.ceil((CYCLE_MS - cyclePos) / 1000);
          curPhaseRef.current = 'waiting';
          setState({ phase: 'waiting', roundId: -1, secondsLeft, myScore: 0, standings: [] });
          return;
        }
      }

      // ¿Empezó un round nuevo? (cruce de frontera hacia la fase activa)
      if (roundId !== curRoundIdRef.current && inActive) {
        curRoundIdRef.current = roundId;
        roundStartScoreRef.current = sessionScoreRef.current;
        othersRef.current.clear();
        frozenStandingsRef.current = null;
        curPhaseRef.current = 'active';
        gaEvent('club_round_start', { round: roundId });
      }

      const myScore = Math.max(0, Math.round(sessionScoreRef.current - roundStartScoreRef.current));

      if (inActive) {
        curPhaseRef.current = 'active';
        const secondsLeft = Math.ceil((ROUND_MS - cyclePos) / 1000);
        if (now - lastBroadcastRef.current > 3000 && usernameRef.current) {
          lastBroadcastRef.current = now;
          sendClubFx({ kind: 'round_score', from: usernameRef.current, round: roundId, score: myScore });
        }
        setState({ phase: 'active', roundId, secondsLeft, myScore, standings: computeStandings(roundId, myScore) });
      } else {
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

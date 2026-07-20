'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useAuth } from './AuthContext';
import { TUNING } from './tuning';

/**
 * Capa broadcast del shooter (SUBIDÓN §5) — eventos ligeros fire-and-forget
 * sobre el MISMO canal 'nightclub' (la lógica de presence queda intacta).
 * Todo es cosmético/reconciliable: sin fiabilidad, sin estado por frame.
 */
export type ClubFxPayload =
  | { kind: 'shot'; from: string; pos: [number, number, number]; dir: [number, number, number]; color: string }
  | { kind: 'grenade'; from: string; pos: [number, number, number]; dir: [number, number, number]; color: string; speed: number; charge: number }
  | { kind: 'energy'; from: string; value: number; ts: number }
  | { kind: 'hype_drop'; from: string }
  | { kind: 'club_drop'; from: string }
  | { kind: 'bump'; from: string; to: string };

export type ClubFxListener = (fx: ClubFxPayload) => void;

export interface PlayerState {
  id: string;
  username: string;
  x: number;
  y: number;
  z: number;
  rotation: number;
  color: string;
  danceMove: number;
  jumping: boolean;
  faceType?: number;
  costumeId?: string;
  accessoryId?: string;
  lastMessage?: string;
  lastMessageAt?: number;
}

interface MultiplayerContextType {
  players: Map<string, PlayerState>;
  localPlayerId: string | null;
  username: string | null;
  setUsername: (name: string) => void;
  updatePosition: (x: number, y: number, z: number, rotation: number, danceMove?: number, jumping?: boolean) => void;
  sendChatBubble: (message: string) => void;
  lastMessage: string | null;
  lastMessageAt: number | null;
  isConnected: boolean;
  playerColor: string;
  faceType?: number;
  costumeId?: string;
  accessoryId?: string;
  /** Broadcast fire-and-forget de FX del shooter (throttle 8 msg/s) — §5 */
  sendClubFx: (payload: ClubFxPayload) => void;
  /** Suscripción a FX remotos (Set en ref, cero re-renders); devuelve unsubscribe */
  subscribeClubFx: (listener: ClubFxListener) => () => void;
}

const MultiplayerContext = createContext<MultiplayerContextType | null>(null);

const generatePlayerColor = () => {
  const colors = ['#ff0055', '#00ccff', '#00ff41', '#ff8800', '#ff00ff', '#ffff00', '#00ffff'];
  return colors[Math.floor(Math.random() * colors.length)];
};

const generatePlayerId = () => {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const MultiplayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const [localPlayerId] = useState(() => generatePlayerId());
  const [username, setUsernameState] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [fallbackColor] = useState(() => generatePlayerColor());
  const { profile } = useAuth();
  const playerColor = profile?.player_color || fallbackColor;
  const faceType = profile?.face_type;
  const costumeId = profile?.costume_id;
  const accessoryId = profile?.accessory_id;

  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const chatBubbleRef = useRef<{ lastMessage?: string; lastMessageAt?: number }>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const positionRef = useRef({ x: 0, z: 2, rotation: 0, danceMove: 0, jumping: false });

  // ── Capa broadcast del shooter (§5) — solo AÑADE; presence intacta ──
  const clubFxListenersRef = useRef<Set<ClubFxListener>>(new Set());
  // Throttle simple por ventana de 1s (límite TUNING.multi.broadcastMaxPerS)
  const fxWindowRef = useRef({ start: 0, count: 0 });

  const sendClubFx = useCallback((payload: ClubFxPayload) => {
    const channel = channelRef.current;
    if (!channel) return;
    const now = Date.now();
    const win = fxWindowRef.current;
    if (now - win.start >= 1000) {
      win.start = now;
      win.count = 0;
    }
    if (win.count >= TUNING.multi.broadcastMaxPerS) return; // se descarta: es cosmético
    win.count++;
    // Fire-and-forget: sin await, sin reintentos
    void channel.send({ type: 'broadcast', event: 'club_fx', payload });
  }, []);

  const subscribeClubFx = useCallback((listener: ClubFxListener) => {
    clubFxListenersRef.current.add(listener);
    return () => {
      clubFxListenersRef.current.delete(listener);
    };
  }, []);

  const setUsername = useCallback((name: string) => {
    localStorage.setItem('dnbchile_username', name);
    setUsernameState(name);
  }, []);

  useEffect(() => {
    if (profile?.username) {
      localStorage.setItem('dnbchile_username', profile.username);
      setUsernameState(profile.username);
    } else {
      const stored = localStorage.getItem('dnbchile_username');
      if (stored) {
        setUsernameState(stored);
      }
    }
  }, [profile?.username]);

  useEffect(() => {
    if (!username) return;

    const channel = supabase.channel('nightclub', {
      config: {
        presence: {
          key: localPlayerId,
        },
      },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const newPlayers = new Map<string, PlayerState>();

        Object.entries(state).forEach(([key, presences]) => {
          if (presences && presences.length > 0) {
            const presence = presences[0] as unknown as PlayerState;
            if (key !== localPlayerId) {
              newPlayers.set(key, presence);
            }
          }
        });

        setPlayers(newPlayers);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        if (key !== localPlayerId && newPresences.length > 0) {
          const presence = newPresences[0] as unknown as PlayerState;
          setPlayers(prev => {
            const next = new Map(prev);
            next.set(key, presence);
            return next;
          });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        setPlayers(prev => {
          const next = new Map(prev);
          next.delete(key);
          return next;
        });
      })
      // Capa broadcast del shooter (§5): FX cosméticos, sin echo propio (self: false)
      .on('broadcast', { event: 'club_fx' }, ({ payload }) => {
        const fx = payload as ClubFxPayload;
        if (!fx || typeof fx !== 'object' || !('kind' in fx)) return;
        clubFxListenersRef.current.forEach(fn => fn(fx));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: localPlayerId,
            username,
            x: positionRef.current.x,
            z: positionRef.current.z,
            rotation: positionRef.current.rotation,
            color: playerColor,
            danceMove: positionRef.current.danceMove,
            jumping: positionRef.current.jumping,
            faceType,
            costumeId,
            accessoryId,
            ...chatBubbleRef.current,
          });
          setIsConnected(true);
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
    };
  }, [username, localPlayerId, playerColor, faceType, costumeId, accessoryId]);

  const updatePosition = useCallback((x: number, y: number, z: number, rotation: number, danceMove = 0, jumping = false) => {
    positionRef.current = { x, z, rotation, danceMove, jumping };

    if (channelRef.current && username) {
      channelRef.current.track({
        id: localPlayerId,
        username,
        x,
        y,
        z,
        rotation,
        color: playerColor,
        danceMove,
        jumping,
        faceType,
        costumeId,
        accessoryId,
        ...chatBubbleRef.current,
      });
    }
  }, [localPlayerId, username, playerColor, faceType, costumeId, accessoryId]);

  const sendChatBubble = useCallback((message: string) => {
    const now = Date.now();
    chatBubbleRef.current = { lastMessage: message, lastMessageAt: now };
    setLastMessage(message);
    setLastMessageAt(now);

    if (channelRef.current && username) {
      channelRef.current.track({
        id: localPlayerId,
        username,
        x: positionRef.current.x,
        z: positionRef.current.z,
        rotation: positionRef.current.rotation,
        color: playerColor,
        danceMove: positionRef.current.danceMove,
        jumping: positionRef.current.jumping,
        faceType,
        costumeId,
        accessoryId,
        lastMessage: message,
        lastMessageAt: now,
      });
    }
  }, [localPlayerId, username, playerColor, faceType, costumeId, accessoryId]);

  const contextValue = useMemo(() => ({
    players,
    localPlayerId,
    username,
    setUsername,
    updatePosition,
    sendChatBubble,
    lastMessage,
    lastMessageAt,
    isConnected,
    playerColor,
    faceType,
    costumeId,
    accessoryId,
    sendClubFx,
    subscribeClubFx,
  }), [players, localPlayerId, username, setUsername, updatePosition, sendChatBubble,
       lastMessage, lastMessageAt, isConnected, playerColor, faceType, costumeId, accessoryId,
       sendClubFx, subscribeClubFx]);

  return (
    <MultiplayerContext.Provider value={contextValue}>
      {children}
    </MultiplayerContext.Provider>
  );
};

export const useMultiplayer = () => {
  const context = useContext(MultiplayerContext);
  if (!context) {
    throw new Error('useMultiplayer must be used within MultiplayerProvider');
  }
  return context;
};

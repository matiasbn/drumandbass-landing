'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface PlayerState {
  id: string;
  username: string;
  x: number;
  z: number;
  rotation: number;
  color: string;
  danceMove: number;
  jumping: boolean;
}

interface MultiplayerContextType {
  players: Map<string, PlayerState>;
  localPlayerId: string | null;
  username: string | null;
  setUsername: (name: string) => void;
  updatePosition: (x: number, z: number, rotation: number, danceMove?: number, jumping?: boolean) => void;
  isConnected: boolean;
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
  const [playerColor] = useState(() => generatePlayerColor());

  const channelRef = useRef<RealtimeChannel | null>(null);
  const positionRef = useRef({ x: 0, z: 2, rotation: 0, danceMove: 0, jumping: false });

  const setUsername = useCallback((name: string) => {
    localStorage.setItem('dnbchile_username', name);
    setUsernameState(name);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('dnbchile_username');
    if (stored) {
      setUsernameState(stored);
    }
  }, []);

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
  }, [username, localPlayerId, playerColor]);

  const updatePosition = useCallback((x: number, z: number, rotation: number, danceMove = 0, jumping = false) => {
    positionRef.current = { x, z, rotation, danceMove, jumping };

    if (channelRef.current && username) {
      channelRef.current.track({
        id: localPlayerId,
        username,
        x,
        z,
        rotation,
        color: playerColor,
        danceMove,
        jumping,
      });
    }
  }, [localPlayerId, username, playerColor]);

  return (
    <MultiplayerContext.Provider
      value={{
        players,
        localPlayerId,
        username,
        setUsername,
        updatePosition,
        isConnected,
      }}
    >
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

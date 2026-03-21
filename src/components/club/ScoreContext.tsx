'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from './AuthContext';

// Points per action
const POINTS: Record<string, number> = {
  jump: 1,
  danceComplete: 5,
  chat: 3,
  timePerMinute: 10,
  danceSync: 15,
  bump: 8,
  crowdHype: 20,
  wave: 5,
};

// Cooldowns in ms
const COOLDOWNS: Record<string, number> = {
  jump: 1000,
  chat: 10000,
  bump: 5000,
  danceSync: 5000,
  crowdHype: 10000,
  wave: 3000,
};

// Points needed to unlock each special move
const SPECIAL_THRESHOLDS = [100, 200, 300, 400, 500];
const SPECIAL_NAMES = ['Onda', 'Spotlight', 'Confetti', 'Levitar', 'Terremoto'];

export interface ScorePopup {
  id: number;
  points: number;
  label: string;
  x: number;
  y: number;
}

interface ScoreContextType {
  score: number;
  sessionScore: number;
  combo: number;
  specialCharges: number;
  unlockedSpecials: number;
  activeSpecial: number | null;
  playerPosition: { x: number; z: number };
  popups: ScorePopup[];
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  scoreAction: (action: string, label?: string) => void;
  useSpecial: (index: number) => boolean;
  setPlayerPosition: (x: number, z: number) => void;
  leaderboard: LeaderboardEntry[];
  refreshLeaderboard: () => void;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  player_color: string;
}

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
  const [playerPosition, setPlayerPositionState] = useState({ x: 0, z: 0 });

  const lastActionTimeRef = useRef<Record<string, number>>({});
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeAccumRef = useRef(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScoreRef = useRef(0);

  // All-time score = profile score + session score
  const allTimeScore = (profile?.score ?? 0) + sessionScore;

  // How many specials are unlocked based on session score
  const unlockedSpecials = SPECIAL_THRESHOLDS.filter(t => sessionScore >= t).length;

  // Charges: earn 1 per 100 points (first 5 also unlock moves), minus used
  const chargeInterval = SPECIAL_THRESHOLDS[0]; // 100 points per charge
  const totalChargesEarned = Math.floor(sessionScore / chargeInterval);
  const [chargesUsed, setChargesUsed] = useState(0);
  const specialCharges = Math.max(0, totalChargesEarned - chargesUsed);

  // Save score to DB periodically (batch writes)
  const flushScore = useCallback(async () => {
    if (!profile || pendingScoreRef.current === 0) return;
    const points = pendingScoreRef.current;
    pendingScoreRef.current = 0;

    try {
      // Increment score atomically using RPC or update
      const newScore = (profile.score ?? 0) + points;
      const newHighScore = Math.max(profile.high_score ?? 0, newScore);
      await supabase
        .from('profiles')
        .update({ score: newScore, high_score: newHighScore })
        .eq('user_id', profile.user_id);
    } catch (e) {
      console.error('Failed to save score:', e);
      // Re-add points on failure
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
    // Random horizontal offset for variety
    const x = (Math.random() - 0.5) * 60;
    setPopups(prev => [...prev, { id, points, label, x, y: 0 }]);
    // Remove after animation
    setTimeout(() => {
      setPopups(prev => prev.filter(p => p.id !== id));
    }, 1500);
  }, []);

  const scoreAction = useCallback((action: string, label?: string) => {
    if (!enabled) return;

    const now = Date.now();
    const cooldown = COOLDOWNS[action as keyof typeof COOLDOWNS] ?? 0;
    const lastTime = lastActionTimeRef.current[action] ?? 0;

    if (cooldown > 0 && now - lastTime < cooldown) return;
    lastActionTimeRef.current[action] = now;

    const basePoints = POINTS[action as keyof typeof POINTS] ?? 0;
    if (basePoints === 0) return;

    // Combo system: consecutive actions within 5s
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    setCombo(prev => {
      const newCombo = prev + 1;
      const multiplier = Math.min(newCombo, 5); // max 5x
      const totalPoints = basePoints * (multiplier > 1 ? multiplier : 1);

      setSessionScore(s => s + totalPoints);
      pendingScoreRef.current += totalPoints;

      const displayLabel = label || action;
      const comboText = multiplier > 1 ? ` x${multiplier}` : '';
      addPopup(totalPoints, `${displayLabel}${comboText}`);

      // Schedule batch save every 10s
      if (!saveTimerRef.current) {
        saveTimerRef.current = setTimeout(() => {
          flushScore();
          saveTimerRef.current = null;
        }, 10000);
      }

      return newCombo;
    });

    // Reset combo after 5s of inactivity
    comboTimerRef.current = setTimeout(() => {
      setCombo(0);
    }, 5000);
  }, [enabled, addPopup, flushScore]);

  // Time-based scoring: +10 per minute
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      timeAccumRef.current += 1;
      if (timeAccumRef.current >= 60) {
        timeAccumRef.current = 0;
        scoreAction('timePerMinute', 'Vibing');
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

  const setPlayerPosition = useCallback((x: number, z: number) => {
    setPlayerPositionState({ x, z });
  }, []);

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

  return (
    <ScoreContext.Provider
      value={{
        score: allTimeScore,
        sessionScore,
        combo,
        specialCharges,
        unlockedSpecials,
        activeSpecial,
        playerPosition,
        popups,
        enabled,
        setEnabled,
        scoreAction,
        useSpecial,
        setPlayerPosition,
        leaderboard,
        refreshLeaderboard,
      }}
    >
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

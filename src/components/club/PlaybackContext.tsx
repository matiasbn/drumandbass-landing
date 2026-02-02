'use client';

import React, { createContext, useContext, useState, useRef, ReactNode, MutableRefObject } from 'react';

interface PlaybackContextType {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  isPlayingRef: MutableRefObject<boolean>;
  trackTitle: string;
  setTrackTitle: (title: string) => void;
  registerTogglePlay: (fn: () => void) => void;
  togglePlay: () => void;
}

const PlaybackContext = createContext<PlaybackContextType>({
  isPlaying: false,
  setIsPlaying: () => {},
  isPlayingRef: { current: false },
  trackTitle: '',
  setTrackTitle: () => {},
  registerTogglePlay: () => {},
  togglePlay: () => {},
});

export const usePlayback = () => useContext(PlaybackContext);

export const PlaybackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlayingState] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const isPlayingRef = useRef(false);
  const togglePlayRef = useRef<(() => void) | null>(null);

  const setIsPlaying = (playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlayingState(playing);
  };

  const registerTogglePlay = (fn: () => void) => {
    togglePlayRef.current = fn;
  };

  const togglePlay = () => {
    togglePlayRef.current?.();
  };

  return (
    <PlaybackContext.Provider value={{ isPlaying, setIsPlaying, isPlayingRef, trackTitle, setTrackTitle, registerTogglePlay, togglePlay }}>
      {children}
    </PlaybackContext.Provider>
  );
};

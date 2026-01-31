'use client';

import React, { createContext, useContext, useState, useRef, ReactNode, MutableRefObject } from 'react';

interface PlaybackContextType {
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  isPlayingRef: MutableRefObject<boolean>;
}

const PlaybackContext = createContext<PlaybackContextType>({
  isPlaying: false,
  setIsPlaying: () => {},
  isPlayingRef: { current: false },
});

export const usePlayback = () => useContext(PlaybackContext);

export const PlaybackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlayingState] = useState(false);
  const isPlayingRef = useRef(false);

  const setIsPlaying = (playing: boolean) => {
    isPlayingRef.current = playing;
    setIsPlayingState(playing);
  };

  return (
    <PlaybackContext.Provider value={{ isPlaying, setIsPlaying, isPlayingRef }}>
      {children}
    </PlaybackContext.Provider>
  );
};

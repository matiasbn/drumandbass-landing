'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface LiveContextType {
  isLive: boolean;
  youtubeVideoId: string | null;
  liveTitle: string | null;
}

const LiveContext = createContext<LiveContextType>({
  isLive: false,
  youtubeVideoId: null,
  liveTitle: null,
});

export const useLive = () => useContext(LiveContext);

export const LiveProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLive, setIsLive] = useState(false);
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [liveTitle, setLiveTitle] = useState<string | null>(null);

  const fetchLiveStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/live');
      const data = await res.json();
      setIsLive(data.isLive);
      setYoutubeVideoId(data.youtubeVideoId);
      setLiveTitle(data.title);
    } catch {
      // Keep current state on error
    }
  }, []);

  useEffect(() => {
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchLiveStatus]);

  return (
    <LiveContext.Provider value={{ isLive, youtubeVideoId, liveTitle }}>
      {children}
    </LiveContext.Provider>
  );
};

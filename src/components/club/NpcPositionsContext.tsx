'use client';

import React, { createContext, useContext, useRef, ReactNode } from 'react';

interface NpcPositionsContextType {
  positions: React.MutableRefObject<Map<string, { x: number; y: number; z: number }>>;
}

const NpcPositionsContext = createContext<NpcPositionsContextType | null>(null);

export const NpcPositionsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const positions = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());
  return (
    <NpcPositionsContext.Provider value={{ positions }}>
      {children}
    </NpcPositionsContext.Provider>
  );
};

export const useNpcPositions = () => {
  const ctx = useContext(NpcPositionsContext);
  if (!ctx) throw new Error('useNpcPositions must be used within NpcPositionsProvider');
  return ctx;
};

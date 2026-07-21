'use client';

import React, { createContext, useContext, useRef, ReactNode } from 'react';
import * as THREE from 'three';

interface CameraContextType {
  /** Updated by PlayerDancer every frame */
  playerPosRef: React.MutableRefObject<THREE.Vector3>;
  /** Camera yaw (horizontal rotation) — shared between camera and player */
  cameraYawRef: React.MutableRefObject<number>;
  /** Camera pitch (vertical tilt) */
  cameraPitchRef: React.MutableRefObject<number>;
  /** Whether pointer is locked (desktop mouse look active) */
  pointerLockedRef: React.MutableRefObject<boolean>;
}

const CameraContext = createContext<CameraContextType | null>(null);

export const CameraProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const playerPosRef = useRef(new THREE.Vector3(0, 0, 6));
  const cameraYawRef = useRef(Math.PI); // start facing toward DJ at center
  const cameraPitchRef = useRef(0.15); // slight downward angle
  const pointerLockedRef = useRef(false);

  return (
    <CameraContext.Provider value={{ playerPosRef, cameraYawRef, cameraPitchRef, pointerLockedRef }}>
      {children}
    </CameraContext.Provider>
  );
};

export const useCamera = () => {
  const ctx = useContext(CameraContext);
  if (!ctx) throw new Error('useCamera must be used within CameraProvider');
  return ctx;
};

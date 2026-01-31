'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Scene } from './components/Scene';
import { usePlayback } from './PlaybackContext';

export const NightclubCanvas: React.FC = () => {
  const { isPlayingRef } = usePlayback();

  return (
    <Canvas
      shadows
      camera={{
        position: [12, 10, 12],
        fov: 50,
        near: 0.1,
        far: 100,
      }}
      style={{ background: '#000000' }}
    >
      <Scene isPlayingRef={isPlayingRef} />
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={8}
        maxDistance={40}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.5}
      />
      <fog attach="fog" args={['#050508', 25, 60]} />
    </Canvas>
  );
};

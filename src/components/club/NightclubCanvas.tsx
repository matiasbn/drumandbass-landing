'use client';

import React from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Scene } from './components/Scene';
import { ThirdPersonCamera } from './components/ThirdPersonCamera';
import { usePlayback } from './PlaybackContext';
import { useLive } from './LiveContext';

interface NightclubCanvasProps {
  antialias?: boolean;
}

export const NightclubCanvas: React.FC<NightclubCanvasProps> = ({ antialias = true }) => {
  const { isPlayingRef } = usePlayback();
  const { isLive, youtubeVideoId } = useLive();

  return (
    <Canvas
      camera={{
        position: [0, 10, 18],
        fov: 55,
        near: 0.1,
        far: 200,
      }}
      dpr={1}
      gl={{ powerPreference: 'high-performance', antialias }}
      style={{ background: '#000000' }}
    >
      <Scene isPlayingRef={isPlayingRef} isLive={isLive} youtubeVideoId={youtubeVideoId} />
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={0.8}
          luminanceThreshold={0.5}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
      <ThirdPersonCamera />
      <fog attach="fog" args={['#050508', 30, 120]} />
    </Canvas>
  );
};

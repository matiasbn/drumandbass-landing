'use client';

// Canvas del club (WS-3): Bloom y dpr condicionados por la calidad gráfica.
//   Alta:  Bloom + dpr hasta 1.5
//   Media: Bloom + dpr 1
//   Baja:  sin Bloom (ni EffectComposer) + dpr 1
// El neón HDR (materials.ts, toneMapped=false) sigue leyéndose bien sin Bloom.

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { Scene } from './components/Scene';
import { ThirdPersonCamera } from './components/ThirdPersonCamera';
import { usePlayback } from './PlaybackContext';
import { useLive } from './LiveContext';
import { useQuality } from './quality';

interface NightclubCanvasProps {
  antialias?: boolean;
}

/**
 * Sonda de perf SOLO en dev (§8 del diseño): expone gl.info.render.calls en
 * window.__dnbDrawCalls una vez por segundo para medir el presupuesto (≤60).
 */
const DrawCallProbe: React.FC = () => {
  const lastRef = useRef(0);
  useFrame(({ gl, clock }) => {
    // autoReset borra el contador en cada pase del EffectComposer: acumular a mano.
    // Al inicio del frame, lo acumulado es el frame ANTERIOR completo (todos los pases).
    gl.info.autoReset = false;
    const t = clock.getElapsedTime();
    if (t - lastRef.current >= 1) {
      lastRef.current = t;
      (window as unknown as Record<string, unknown>).__dnbDrawCalls = {
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
      };
    }
    gl.info.reset();
  });
  return null;
};

export const NightclubCanvas: React.FC<NightclubCanvasProps> = ({ antialias = true }) => {
  const { isPlayingRef } = usePlayback();
  const { isLive, youtubeVideoId } = useLive();
  const quality = useQuality();

  const dpr: number | [number, number] = quality === 'alta' ? [1, 1.5] : 1;

  return (
    <Canvas
      camera={{
        position: [0, 10, 18],
        fov: 55,
        near: 0.1,
        far: 200,
      }}
      dpr={dpr}
      gl={{ powerPreference: 'high-performance', antialias }}
      style={{ background: '#000000' }}
    >
      <Scene isPlayingRef={isPlayingRef} isLive={isLive} youtubeVideoId={youtubeVideoId} />
      {quality !== 'baja' && (
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.8}
            luminanceThreshold={0.5}
            luminanceSmoothing={0.9}
            mipmapBlur
          />
        </EffectComposer>
      )}
      <ThirdPersonCamera />
      {process.env.NODE_ENV === 'development' && <DrawCallProbe />}
      <fog attach="fog" args={['#050508', 30, 120]} />
    </Canvas>
  );
};

'use client';

import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { DEFAULT_CLUB_VIDEO_ID, DEFAULT_CLUB_VIDEO_START } from '@/src/lib/clubStream';

interface LiveScreenProps {
  isLive: boolean;
  youtubeVideoId?: string | null;
}

export const LiveScreen: React.FC<LiveScreenProps> = ({ isLive, youtubeVideoId }) => {
  const glowRef = useRef<THREE.Mesh>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);
  const [interacting, setInteracting] = useState(false);

  useFrame(({ clock }) => {
    if (!isLive) return;
    const t = clock.getElapsedTime();
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15;
    }
    if (indicatorRef.current) {
      indicatorRef.current.visible = Math.sin(t * 3) > -0.3;
    }
  });

  return (
    // Pantalla ALTA y GRANDE, e INCLINADA hacia abajo (como las de un venue):
    // su borde inferior queda en ~7.5, por encima de quien esté parado en la
    // plataforma alta (5.5) — nadie choca con ella — y al estar angulada se
    // sigue leyendo bien desde la pista sin tener que mirar hacia arriba.
    <group position={[0, 11.5, -14]} rotation={[0.18, 0, 0]}>
      {/* Screen frame */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[15.2, 8.7, 0.1]} />
        <meshStandardMaterial color="#111111" />
      </mesh>

      {/* Screen surface */}
      <mesh ref={glowRef}>
        <planeGeometry args={[14.4, 8.1]} />
        <meshStandardMaterial
          color={youtubeVideoId ? '#000000' : '#050508'}
          emissive={isLive && !youtubeVideoId ? '#4444ff' : '#000000'}
          emissiveIntensity={isLive && !youtubeVideoId ? 0.3 : 0}
        />
      </mesh>

      {/* YouTube iframe — suena el live si lo hay, y si no el video por defecto */}
      {youtubeVideoId && (
        <Html
          transform
          position={[0, 0.2, 0.02]}
          distanceFactor={9.3}
          zIndexRange={[10, 0]}
          style={{
            width: 640,
            height: 360,
          }}
          wrapperClass={interacting ? '' : 'pointer-events-none'}
        >
          <div style={{ position: 'relative', width: 640, height: 360 }}>
            <iframe
              data-testid="youtube-iframe"
              src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&mute=0&rel=0&playsinline=1${
                youtubeVideoId === DEFAULT_CLUB_VIDEO_ID
                  ? `&start=${DEFAULT_CLUB_VIDEO_START}&loop=1&playlist=${DEFAULT_CLUB_VIDEO_ID}`
                  : ''
              }`}
              style={{ width: 640, height: 360, border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {!interacting && (
              <div
                onClick={() => setInteracting(true)}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 1,
                  cursor: 'pointer',
                  pointerEvents: 'auto',
                }}
              />
            )}
          </div>
        </Html>
      )}

      {/* LIVE indicator */}
      {isLive && (
        <mesh ref={indicatorRef} position={[6.4, 3.5, 0.02]}>
          <circleGeometry args={[0.22, 16]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
        </mesh>
      )}
    </group>
  );
};

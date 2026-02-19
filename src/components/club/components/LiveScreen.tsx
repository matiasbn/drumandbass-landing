'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface LiveScreenProps {
  isLive: boolean;
  youtubeVideoId?: string | null;
}

export const LiveScreen: React.FC<LiveScreenProps> = ({ isLive, youtubeVideoId }) => {
  const glowRef = useRef<THREE.Mesh>(null);
  const indicatorRef = useRef<THREE.Mesh>(null);

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
    <group position={[0, 4.5, -6.5]}>
      {/* Screen frame */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[9, 5.2, 0.1]} />
        <meshStandardMaterial color="#111111" />
      </mesh>

      {/* Screen surface */}
      <mesh ref={glowRef}>
        <planeGeometry args={[8.5, 4.8]} />
        <meshStandardMaterial
          color={isLive ? '#0a0a1a' : '#050508'}
          emissive={isLive ? '#4444ff' : '#000000'}
          emissiveIntensity={isLive ? 0.3 : 0}
        />
      </mesh>

      {/* YouTube iframe on the main screen */}
      {isLive && youtubeVideoId && (
        <Html
          transform
          position={[0, 0.5, 0.02]}
          distanceFactor={5.5}
          style={{
            width: 640,
            height: 360,
          }}
          wrapperClass="pointer-events-none"
        >
          <iframe
            data-testid="youtube-iframe"
            src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0`}
            style={{ width: 640, height: 360, border: 'none', pointerEvents: 'auto' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </Html>
      )}

      {/* LIVE indicator - red dot */}
      {isLive && (
        <mesh ref={indicatorRef} position={[3.5, 2.0, 0.02]}>
          <circleGeometry args={[0.15, 16]} />
          <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
        </mesh>
      )}
    </group>
  );
};

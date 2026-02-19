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
  const sideGlowRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!isLive) return;
    const t = clock.getElapsedTime();
    // Main screen glow
    if (glowRef.current) {
      const mat = glowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.3 + Math.sin(t * 2) * 0.15;
    }
    // Side screen glow
    if (sideGlowRef.current) {
      const mat = sideGlowRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + Math.sin(t * 2.5) * 0.2;
    }
    // Blinking LIVE indicator
    if (indicatorRef.current) {
      indicatorRef.current.visible = Math.sin(t * 3) > -0.3;
    }
  });

  return (
    <>
      {/* Main screen behind DJ */}
      <group position={[0, 4.5, -6.5]}>
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[9, 5.2, 0.1]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
        <mesh ref={glowRef}>
          <planeGeometry args={[8.5, 4.8]} />
          <meshStandardMaterial
            color={isLive ? '#0a0a1a' : '#050508'}
            emissive={isLive ? '#4444ff' : '#000000'}
            emissiveIntensity={isLive ? 0.3 : 0}
          />
        </mesh>
        {isLive && (
          <mesh ref={indicatorRef} position={[3.5, 2.0, 0.02]}>
            <circleGeometry args={[0.15, 16]} />
            <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={2} />
          </mesh>
        )}
      </group>

      {/* Side screen - right wall next to DJ */}
      {isLive && youtubeVideoId && (
        <group position={[5.5, 3, -3]} rotation={[0, -Math.PI / 3, 0]}>
          {/* Screen frame */}
          <mesh position={[0, 0, -0.06]}>
            <boxGeometry args={[5.2, 3.1, 0.12]} />
            <meshStandardMaterial color="#111111" />
          </mesh>

          {/* Screen surface with glow */}
          <mesh ref={sideGlowRef}>
            <planeGeometry args={[4.8, 2.7]} />
            <meshStandardMaterial
              color="#0a0a1a"
              emissive="#4444ff"
              emissiveIntensity={0.4}
            />
          </mesh>

          {/* YouTube iframe */}
          <Html
            transform
            position={[0, 0, 0.02]}
            distanceFactor={5}
            style={{
              width: 640,
              height: 360,
              pointerEvents: 'auto',
            }}
          >
            <iframe
              data-testid="youtube-iframe"
              src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=1&rel=0`}
              style={{ width: 640, height: 360, border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </Html>

          {/* Neon frame edges */}
          <mesh position={[0, 1.55, -0.04]}>
            <boxGeometry args={[5.2, 0.04, 0.04]} />
            <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={3} />
          </mesh>
          <mesh position={[0, -1.55, -0.04]}>
            <boxGeometry args={[5.2, 0.04, 0.04]} />
            <meshStandardMaterial color="#00ccff" emissive="#00ccff" emissiveIntensity={3} />
          </mesh>
        </group>
      )}
    </>
  );
};

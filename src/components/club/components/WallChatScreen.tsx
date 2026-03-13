'use client';

import React from 'react';
import { Html } from '@react-three/drei';

interface WallChatScreenProps {
  youtubeVideoId: string;
}

export const WallChatScreen: React.FC<WallChatScreenProps> = ({ youtubeVideoId }) => {
  const embedDomain = typeof window !== 'undefined' ? window.location.hostname : '';

  return (
    <group position={[-7, 3.5, -3]} rotation={[0, Math.PI / 2, 0]}>
      {/* Screen frame */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[6, 5, 0.1]} />
        <meshStandardMaterial color="#111111" />
      </mesh>

      {/* Screen surface */}
      <mesh>
        <planeGeometry args={[5.6, 4.6]} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      {/* YouTube live chat iframe */}
      <Html
        transform
        occlude="blending"
        position={[0, 0, 0.02]}
        distanceFactor={4.5}
        zIndexRange={[10, 0]}
        style={{
          width: 420,
          height: 600,
        }}
        wrapperClass="pointer-events-none"
      >
        <iframe
          src={`https://www.youtube.com/live_chat?v=${youtubeVideoId}&embed_domain=${embedDomain}`}
          style={{ width: 420, height: 600, border: 'none', pointerEvents: 'auto' }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        />
      </Html>
    </group>
  );
};

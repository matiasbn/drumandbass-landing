'use client';

import React, { useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFaceTexture } from './useFaceTexture';

interface DancerProps {
  position: [number, number, number];
  color?: string;
  animationOffset?: number;
  animationSpeed?: number;
  isPlayingRef: MutableRefObject<boolean>;
  name?: string;
  rotationY?: number;
}

export const Dancer: React.FC<DancerProps> = ({
  position,
  color = '#333333',
  animationOffset = 0,
  animationSpeed = 1,
  isPlayingRef,
  name = 'NPC',
  rotationY = 0,
}) => {
  const faceTexture = useFaceTexture(name);
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const frozenTimeRef = useRef<number>(0);

  useFrame(({ clock }) => {
    const isPlaying = isPlayingRef.current;

    if (isPlaying) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const time = frozenTimeRef.current * animationSpeed + animationOffset;

    if (groupRef.current) {
      groupRef.current.position.y = position[1] + Math.sin(time * 4) * 0.15;
    }

    if (headRef.current) {
      headRef.current.rotation.z = Math.sin(time * 2) * 0.1;
      headRef.current.position.y = 1.5 + Math.sin(time * 4) * 0.03;
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.z = -0.3 + Math.sin(time * 3) * 0.4;
      leftArmRef.current.rotation.x = Math.sin(time * 2 + 0.5) * 0.3;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.z = 0.3 - Math.sin(time * 3 + Math.PI) * 0.4;
      rightArmRef.current.rotation.x = Math.sin(time * 2 + 1.5) * 0.3;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.4, 0.6, 0.25]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <group ref={headRef} position={[0, 1.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.35, 0.28]} />
          <meshStandardMaterial color="#e0c4a8" />
        </mesh>
        {faceTexture && (
          <mesh position={[0, 0, 0.141]}>
            <planeGeometry args={[0.3, 0.35]} />
            <meshBasicMaterial map={faceTexture} />
          </mesh>
        )}
      </group>

      <mesh ref={leftArmRef} position={[-0.3, 1.1, 0]} castShadow>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh ref={rightArmRef} position={[0.3, 1.1, 0]} castShadow>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[-0.1, 0.35, 0]} castShadow>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[0.1, 0.35, 0]} castShadow>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
    </group>
  );
};

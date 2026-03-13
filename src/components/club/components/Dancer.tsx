'use client';

import React, { useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFaceTexture } from './useFaceTexture';

const WANDER_BOUNDS = { minX: -4, maxX: 4, minZ: 0, maxZ: 5 };
const MOVE_SPEED = 0.4;
const ARRIVAL_THRESHOLD = 0.3;

function pickRandomTarget() {
  return {
    x: WANDER_BOUNDS.minX + Math.random() * (WANDER_BOUNDS.maxX - WANDER_BOUNDS.minX),
    z: WANDER_BOUNDS.minZ + Math.random() * (WANDER_BOUNDS.maxZ - WANDER_BOUNDS.minZ),
  };
}

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

  // Wander state
  const currentPos = useRef({ x: position[0], z: position[2] });
  const targetPos = useRef(pickRandomTarget());
  const currentRotY = useRef(rotationY);
  const waitTimer = useRef(0);
  const lastTime = useRef(0);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const delta = elapsed - lastTime.current;
    lastTime.current = elapsed;

    // Clamp delta to avoid jumps on tab switch
    const dt = Math.min(delta, 0.1);

    // --- Wander movement (always active) ---
    if (waitTimer.current > 0) {
      waitTimer.current -= dt;
      if (waitTimer.current <= 0) {
        targetPos.current = pickRandomTarget();
      }
    } else {
      const dx = targetPos.current.x - currentPos.current.x;
      const dz = targetPos.current.z - currentPos.current.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < ARRIVAL_THRESHOLD) {
        // Arrived — wait 1-3 seconds before picking a new target
        waitTimer.current = 1 + Math.random() * 2;
      } else {
        // Move toward target
        const speed = MOVE_SPEED * animationSpeed * dt;
        const step = Math.min(speed, dist);
        currentPos.current.x += (dx / dist) * step;
        currentPos.current.z += (dz / dist) * step;

        // Rotate to face movement direction
        const targetAngle = Math.atan2(dx, dz);
        // Lerp rotation
        let angleDiff = targetAngle - currentRotY.current;
        // Normalize to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        currentRotY.current += angleDiff * Math.min(dt * 3, 1);
      }
    }

    if (groupRef.current) {
      groupRef.current.position.x = currentPos.current.x;
      groupRef.current.position.z = currentPos.current.z;
      groupRef.current.rotation.y = currentRotY.current;
    }

    // --- Dance animation (only when music plays) ---
    const isPlaying = isPlayingRef.current;
    if (isPlaying) {
      frozenTimeRef.current = elapsed;
    }
    const time = frozenTimeRef.current * animationSpeed + animationOffset;

    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(time * 4) * 0.15;
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

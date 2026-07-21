'use client';

import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface HealthBar3DProps {
  /** Ref to read hype state from (avoids re-renders) */
  healthRef: React.MutableRefObject<{ hype: number; maxHype: number; hyped: boolean }>;
  /** Y offset above the parent group */
  yOffset?: number;
}

// Pre-allocated colors — module-level to avoid GC
const cyan = new THREE.Color(0x00ccff);
const purple = new THREE.Color(0x9933ff);
const gold = new THREE.Color(0xffdd00);
const tmpColor = new THREE.Color();

const BAR_WIDTH = 0.8;
const BAR_HEIGHT = 0.08;

/**
 * 3D hype bar rendered as meshes.
 * Uses useFrame with low priority to batch updates efficiently.
 */
export const HealthBar3D: React.FC<HealthBar3DProps> = ({ healthRef, yOffset = 2.3 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const fillRef = useRef<THREE.Mesh>(null);
  const fillMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const bgRef = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    const h = healthRef.current;
    if (!fillRef.current || !fillMatRef.current || !bgRef.current || !groupRef.current) return;

    const ratio = Math.max(0, Math.min(1, h.hype / h.maxHype));

    if (ratio <= 0 && !h.hyped) {
      fillRef.current.visible = false;
      bgRef.current.visible = false;
      return;
    }

    fillRef.current.visible = true;
    bgRef.current.visible = true;

    const displayRatio = h.hyped ? 1 : ratio;
    fillRef.current.scale.x = Math.max(0.001, displayRatio);
    fillRef.current.position.x = -(BAR_WIDTH * (1 - displayRatio)) / 2;

    if (ratio <= 0.5) {
      tmpColor.copy(cyan).lerp(purple, ratio / 0.5);
    } else {
      tmpColor.copy(purple).lerp(gold, (ratio - 0.5) / 0.5);
    }
    fillMatRef.current.color.copy(tmpColor);

    if (h.hyped) {
      const time = performance.now() * 0.001;
      fillMatRef.current.opacity = 0.6 + 0.4 * Math.sin(time * 8);
      fillMatRef.current.color.copy(gold);
      const s = 1 + 0.15 * Math.sin(time * 6);
      groupRef.current.scale.set(s, s, s);
    } else {
      fillMatRef.current.opacity = 1;
      groupRef.current.scale.set(1, 1, 1);
    }

    groupRef.current.lookAt(camera.position);
  }, -1);

  return (
    <group ref={groupRef} position={[0, yOffset, 0]}>
      <mesh ref={bgRef} position={[0, 0, -0.005]}>
        <planeGeometry args={[BAR_WIDTH + 0.04, BAR_HEIGHT + 0.04]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.7} depthTest={false} />
      </mesh>
      <mesh ref={fillRef}>
        <planeGeometry args={[BAR_WIDTH, BAR_HEIGHT]} />
        <meshBasicMaterial ref={fillMatRef} color="#00ccff" transparent opacity={1} depthTest={false} />
      </mesh>
    </group>
  );
};

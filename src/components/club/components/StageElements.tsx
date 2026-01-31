'use client';

import React, { useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
  warningOrange: '#ff8800',
};

interface SpeakerProps {
  position: [number, number, number];
  scale?: number;
  isPlayingRef: MutableRefObject<boolean>;
}

const Speaker: React.FC<SpeakerProps> = ({ position, scale = 1, isPlayingRef }) => {
  const coneRef = useRef<THREE.Mesh>(null);
  const frozenTimeRef = useRef<number>(0);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    if (coneRef.current) {
      coneRef.current.scale.z = 1 + Math.sin(frozenTimeRef.current * 8) * 0.05;
    }
  });

  return (
    <group position={position} scale={scale}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.1, 1.6, 0.85]} />
        <meshStandardMaterial color="#1a1410" metalness={0.1} roughness={0.9} />
      </mesh>

      <mesh position={[0, 0, 0.43]}>
        <boxGeometry args={[1.0, 1.5, 0.02]} />
        <meshStandardMaterial color="#252525" metalness={0.1} roughness={0.95} />
      </mesh>

      {[[-0.5, 0.75], [0.5, 0.75], [-0.5, -0.75], [0.5, -0.75]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.44]}>
          <boxGeometry args={[0.15, 0.15, 0.02]} />
          <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}

      <mesh position={[0, -0.2, 0.44]}>
        <ringGeometry args={[0.32, 0.4, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} side={2} />
      </mesh>

      <mesh position={[0, -0.2, 0.44]} ref={coneRef}>
        <circleGeometry args={[0.32, 32]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.2} roughness={0.8} />
      </mesh>

      <mesh position={[0, -0.2, 0.46]}>
        <circleGeometry args={[0.1, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.1} roughness={0.6} />
      </mesh>

      <mesh position={[0, 0.4, 0.44]}>
        <cylinderGeometry args={[0.08, 0.15, 0.12, 16]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0.4, 0.38]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.2} />
      </mesh>

      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.5, 0.08, 0.15]} />
        <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.4} />
      </mesh>

      <mesh position={[0, 0.65, 0.44]}>
        <boxGeometry args={[0.3, 0.08, 0.01]} />
        <meshStandardMaterial color="#888888" metalness={0.9} roughness={0.2} />
      </mesh>

      <mesh position={[0.35, 0.65, 0.44]}>
        <circleGeometry args={[0.025, 16]} />
        <meshStandardMaterial color={COLORS.matrixGreen} emissive={COLORS.matrixGreen} emissiveIntensity={2} />
      </mesh>
    </group>
  );
};

interface SubwooferProps {
  position: [number, number, number];
  isPlayingRef: MutableRefObject<boolean>;
}

const Subwoofer: React.FC<SubwooferProps> = ({ position, isPlayingRef }) => {
  const coneRef = useRef<THREE.Mesh>(null);
  const frozenTimeRef = useRef<number>(0);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    if (coneRef.current) {
      coneRef.current.scale.z = 1 + Math.sin(frozenTimeRef.current * 4) * 0.08;
    }
  });

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0f0f0f" metalness={0.1} roughness={0.85} />
      </mesh>

      <mesh position={[0, 0, 0.51]}>
        <boxGeometry args={[0.9, 0.9, 0.02]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.2} roughness={0.9} />
      </mesh>

      <mesh position={[0, 0, 0.52]} ref={coneRef}>
        <circleGeometry args={[0.38, 32]} />
        <meshStandardMaterial color="#252525" metalness={0.15} roughness={0.8} />
      </mesh>

      <mesh position={[0, 0, 0.54]}>
        <circleGeometry args={[0.12, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.1} roughness={0.7} />
      </mesh>

      {[[-0.4, -0.52], [0.4, -0.52], [-0.4, -0.52], [0.4, -0.52]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, i < 2 ? -0.4 : 0.4]}>
          <cylinderGeometry args={[0.05, 0.06, 0.05, 8]} />
          <meshStandardMaterial color="#333333" metalness={0.9} roughness={0.3} />
        </mesh>
      ))}

      <mesh position={[0, 0.4, 0.51]}>
        <boxGeometry args={[0.25, 0.06, 0.01]} />
        <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
};

interface LaserBeamProps {
  start: [number, number, number];
  angle: number;
  color: string;
  isPlayingRef: MutableRefObject<boolean>;
}

const LaserBeam: React.FC<LaserBeamProps> = ({ start, angle, color, isPlayingRef }) => {
  const beamRef = useRef<THREE.Mesh>(null);
  const frozenTimeRef = useRef<number>(0);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    if (beamRef.current) {
      beamRef.current.rotation.z = angle + Math.sin(frozenTimeRef.current * 2) * 0.3;
    }
  });

  return (
    <mesh ref={beamRef} position={start}>
      <boxGeometry args={[0.02, 8, 0.02]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2} transparent opacity={0.6} />
    </mesh>
  );
};

interface StageElementsProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const StageElements: React.FC<StageElementsProps> = ({ isPlayingRef }) => {
  return (
    <group>
      <Speaker position={[-5, 0.8, -3.5]} scale={1} isPlayingRef={isPlayingRef} />
      <Speaker position={[-5, 2.4, -3.5]} scale={1} isPlayingRef={isPlayingRef} />
      <Speaker position={[5, 0.8, -3.5]} scale={1} isPlayingRef={isPlayingRef} />
      <Speaker position={[5, 2.4, -3.5]} scale={1} isPlayingRef={isPlayingRef} />

      <Subwoofer position={[-5.5, 0.5, -2]} isPlayingRef={isPlayingRef} />
      <Subwoofer position={[5.5, 0.5, -2]} isPlayingRef={isPlayingRef} />
      <Subwoofer position={[-3.5, 0.5, -5]} isPlayingRef={isPlayingRef} />
      <Subwoofer position={[3.5, 0.5, -5]} isPlayingRef={isPlayingRef} />

      <LaserBeam start={[-3, 7, -5]} angle={0.3} color={COLORS.cyberBlue} isPlayingRef={isPlayingRef} />
      <LaserBeam start={[3, 7, -5]} angle={-0.3} color={COLORS.neonPink} isPlayingRef={isPlayingRef} />
      <LaserBeam start={[-2, 7, -5]} angle={0.15} color={COLORS.matrixGreen} isPlayingRef={isPlayingRef} />
      <LaserBeam start={[2, 7, -5]} angle={-0.15} color={COLORS.matrixGreen} isPlayingRef={isPlayingRef} />
      <LaserBeam start={[0, 7, -5]} angle={0} color={COLORS.warningOrange} isPlayingRef={isPlayingRef} />

      {[-4, -2, 0, 2, 4].map((x, i) => (
        <mesh key={i} position={[x, 0.02, -2.8]}>
          <boxGeometry args={[0.4, 0.04, 0.15]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? COLORS.neonPink : COLORS.cyberBlue}
            emissive={i % 2 === 0 ? COLORS.neonPink : COLORS.cyberBlue}
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}

      <group>
        <mesh position={[0, 8, 0]}>
          <boxGeometry args={[14, 0.2, 0.2]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[0, 8, -5]}>
          <boxGeometry args={[14, 0.2, 0.2]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>

        <mesh position={[-7, 8, -2.5]}>
          <boxGeometry args={[0.2, 0.2, 5.4]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[7, 8, -2.5]}>
          <boxGeometry args={[0.2, 0.2, 5.4]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>

        {[-5, -2.5, 0, 2.5, 5].map((x, i) => (
          <mesh key={`brace-${i}`} position={[x, 8, -2.5]}>
            <boxGeometry args={[0.1, 0.1, 5.2]} />
            <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}

        {[[-6.5, -5], [6.5, -5], [-6.5, 0], [6.5, 0]].map(([x, z], i) => (
          <mesh key={`support-${i}`} position={[x, 4, z]}>
            <boxGeometry args={[0.15, 8, 0.15]} />
            <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {[-4, -2, 0, 2, 4].map((x, i) => (
        <group key={`light-${i}`} position={[x, 7.8, -2.5]}>
          <mesh>
            <boxGeometry args={[0.3, 0.25, 0.3]} />
            <meshStandardMaterial color="#222222" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.1, 0.12, 0.1, 16]} />
            <meshStandardMaterial
              color={[COLORS.cyberBlue, COLORS.neonPink, COLORS.matrixGreen, COLORS.warningOrange, COLORS.cyberBlue][i]}
              emissive={[COLORS.cyberBlue, COLORS.neonPink, COLORS.matrixGreen, COLORS.warningOrange, COLORS.cyberBlue][i]}
              emissiveIntensity={1}
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
};

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
      {/* Speaker cabinet */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.1, 1.6, 0.85]} />
        <meshStandardMaterial color="#2a2420" emissive="#2a2420" emissiveIntensity={0.8} roughness={0.95} metalness={0} />
      </mesh>

      {/* Front grille */}
      <mesh position={[0, 0, 0.43]}>
        <boxGeometry args={[1.0, 1.5, 0.02]} />
        <meshStandardMaterial color="#333333" emissive="#333333" emissiveIntensity={0.7} roughness={0.95} metalness={0} />
      </mesh>

      {/* Corner bolts */}
      {[[-0.5, 0.75], [0.5, 0.75], [-0.5, -0.75], [0.5, -0.75]].map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.44]}>
          <boxGeometry args={[0.15, 0.15, 0.02]} />
          <meshStandardMaterial color="#777777" emissive="#555555" emissiveIntensity={0.8} roughness={0.4} metalness={0.3} />
        </mesh>
      ))}

      {/* Woofer surround */}
      <mesh position={[0, -0.2, 0.44]}>
        <ringGeometry args={[0.32, 0.4, 16]} />
        <meshStandardMaterial color="#3a3a3a" emissive="#2a2a2a" emissiveIntensity={0.7} roughness={0.7} metalness={0} side={2} />
      </mesh>

      {/* Woofer cone */}
      <mesh position={[0, -0.2, 0.44]} ref={coneRef}>
        <circleGeometry args={[0.32, 16]} />
        <meshStandardMaterial color="#444444" emissive="#333333" emissiveIntensity={0.6} roughness={0.8} metalness={0} />
      </mesh>

      {/* Woofer dust cap */}
      <mesh position={[0, -0.2, 0.46]}>
        <circleGeometry args={[0.1, 12]} />
        <meshStandardMaterial color="#2a2a2a" emissive="#222222" emissiveIntensity={0.7} roughness={0.6} metalness={0} />
      </mesh>

      {/* Tweeter horn */}
      <mesh position={[0, 0.4, 0.44]}>
        <cylinderGeometry args={[0.08, 0.15, 0.12, 16]} />
        <meshStandardMaterial color="#666666" emissive="#555555" emissiveIntensity={0.8} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Tweeter magnet */}
      <mesh position={[0, 0.4, 0.38]}>
        <cylinderGeometry args={[0.12, 0.12, 0.08, 16]} />
        <meshStandardMaterial color="#777777" emissive="#555555" emissiveIntensity={0.8} roughness={0.3} metalness={0.2} />
      </mesh>

      {/* Handle */}
      <mesh position={[0, 0.85, 0]}>
        <boxGeometry args={[0.5, 0.08, 0.15]} />
        <meshStandardMaterial color="#555555" emissive="#444444" emissiveIntensity={0.7} roughness={0.5} metalness={0.2} />
      </mesh>

      {/* Brand plate */}
      <mesh position={[0, 0.65, 0.44]}>
        <boxGeometry args={[0.3, 0.08, 0.01]} />
        <meshStandardMaterial color="#aaaaaa" emissive="#777777" emissiveIntensity={0.8} roughness={0.3} metalness={0.3} />
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
        <meshStandardMaterial color="#222222" emissive="#222222" emissiveIntensity={0.8} roughness={0.9} metalness={0} />
      </mesh>

      <mesh position={[0, 0, 0.51]}>
        <boxGeometry args={[0.9, 0.9, 0.02]} />
        <meshStandardMaterial color="#2a2a2a" emissive="#2a2a2a" emissiveIntensity={0.7} roughness={0.9} metalness={0} />
      </mesh>

      <mesh position={[0, 0, 0.52]} ref={coneRef}>
        <circleGeometry args={[0.38, 16]} />
        <meshStandardMaterial color="#3a3a3a" emissive="#2a2a2a" emissiveIntensity={0.6} roughness={0.8} metalness={0} />
      </mesh>

      <mesh position={[0, 0, 0.54]}>
        <circleGeometry args={[0.12, 12]} />
        <meshStandardMaterial color="#2a2a2a" emissive="#222222" emissiveIntensity={0.7} roughness={0.7} metalness={0} />
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

interface RoboticLightProps {
  position: [number, number, number];
  color: string;
  isPlayingRef: MutableRefObject<boolean>;
  index: number;
}

// Shared time ref so all lights move in perfect sync
const sharedTimeRef = { current: 0 };
let sharedTimeOwner = false;

const RoboticLight: React.FC<RoboticLightProps> = ({ position, color, isPlayingRef, index }) => {
  const headRef = useRef<THREE.Group>(null);
  const beamRef = useRef<THREE.Mesh>(null);
  const lensRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    // Only first light updates the shared time
    if (index === 0) {
      if (isPlayingRef.current) {
        sharedTimeRef.current = clock.getElapsedTime();
      }
    }
    const t = sharedTimeRef.current;

    // Pattern cycle: each pattern lasts ~8 seconds
    const cycle = Math.floor(t / 8) % 4;
    const local = (t % 8) / 8; // 0-1 progress within pattern

    if (headRef.current) {
      switch (cycle) {
        case 0: // Slow sweep left to right
          headRef.current.rotation.y = Math.sin(local * Math.PI * 2) * 0.7;
          headRef.current.rotation.x = -0.3;
          headRef.current.rotation.z = 0;
          break;
        case 1: // Fast figure-8
          headRef.current.rotation.y = Math.sin(local * Math.PI * 4) * 0.6;
          headRef.current.rotation.x = Math.sin(local * Math.PI * 2) * 0.4;
          headRef.current.rotation.z = 0;
          break;
        case 2: // Snap positions - hold then jump
          {
            const step = Math.floor(local * 5);
            const targets = [-0.6, 0.3, -0.2, 0.6, 0];
            headRef.current.rotation.y += (targets[step] - headRef.current.rotation.y) * 0.15;
            headRef.current.rotation.x += (-0.25 - headRef.current.rotation.x) * 0.15;
            headRef.current.rotation.z = 0;
          }
          break;
        case 3: // Circular sweep
          headRef.current.rotation.y = Math.sin(local * Math.PI * 3) * 0.5;
          headRef.current.rotation.x = Math.cos(local * Math.PI * 3) * 0.35 - 0.1;
          headRef.current.rotation.z = Math.sin(local * Math.PI * 2) * 0.08;
          break;
      }
    }

    // Blink: all lights blink together, once in a while
    // Short blink-off every ~6 seconds lasting ~0.3s
    const blinkCycle = t % 6;
    const blinkOff = blinkCycle > 5.5 && blinkCycle < 5.8;
    // Double blink every ~15 seconds
    const dblCycle = t % 15;
    const dblBlink = (dblCycle > 12.0 && dblCycle < 12.15) || (dblCycle > 12.3 && dblCycle < 12.45);
    const visible = !blinkOff && !dblBlink;
    const opacity = visible ? 0.12 : 0.01;

    if (beamRef.current) {
      (beamRef.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
    if (lensRef.current) {
      (lensRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = visible ? 2.5 : 0.2;
    }
  });

  return (
    <group position={position}>
      {/* Yoke / mount bracket */}
      <mesh>
        <boxGeometry args={[0.12, 0.08, 0.12]} />
        <meshStandardMaterial color="#333333" emissive="#222222" emissiveIntensity={0.5} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Animated head */}
      <group ref={headRef} position={[0, -0.08, 0]}>
        {/* Light housing */}
        <mesh>
          <boxGeometry args={[0.3, 0.25, 0.3]} />
          <meshStandardMaterial color="#222222" emissive="#111111" emissiveIntensity={0.5} metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Lens */}
        <mesh ref={lensRef} position={[0, -0.15, 0]}>
          <cylinderGeometry args={[0.1, 0.12, 0.1, 12]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={2.5}
            transparent
            opacity={0.9}
          />
        </mesh>
        {/* Light beam cone (visual only, no actual spotlight) */}
        <mesh ref={beamRef} position={[0, -4, 0]}>
          <coneGeometry args={[2.5, 7.5, 8, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </group>
  );
};

interface StageElementsProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const StageElements: React.FC<StageElementsProps> = ({ isPlayingRef }) => {
  return (
    <group>
      <Speaker position={[-6, 0.8, -4.5]} scale={1} isPlayingRef={isPlayingRef} />
      <Speaker position={[-6, 2.4, -4.5]} scale={1} isPlayingRef={isPlayingRef} />
      <Speaker position={[6, 0.8, -4.5]} scale={1} isPlayingRef={isPlayingRef} />
      <Speaker position={[6, 2.4, -4.5]} scale={1} isPlayingRef={isPlayingRef} />

      <Subwoofer position={[-6.5, 0.5, -3]} isPlayingRef={isPlayingRef} />
      <Subwoofer position={[6.5, 0.5, -3]} isPlayingRef={isPlayingRef} />
      <Subwoofer position={[-3.5, 0.5, -6]} isPlayingRef={isPlayingRef} />
      <Subwoofer position={[3.5, 0.5, -6]} isPlayingRef={isPlayingRef} />


      {/* Stage floor lights */}
      {[-5, -3, -1, 1, 3, 5].map((x, i) => (
        <mesh key={i} position={[x, 0.02, -3.8]}>
          <boxGeometry args={[0.5, 0.04, 0.15]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? COLORS.neonPink : COLORS.cyberBlue}
            emissive={i % 2 === 0 ? COLORS.neonPink : COLORS.cyberBlue}
            emissiveIntensity={2}
          />
        </mesh>
      ))}

      {/* Dancefloor edge neon strips */}
      {[-6.5, 6.5].map((x, i) => (
        <mesh key={`edge-x-${i}`} position={[x, -0.4, 0]}>
          <boxGeometry args={[0.06, 0.06, 14]} />
          <meshStandardMaterial
            color={COLORS.matrixGreen}
            emissive={COLORS.matrixGreen}
            emissiveIntensity={1.5}
          />
        </mesh>
      ))}
      <mesh position={[0, -0.4, 6.5]}>
        <boxGeometry args={[14, 0.06, 0.06]} />
        <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={1.5} />
      </mesh>

      <group>
        <mesh position={[0, 8, 1]}>
          <boxGeometry args={[16, 0.2, 0.2]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[0, 8, -6]}>
          <boxGeometry args={[16, 0.2, 0.2]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>

        <mesh position={[-8, 8, -2.5]}>
          <boxGeometry args={[0.2, 0.2, 7.4]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[8, 8, -2.5]}>
          <boxGeometry args={[0.2, 0.2, 7.4]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>

        {[-6, -3, 0, 3, 6].map((x, i) => (
          <mesh key={`brace-${i}`} position={[x, 8, -2.5]}>
            <boxGeometry args={[0.1, 0.1, 7.2]} />
            <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}

        {[[-7.5, -6], [7.5, -6], [-7.5, 1], [7.5, 1]].map(([x, z], i) => (
          <mesh key={`support-${i}`} position={[x, 4, z]}>
            <boxGeometry args={[0.15, 8, 0.15]} />
            <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {/* Vine accents on truss beams */}
      {[-7, -4, -1, 2, 5, 7].map((x, i) => (
        <mesh key={`truss-vine-${i}`} position={[x, 8.15, -2.5]}>
          <boxGeometry args={[2, 0.08, 0.08]} />
          <meshStandardMaterial
            color="#22aa33"
            emissive="#22aa33"
            emissiveIntensity={0.35}
            roughness={0.8}
          />
        </mesh>
      ))}
      {[-6, -2, 1, 4, 7].map((x, i) => (
        <mesh key={`truss-vine-back-${i}`} position={[x, 8.15, -6]}>
          <boxGeometry args={[1.8, 0.07, 0.07]} />
          <meshStandardMaterial
            color="#33cc44"
            emissive="#33cc44"
            emissiveIntensity={0.3}
            roughness={0.8}
          />
        </mesh>
      ))}

      {[-5, -3, -1, 1, 3, 5].map((x, i) => (
        <RoboticLight
          key={`light-${i}`}
          position={[x, 7.8, -2.5]}
          color={[COLORS.cyberBlue, COLORS.neonPink, COLORS.matrixGreen, COLORS.warningOrange, COLORS.cyberBlue, COLORS.neonPink][i]}
          isPlayingRef={isPlayingRef}
          index={i}
        />
      ))}
    </group>
  );
};

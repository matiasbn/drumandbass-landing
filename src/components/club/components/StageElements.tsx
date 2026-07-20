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

// --- Static configs ---

const SPEAKER_CONFIGS: { pos: [number, number, number]; rot: [number, number, number] }[] = [
  { pos: [-13, 0.8, 0], rot: [0, Math.PI / 2, 0] },
  { pos: [13, 0.8, 0], rot: [0, -Math.PI / 2, 0] },
  { pos: [0, 0.8, -13], rot: [0, 0, 0] },
  { pos: [0, 0.8, 13], rot: [0, Math.PI, 0] },
];

const SUB_CONFIGS: { pos: [number, number, number]; rot: [number, number, number] }[] = [
  { pos: [-13, 0.5, -13], rot: [0, Math.PI / 4, 0] },
  { pos: [13, 0.5, -13], rot: [0, -Math.PI / 4, 0] },
  { pos: [-13, 0.5, 13], rot: [0, 3 * Math.PI / 4, 0] },
  { pos: [13, 0.5, 13], rot: [0, -3 * Math.PI / 4, 0] },
];

const LIGHT_COUNT = 6;
const LIGHT_COLORS_CYCLE = [COLORS.cyberBlue, COLORS.neonPink, COLORS.matrixGreen, COLORS.warningOrange];
const LIGHT_CONFIGS: { pos: [number, number, number]; color: string }[] = [];
for (let i = 0; i < LIGHT_COUNT; i++) {
  const angle = (i / LIGHT_COUNT) * Math.PI * 2;
  LIGHT_CONFIGS.push({
    pos: [Math.cos(angle) * 10, 9, Math.sin(angle) * 10],
    color: LIGHT_COLORS_CYCLE[i % LIGHT_COLORS_CYCLE.length],
  });
}

interface StageElementsProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const StageElements: React.FC<StageElementsProps> = ({ isPlayingRef }) => {
  // Refs for speaker cones (4 speakers + 4 subs = 8 cone refs)
  const speakerConeRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const subConeRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);

  // Refs for robotic lights (6 lights: head group + lens + beam)
  const lightHeadRefs = useRef<(THREE.Group | null)[]>([null, null, null, null, null, null]);
  const lightLensRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null, null, null]);
  const lightBeamRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null, null, null]);

  const frozenTimeRef = useRef<number>(0);

  // ONE useFrame for speakers + subs
  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const t = frozenTimeRef.current;

    // Speaker cones pulse
    const speakerScale = 1 + Math.sin(t * 8) * 0.05;
    for (let i = 0; i < 4; i++) {
      const cone = speakerConeRefs.current[i];
      if (cone) cone.scale.z = speakerScale;
    }

    // Sub cones pulse
    const subScale = 1 + Math.sin(t * 4) * 0.08;
    for (let i = 0; i < 4; i++) {
      const cone = subConeRefs.current[i];
      if (cone) cone.scale.z = subScale;
    }

    // Robotic lights
    const cycle = Math.floor(t / 8) % 4;
    const local = (t % 8) / 8;

    for (let i = 0; i < LIGHT_COUNT; i++) {
      const head = lightHeadRefs.current[i];
      if (head) {
        switch (cycle) {
          case 0:
            head.rotation.y = Math.sin(local * Math.PI * 2) * 0.7;
            head.rotation.x = -0.3;
            head.rotation.z = 0;
            break;
          case 1:
            head.rotation.y = Math.sin(local * Math.PI * 4) * 0.6;
            head.rotation.x = Math.sin(local * Math.PI * 2) * 0.4;
            head.rotation.z = 0;
            break;
          case 2: {
            const step = Math.floor(local * 5);
            const targets = [-0.6, 0.3, -0.2, 0.6, 0];
            head.rotation.y += (targets[step] - head.rotation.y) * 0.15;
            head.rotation.x += (-0.25 - head.rotation.x) * 0.15;
            head.rotation.z = 0;
            break;
          }
          case 3:
            head.rotation.y = Math.sin(local * Math.PI * 3) * 0.5;
            head.rotation.x = Math.cos(local * Math.PI * 3) * 0.35 - 0.1;
            head.rotation.z = Math.sin(local * Math.PI * 2) * 0.08;
            break;
        }
      }

      const blinkCycle = t % 6;
      const blinkOff = blinkCycle > 5.5 && blinkCycle < 5.8;
      const dblCycle = t % 15;
      const dblBlink = (dblCycle > 12.0 && dblCycle < 12.15) || (dblCycle > 12.3 && dblCycle < 12.45);
      const visible = !blinkOff && !dblBlink;

      const beam = lightBeamRefs.current[i];
      if (beam) {
        (beam.material as THREE.MeshBasicMaterial).opacity = visible ? 0.12 : 0.01;
      }
      const lens = lightLensRefs.current[i];
      if (lens) {
        (lens.material as THREE.MeshStandardMaterial).emissiveIntensity = visible ? 2.5 : 0.2;
      }
    }
  });

  return (
    <group>
      {/* Speakers: 2 meshes each = 8 total */}
      {SPEAKER_CONFIGS.map((s, i) => (
        <group key={`spk-${i}`} position={s.pos} rotation={s.rot}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.1, 1.6, 0.85]} />
            <meshStandardMaterial color="#2a2420" emissive="#2a2420" emissiveIntensity={0.8} roughness={0.95} metalness={0} />
          </mesh>
          <mesh
            position={[0, -0.2, 0.44]}
            ref={(el) => { speakerConeRefs.current[i] = el; }}
          >
            <circleGeometry args={[0.32, 16]} />
            <meshStandardMaterial color="#444444" emissive="#333333" emissiveIntensity={0.6} roughness={0.8} metalness={0} />
          </mesh>
        </group>
      ))}

      {/* Subwoofers: 2 meshes each = 8 total */}
      {SUB_CONFIGS.map((s, i) => (
        <group key={`sub-${i}`} position={s.pos} rotation={s.rot}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="#222222" emissive="#222222" emissiveIntensity={0.8} roughness={0.9} metalness={0} />
          </mesh>
          <mesh
            position={[0, 0, 0.52]}
            ref={(el) => { subConeRefs.current[i] = el; }}
          >
            <circleGeometry args={[0.38, 16]} />
            <meshStandardMaterial color="#3a3a3a" emissive="#2a2a2a" emissiveIntensity={0.6} roughness={0.8} metalness={0} />
          </mesh>
        </group>
      ))}

      {/* Dancefloor edge neon strips: 4 meshes */}
      {[-14.5, 14.5].map((x, i) => (
        <mesh key={`edge-x-${i}`} position={[x, -0.4, 0]}>
          <boxGeometry args={[0.06, 0.06, 30]} />
          <meshStandardMaterial color={COLORS.matrixGreen} emissive={COLORS.matrixGreen} emissiveIntensity={1.5} />
        </mesh>
      ))}
      {[-14.5, 14.5].map((z, i) => (
        <mesh key={`edge-z-${i}`} position={[0, -0.4, z]}>
          <boxGeometry args={[30, 0.06, 0.06]} />
          <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={1.5} />
        </mesh>
      ))}

      {/* Truss frame: 4 main beams only */}
      <group>
        <mesh position={[0, 9, 15]}>
          <boxGeometry args={[34, 0.2, 0.2]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[0, 9, -15]}>
          <boxGeometry args={[34, 0.2, 0.2]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[-16, 9, 0]}>
          <boxGeometry args={[0.2, 0.2, 30.4]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[16, 9, 0]}>
          <boxGeometry args={[0.2, 0.2, 30.4]} />
          <meshStandardMaterial color="#666666" metalness={0.95} roughness={0.15} />
        </mesh>
      </group>

      {/* Robotic lights: 2 meshes each (body + lens) + beam = 18 meshes for 6 lights */}
      {LIGHT_CONFIGS.map((cfg, i) => (
        <group key={`light-${i}`} position={cfg.pos}>
          <mesh>
            <boxGeometry args={[0.3, 0.25, 0.3]} />
            <meshStandardMaterial color="#222222" emissive="#111111" emissiveIntensity={0.5} metalness={0.7} roughness={0.4} />
          </mesh>
          <group ref={(el) => { lightHeadRefs.current[i] = el; }} position={[0, -0.08, 0]}>
            <mesh
              ref={(el) => { lightLensRefs.current[i] = el; }}
              position={[0, -0.15, 0]}
            >
              <cylinderGeometry args={[0.1, 0.12, 0.1, 12]} />
              <meshStandardMaterial color={cfg.color} emissive={cfg.color} emissiveIntensity={2.5} transparent opacity={0.9} />
            </mesh>
            <mesh
              ref={(el) => { lightBeamRefs.current[i] = el; }}
              position={[0, -4, 0]}
            >
              <coneGeometry args={[2.5, 7.5, 8, 1, true]} />
              <meshBasicMaterial color={cfg.color} transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
};

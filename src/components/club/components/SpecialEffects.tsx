'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useScore } from '../ScoreContext';

// ─── Shockwave ────────────────────────────────────────────────────────
// Expanding ring that radiates from player position
const Shockwave: React.FC<{ position: [number, number, number]; startTime: number }> = ({ position, startTime }) => {
  const ringRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime() - startTime;
    if (elapsed > 2) return; // 2s duration

    const progress = elapsed / 2;
    const radius = progress * 8; // expand to 8 units
    const opacity = 1 - progress;

    if (ringRef.current) {
      ringRef.current.scale.set(radius, radius, 1);
    }
    if (materialRef.current) {
      materialRef.current.opacity = opacity * 0.6;
    }
  });

  return (
    <mesh ref={ringRef} position={[position[0], 0.1, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.8, 1.0, 32]} />
      <meshBasicMaterial
        ref={materialRef}
        color="#ff0055"
        transparent
        opacity={0.6}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
};

// ─── Spotlight ────────────────────────────────────────────────────────
// Bright cone of light that tracks the player
const SpotlightEffect: React.FC<{ position: [number, number, number]; startTime: number }> = ({ position, startTime }) => {
  const coneRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const particlePositions = useMemo(() => {
    const pos = new Float32Array(50 * 3);
    for (let i = 0; i < 50; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 1] = Math.random() * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }
    return pos;
  }, []);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime() - startTime;
    if (elapsed > 5) return;

    const fadeIn = Math.min(elapsed / 0.5, 1);
    const fadeOut = elapsed > 4 ? 1 - (elapsed - 4) : 1;
    const opacity = fadeIn * fadeOut * 0.3;

    if (materialRef.current) {
      materialRef.current.opacity = opacity;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = elapsed * 0.5;
    }
  });

  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Light cone */}
      <mesh ref={coneRef} position={[0, 5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[2, 10, 16, 1, true]} />
        <meshBasicMaterial
          ref={materialRef}
          color="#ffff00"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Sparkle particles */}
      <points ref={particlesRef} position={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.08}
          color="#ffff00"
          transparent
          opacity={0.8}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>
    </group>
  );
};

// ─── Confetti ─────────────────────────────────────────────────────────
// Burst of colored particles
const ConfettiEffect: React.FC<{ position: [number, number, number]; startTime: number }> = ({ position, startTime }) => {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, velocities, colors } = useMemo(() => {
    const count = 80;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const palette = [
      new THREE.Color('#ff0055'), new THREE.Color('#00ccff'),
      new THREE.Color('#00ff41'), new THREE.Color('#ffff00'),
      new THREE.Color('#ff8800'), new THREE.Color('#ff00ff'),
    ];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 1.5;
      pos[i * 3 + 2] = 0;
      // Random burst velocity
      const angle = Math.random() * Math.PI * 2;
      const upVel = 2 + Math.random() * 3;
      const outVel = 1 + Math.random() * 2;
      vel[i * 3] = Math.cos(angle) * outVel;
      vel[i * 3 + 1] = upVel;
      vel[i * 3 + 2] = Math.sin(angle) * outVel;
      const c = palette[Math.floor(Math.random() * palette.length)];
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    return { positions: pos, velocities: vel, colors: cols };
  }, []);

  const positionsRef = useRef(new Float32Array(positions));

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime() - startTime;
    if (elapsed > 3 || !pointsRef.current) return;

    const posArr = positionsRef.current;
    const count = posArr.length / 3;
    for (let i = 0; i < count; i++) {
      posArr[i * 3] = velocities[i * 3] * elapsed;
      posArr[i * 3 + 1] = 1.5 + velocities[i * 3 + 1] * elapsed - 4.9 * elapsed * elapsed;
      posArr[i * 3 + 2] = velocities[i * 3 + 2] * elapsed;
    }

    const geom = pointsRef.current.geometry;
    const attr = geom.getAttribute('position');
    (attr as THREE.BufferAttribute).set(posArr);
    attr.needsUpdate = true;

    const mat = pointsRef.current.material as THREE.PointsMaterial;
    mat.opacity = Math.max(0, 1 - elapsed / 3);
  });

  return (
    <points ref={pointsRef} position={[position[0], 0, position[2]]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positionsRef.current, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        vertexColors
        transparent
        opacity={1}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
};

// ─── Levitate ─────────────────────────────────────────────────────────
// Glowing aura ring that orbits the player while they float
const LevitateEffect: React.FC<{ position: [number, number, number]; startTime: number }> = ({ position, startTime }) => {
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime() - startTime;
    if (elapsed > 5) return;

    const fadeIn = Math.min(elapsed / 0.5, 1);
    const fadeOut = elapsed > 4 ? 1 - (elapsed - 4) : 1;
    const opacity = fadeIn * fadeOut * 0.5;

    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = elapsed * 2;
      ring1Ref.current.rotation.z = elapsed * 0.5;
      (ring1Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = -elapsed * 1.5;
      ring2Ref.current.rotation.y = elapsed * 1;
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  });

  return (
    <group position={[position[0], 2, position[2]]}>
      <mesh ref={ring1Ref}>
        <torusGeometry args={[1.2, 0.04, 8, 32]} />
        <meshBasicMaterial color="#00ccff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh ref={ring2Ref}>
        <torusGeometry args={[1.0, 0.04, 8, 32]} />
        <meshBasicMaterial color="#ff00ff" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
};

// ─── Floor Quake ──────────────────────────────────────────────────────
// Multiple concentric rings rippling outward
const FloorQuakeEffect: React.FC<{ position: [number, number, number]; startTime: number }> = ({ position, startTime }) => {
  const ringsRef = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime() - startTime;
    if (elapsed > 3) return;

    for (let i = 0; i < 5; i++) {
      const ring = ringsRef.current[i];
      if (!ring) continue;

      const ringDelay = i * 0.3;
      const ringElapsed = elapsed - ringDelay;
      if (ringElapsed < 0) {
        ring.visible = false;
        continue;
      }

      ring.visible = true;
      const progress = Math.min(ringElapsed / 1.5, 1);
      const scale = progress * 12;
      const opacity = (1 - progress) * 0.5;

      ring.scale.set(scale, scale, 1);
      (ring.material as THREE.MeshBasicMaterial).opacity = opacity;
    }
  });

  return (
    <group position={[position[0], 0.05, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={i} ref={el => { ringsRef.current[i] = el; }} visible={false}>
          <ringGeometry args={[0.9, 1.0, 32]} />
          <meshBasicMaterial
            color={i % 2 === 0 ? '#ff8800' : '#ff0055'}
            transparent
            opacity={0.5}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
};

// ─── Main Effects Manager ─────────────────────────────────────────────
interface ActiveEffect {
  type: number;
  position: [number, number, number];
  startTime: number;
  id: number;
}

let effectIdCounter = 0;

export const SpecialEffects: React.FC = () => {
  const { activeSpecial, playerPosition } = useScore();
  const [effects, setEffects] = React.useState<ActiveEffect[]>([]);
  const lastSpecialRef = useRef<number | null>(null);
  const clockRef = useRef(0);
  const playerPosRef = useRef(playerPosition);
  playerPosRef.current = playerPosition;

  useFrame(({ clock }) => {
    clockRef.current = clock.getElapsedTime();

    // Clean up old effects
    setEffects(prev => prev.filter(e => {
      const duration = e.type === 0 ? 2 : e.type === 3 || e.type === 1 ? 5 : 3;
      return clockRef.current - e.startTime < duration;
    }));
  });

  // Spawn effect when activeSpecial changes
  React.useEffect(() => {
    if (activeSpecial !== null && activeSpecial !== lastSpecialRef.current) {
      lastSpecialRef.current = activeSpecial;
      const pos = playerPosRef.current;
      setEffects(prev => [...prev, {
        type: activeSpecial,
        position: [pos.x, 0, pos.z],
        startTime: clockRef.current,
        id: ++effectIdCounter,
      }]);
    } else if (activeSpecial === null) {
      lastSpecialRef.current = null;
    }
  }, [activeSpecial]);

  return (
    <>
      {effects.map(effect => {
        switch (effect.type) {
          case 0: return <Shockwave key={effect.id} position={effect.position} startTime={effect.startTime} />;
          case 1: return <SpotlightEffect key={effect.id} position={effect.position} startTime={effect.startTime} />;
          case 2: return <ConfettiEffect key={effect.id} position={effect.position} startTime={effect.startTime} />;
          case 3: return <LevitateEffect key={effect.id} position={effect.position} startTime={effect.startTime} />;
          case 4: return <FloorQuakeEffect key={effect.id} position={effect.position} startTime={effect.startTime} />;
          default: return null;
        }
      })}
    </>
  );
};

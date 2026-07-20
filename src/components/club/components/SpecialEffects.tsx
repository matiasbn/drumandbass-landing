'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useScore } from '../ScoreContext';
import { useHealth } from '../HealthContext';
import { useEnergy } from '../EnergyContext';
import { useNpcPositions } from '../NpcPositionsContext';
import { playerState } from '../playerState';
import { TUNING } from '../tuning';
import { addTrauma } from '../juice';
import { playSting } from '../sounds';

// Module-level shared state for cross-component communication
export let earthquakeActiveUntil = 0;
export let levitateActiveUntil = 0;

// ─── Constantes del re-rol de especiales (M12) ───────────────────────
// (Valores del diseño §3 M12; candidatos a un bloque `especiales` de TUNING —
// tuning.ts es de Fase 0, así que viven aquí para no tocar archivos ajenos.)
const ONDA_RADIO = 8; // Onda: +15 hype a todos los NPCs en 8u
const ONDA_HYPE = 15;
const SPOTLIGHT_DURA_S = 10; // Spotlight: te sigue 10s, hits +50% hype
const CONFETTI_REVIVE_A = 60; // Confetti: los APAGADOS suben a 60 al instante
const TERREMOTO_ENERGIA = 25; // Terremoto: +25 Energía del Club TOTAL (clutch pre-drop)

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
    <mesh ref={ringRef} position={[position[0], position[1] + 0.1, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
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
// M12: el foco SIGUE al jugador 10s (sus hits dan +50% hype vía activateSpotlight)
const SpotlightEffect: React.FC<{ position: [number, number, number]; startTime: number }> = ({ position, startTime }) => {
  const groupRef = useRef<THREE.Group>(null);
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
    if (elapsed > SPOTLIGHT_DURA_S) return;

    // Sigue al jugador (posición viva del singleton playerState)
    if (groupRef.current) {
      const p = playerState.position;
      groupRef.current.position.set(p.x, p.y, p.z);
    }

    const fadeIn = Math.min(elapsed / 0.5, 1);
    const fadeOut = elapsed > SPOTLIGHT_DURA_S - 1 ? SPOTLIGHT_DURA_S - elapsed : 1;
    const opacity = fadeIn * fadeOut * 0.3;

    if (materialRef.current) {
      materialRef.current.opacity = opacity;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = elapsed * 0.5;
    }
  });

  return (
    <group ref={groupRef} position={[position[0], position[1], position[2]]}>
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
    <points ref={pointsRef} position={[position[0], position[1], position[2]]}>
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

    // Set levitate active for PlayerDancer to lift
    if (elapsed < 5) {
      levitateActiveUntil = clock.getElapsedTime() + 0.1;
    }

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
    <group position={[position[0], position[1] + 2, position[2]]}>
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
  const { camera } = useThree();
  const originalCamPosRef = useRef<THREE.Vector3 | null>(null);
  const shakeAppliedRef = useRef(false);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime() - startTime;

    // Set earthquake active for NPCs to jump
    if (elapsed < 2) {
      earthquakeActiveUntil = clock.getElapsedTime() + 0.1;
    }

    // Camera shake effect for 2 seconds
    if (elapsed < 2) {
      if (!originalCamPosRef.current) {
        originalCamPosRef.current = camera.position.clone();
      }
      const shakeIntensity = 1 - elapsed / 2; // fade out shake
      camera.position.x += (Math.random() * 0.3 - 0.15) * shakeIntensity;
      camera.position.z += (Math.random() * 0.3 - 0.15) * shakeIntensity;
      camera.position.y += Math.random() * 0.15 * shakeIntensity;
      shakeAppliedRef.current = true;
    } else if (shakeAppliedRef.current && originalCamPosRef.current) {
      // Shake ended — camera returns naturally via the camera controller
      shakeAppliedRef.current = false;
      originalCamPosRef.current = null;
    }

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
    <group position={[position[0], position[1] + 0.05, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
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

// ─── Hype Drop ───────────────────────────────────────────────────────
// Composite mega-effect: shockwaves + confetti fountain + light pillar + orbiting rings
const HypeDropEffect: React.FC<{ position: [number, number, number]; startTime: number }> = ({ position, startTime }) => {
  // --- Shockwave rings (3 staggered) ---
  const ringRefs = useRef<(THREE.Mesh | null)[]>([]);
  // --- Confetti fountain (200 particles) ---
  const confettiRef = useRef<THREE.Points>(null);
  // --- Light pillar ---
  const pillarRef = useRef<THREE.Mesh>(null);
  const pillarMatRef = useRef<THREE.MeshBasicMaterial>(null);
  // --- Orbiting torus rings ---
  const torusRefs = useRef<(THREE.Mesh | null)[]>([]);
  // --- Ground ring pulse ---
  const groundRingRef = useRef<THREE.Mesh>(null);

  const DURATION = 4.0;

  const { confettiPositions, confettiVelocities, confettiColors } = useMemo(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const palette = [
      new THREE.Color('#ff0055'), new THREE.Color('#00ccff'),
      new THREE.Color('#00ff41'), new THREE.Color('#ffdd00'),
      new THREE.Color('#ff8800'), new THREE.Color('#ff00ff'),
      new THREE.Color('#ffffff'), new THREE.Color('#ffd700'),
    ];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      // Geyser: mostly upward with slight spread
      const angle = Math.random() * Math.PI * 2;
      const spread = Math.random() * 2.5;
      vel[i * 3] = Math.cos(angle) * spread;
      vel[i * 3 + 1] = 5 + Math.random() * 8; // Strong upward burst
      vel[i * 3 + 2] = Math.sin(angle) * spread;
      const c = palette[Math.floor(Math.random() * palette.length)];
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    return { confettiPositions: pos, confettiVelocities: vel, confettiColors: cols };
  }, []);

  const confettiPosRef = useRef(new Float32Array(confettiPositions));

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime() - startTime;
    if (elapsed > DURATION) return;

    const progress = elapsed / DURATION;

    // --- 3 Shockwave rings ---
    for (let i = 0; i < 3; i++) {
      const ring = ringRefs.current[i];
      if (!ring) continue;
      const delay = i * 0.3;
      const ringElapsed = elapsed - delay;
      if (ringElapsed < 0) { ring.visible = false; continue; }
      ring.visible = true;
      const ringProgress = Math.min(ringElapsed / 2.0, 1);
      const radius = ringProgress * (12 + i * 4);
      const opacity = (1 - ringProgress) * 0.7;
      ring.scale.set(radius, radius, 1);
      (ring.material as THREE.MeshBasicMaterial).opacity = opacity;
    }

    // --- Confetti fountain ---
    if (confettiRef.current) {
      const posArr = confettiPosRef.current;
      const count = posArr.length / 3;
      for (let i = 0; i < count; i++) {
        const t = elapsed;
        posArr[i * 3] = confettiVelocities[i * 3] * t;
        posArr[i * 3 + 1] = confettiVelocities[i * 3 + 1] * t - 4.9 * t * t;
        posArr[i * 3 + 2] = confettiVelocities[i * 3 + 2] * t;
      }
      const attr = confettiRef.current.geometry.getAttribute('position');
      (attr as THREE.BufferAttribute).set(posArr);
      attr.needsUpdate = true;
      const mat = confettiRef.current.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - progress * 0.8);
      mat.size = 0.15 + Math.sin(elapsed * 10) * 0.03;
    }

    // --- Light pillar ---
    if (pillarRef.current && pillarMatRef.current) {
      const pulseOpacity = (Math.sin(elapsed * 8) * 0.3 + 0.5) * (1 - progress);
      pillarMatRef.current.opacity = pulseOpacity;
      pillarRef.current.scale.x = 1 + Math.sin(elapsed * 6) * 0.3;
      pillarRef.current.scale.z = 1 + Math.sin(elapsed * 6) * 0.3;
    }

    // --- Orbiting torus rings ---
    for (let i = 0; i < 3; i++) {
      const torus = torusRefs.current[i];
      if (!torus) continue;
      const orbitAngle = elapsed * (2 + i * 0.7) + (i * Math.PI * 2) / 3;
      const orbitRadius = 1.5 + i * 0.5;
      const orbitY = 1.5 + Math.sin(elapsed * 3 + i) * 1.0;
      torus.position.set(
        Math.cos(orbitAngle) * orbitRadius,
        orbitY,
        Math.sin(orbitAngle) * orbitRadius,
      );
      torus.rotation.x = elapsed * 3 + i;
      torus.rotation.z = elapsed * 2;
      (torus.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.6;
    }

    // --- Ground ring pulse ---
    if (groundRingRef.current) {
      const pulseScale = 1 + Math.sin(elapsed * 6) * 0.5 + elapsed * 2;
      groundRingRef.current.scale.set(pulseScale, pulseScale, 1);
      (groundRingRef.current.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (1 - progress) * 0.5);
    }
  });

  const ringColors = ['#ffd700', '#ff0055', '#00ccff'];
  const torusColors = ['#ffd700', '#ff00ff', '#00ccff'];

  return (
    <group position={[position[0], position[1], position[2]]}>
      {/* 3 Shockwave rings */}
      <group position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={`ring-${i}`} ref={el => { ringRefs.current[i] = el; }} visible={false}>
            <ringGeometry args={[0.8, 1.0, 48]} />
            <meshBasicMaterial
              color={ringColors[i]}
              transparent
              opacity={0.7}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Confetti fountain */}
      <points ref={confettiRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[confettiPosRef.current, 3]} />
          <bufferAttribute attach="attributes-color" args={[confettiColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          vertexColors
          transparent
          opacity={1}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Light pillar — tall glowing cylinder */}
      <mesh ref={pillarRef} position={[0, 10, 0]}>
        <cylinderGeometry args={[0.5, 1.5, 20, 16, 1, true]} />
        <meshBasicMaterial
          ref={pillarMatRef}
          color="#ffd700"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Orbiting torus rings */}
      {[0, 1, 2].map(i => (
        <mesh key={`torus-${i}`} ref={el => { torusRefs.current[i] = el; }}>
          <torusGeometry args={[0.8 + i * 0.3, 0.06, 8, 32]} />
          <meshBasicMaterial
            color={torusColors[i]}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Ground ring pulse */}
      <mesh ref={groundRingRef} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 2.0, 48]} />
        <meshBasicMaterial
          color="#ffd700"
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
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
  const { activeSpecial } = useScore();
  const { localHypeRef, addNpcHypeFlat, reviveApagados, activateSpotlight, onVipCapturedRef } = useHealth();
  const { addEnergy } = useEnergy();
  const { positions: npcPositions } = useNpcPositions();
  const [effects, setEffects] = React.useState<ActiveEffect[]>([]);
  const lastSpecialRef = useRef<number | null>(null);
  const clockRef = useRef(0);
  // La posición del jugador vive en el singleton playerState (siempre al día,
  // sin re-renders); se referencia el objeto mutable directamente.
  const playerPosRef = useRef(playerState.position);
  const wasHypedRef = useRef(false);

  const cleanupTimerRef = useRef(0);

  useFrame(({ clock }) => {
    clockRef.current = clock.getElapsedTime();

    // Auto-trigger HypeDrop effect when player becomes hyped
    const isHyped = localHypeRef.current.hyped;
    if (isHyped && !wasHypedRef.current) {
      const pos = playerPosRef.current;
      setEffects(prev => [...prev, {
        type: 5,
        position: [pos.x, pos.y, pos.z],
        startTime: clockRef.current,
        id: ++effectIdCounter,
      }]);
    }
    wasHypedRef.current = isHyped;

    // Clean up old effects — only check every 60 frames (~1s) to avoid setState per frame
    cleanupTimerRef.current++;
    if (cleanupTimerRef.current >= 60) {
      cleanupTimerRef.current = 0;
      setEffects(prev => {
        const filtered = prev.filter(e => {
          const duration = e.type === 1 ? SPOTLIGHT_DURA_S : e.type === 0 ? 2 : e.type === 3 ? 5 : e.type === 5 ? 4 : 3;
          return clockRef.current - e.startTime < duration;
        });
        return filtered.length === prev.length ? prev : filtered;
      });
    }
  });

  // VIP capturado (M7): confetti burst sobre el NPC — lo dispara HealthContext
  useEffect(() => {
    onVipCapturedRef.current = (npcId: string) => {
      const p = npcPositions.current.get(npcId);
      if (!p) return;
      setEffects(prev => [...prev, {
        type: 2, // ConfettiEffect
        position: [p.x, p.y, p.z],
        startTime: clockRef.current,
        id: ++effectIdCounter,
      }]);
    };
    return () => {
      onVipCapturedRef.current = null;
    };
  }, [onVipCapturedRef, npcPositions]);

  // Spawn effect when activeSpecial changes — con su rol táctico (M12)
  React.useEffect(() => {
    if (activeSpecial !== null && activeSpecial !== lastSpecialRef.current) {
      lastSpecialRef.current = activeSpecial;
      const pos = playerPosRef.current;
      setEffects(prev => [...prev, {
        type: activeSpecial,
        position: [pos.x, pos.y, pos.z],
        startTime: clockRef.current,
        id: ++effectIdCounter,
      }]);

      // ── Re-rol táctico (M12): cada especial es una herramienta ──
      switch (activeSpecial) {
        case 0: { // Onda: +15 hype a todos los NPCs en 8u (sin drop: remate del jugador)
          const r2 = ONDA_RADIO * ONDA_RADIO;
          npcPositions.current.forEach((npcPos, id) => {
            const dx = npcPos.x - pos.x;
            const dy = npcPos.y - pos.y;
            const dz = npcPos.z - pos.z;
            if (dx * dx + dy * dy + dz * dz <= r2) addNpcHypeFlat(id, ONDA_HYPE);
          });
          break;
        }
        case 1: // Spotlight: el foco te sigue y tus hits dan +50% hype
          activateSpotlight(SPOTLIGHT_DURA_S);
          break;
        case 2: // Confetti: todos los APAGADOS a 60 — el salvavidas anti-Bajón
          reviveApagados(CONFETTI_REVIVE_A);
          break;
        // case 3 (Levitar): igual que hoy — sinergia con airshots (levitateActiveUntil)
        // case 4 (Terremoto): su rol ES la energía directa (abajo)
      }
      // Energía por especial usado (M4 +10); Terremoto entrega +25 TOTAL (M12)
      addEnergy(activeSpecial === 4 ? TERREMOTO_ENERGIA : TUNING.energia.porEspecial, 'especial');
      addTrauma(0.3); // tabla §4: especial usado
      playSting(activeSpecial); // sting propio de cada especial (§4)
    } else if (activeSpecial === null) {
      lastSpecialRef.current = null;
    }
  }, [activeSpecial, addNpcHypeFlat, activateSpotlight, reviveApagados, addEnergy, npcPositions]);

  return (
    <>
      {effects.map(effect => {
        switch (effect.type) {
          case 0: return <Shockwave key={effect.id} position={effect.position} startTime={effect.startTime} />;
          case 1: return <SpotlightEffect key={effect.id} position={effect.position} startTime={effect.startTime} />;
          case 2: return <ConfettiEffect key={effect.id} position={effect.position} startTime={effect.startTime} />;
          case 3: return <LevitateEffect key={effect.id} position={effect.position} startTime={effect.startTime} />;
          case 4: return <FloorQuakeEffect key={effect.id} position={effect.position} startTime={effect.startTime} />;
          case 5: return <HypeDropEffect key={effect.id} position={effect.position} startTime={effect.startTime} />;
          default: return null;
        }
      })}
    </>
  );
};

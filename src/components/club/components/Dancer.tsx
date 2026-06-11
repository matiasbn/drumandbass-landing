'use client';

import React, { useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFaceTexture } from './useFaceTexture';
import { useNpcPositions } from '../NpcPositionsContext';
import { useProjectiles } from '../ProjectileContext';
import { useHealth } from '../HealthContext';
import { HealthBar3D } from './HealthBar3D';
import { getSurfaceHeight } from './Platforms';
import { earthquakeActiveUntil } from './SpecialEffects';

const SHOOT_INTERVAL_MIN = 4;
const SHOOT_INTERVAL_MAX = 10;

// NPCs roam the full dance floor (±13, leaving 1-unit margin from ±14 player bounds)
const WANDER_BOUNDS = { minX: -13, maxX: 13, minZ: -13, maxZ: 13 };
const MOVE_SPEED = 0.5;
const ARRIVAL_THRESHOLD = 0.3;

// Dance move types: 0=idle bob, 1=hands up, 2=spin, 3=headbang
const DANCE_COUNT = 4;
const DANCE_DURATION_MIN = 3;
const DANCE_DURATION_MAX = 6;
const IDLE_DURATION_MIN = 1;
const IDLE_DURATION_MAX = 3;

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
  const { positions: npcPositions } = useNpcPositions();
  const { shoot } = useProjectiles();
  const { npcHypeRef } = useHealth();
  const npcId = `npc-${name}`;

  // Shooting state — stagger initial timers so NPCs don't all fire at once
  const shootTimerRef = useRef(SHOOT_INTERVAL_MIN + Math.random() * (SHOOT_INTERVAL_MAX - SHOOT_INTERVAL_MIN));
  const shootRef = useRef(shoot);
  shootRef.current = shoot;
  const _shootDir = useRef(new THREE.Vector3());
  const _shootPos = useRef(new THREE.Vector3());
  // Local hype ref proxy that reads from the shared npcHypeRef map
  const hypeProxyRef = useRef({ hype: 0, maxHype: 100, hyped: false });
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const frozenTimeRef = useRef<number>(0);

  // Hype drop phase tracking
  const hypeDropStartRef = useRef(0);
  const wasNpcHypedRef = useRef(false);

  // Wander state
  const currentPos = useRef({ x: position[0], z: position[2] });
  const targetPos = useRef(pickRandomTarget());
  const currentRotY = useRef(rotationY);
  const waitTimer = useRef(0);
  const lastTime = useRef(0);

  // Dance state
  const danceMove = useRef(0);
  const danceTimer = useRef(IDLE_DURATION_MIN + Math.random() * IDLE_DURATION_MAX);
  const isDancing = useRef(false);
  const spinStartRot = useRef(0);
  const danceStartTime = useRef(0);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const delta = elapsed - lastTime.current;
    lastTime.current = elapsed;
    const dt = Math.min(delta, 0.1);

    const isPlaying = isPlayingRef.current;
    if (isPlaying) {
      frozenTimeRef.current = elapsed;
    }
    const time = frozenTimeRef.current * animationSpeed + animationOffset;

    // --- Dance state machine ---
    danceTimer.current -= dt;
    if (danceTimer.current <= 0) {
      if (isDancing.current) {
        // Finished dancing, go idle and wander
        isDancing.current = false;
        danceMove.current = 0;
        danceTimer.current = IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
        targetPos.current = pickRandomTarget();
        waitTimer.current = 0;
      } else {
        // Start dancing
        isDancing.current = true;
        danceMove.current = 1 + Math.floor(Math.random() * (DANCE_COUNT - 1));
        danceTimer.current = DANCE_DURATION_MIN + Math.random() * (DANCE_DURATION_MAX - DANCE_DURATION_MIN);
        danceStartTime.current = frozenTimeRef.current;
        if (danceMove.current === 2) {
          spinStartRot.current = currentRotY.current;
        }
      }
    }

    // --- Wander movement (only when not dancing) ---
    if (!isDancing.current) {
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
          waitTimer.current = 0.5 + Math.random() * 1.5;
        } else {
          const speed = MOVE_SPEED * animationSpeed * dt;
          const step = Math.min(speed, dist);
          currentPos.current.x += (dx / dist) * step;
          currentPos.current.z += (dz / dist) * step;

          const targetAngle = Math.atan2(dx, dz);
          let angleDiff = targetAngle - currentRotY.current;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          currentRotY.current += angleDiff * Math.min(dt * 3, 1);
        }
      }
    }

    // --- NPC shooting (only when not dancing) ---
    if (!isDancing.current) {
      shootTimerRef.current -= dt;
      if (shootTimerRef.current <= 0) {
        // Pick a random target from other NPCs
        const targets: { id: string; x: number; z: number }[] = [];
        npcPositions.current.forEach((pos, id) => {
          if (id !== npcId) targets.push({ id, x: pos.x, z: pos.z });
        });
        if (targets.length > 0) {
          const target = targets[Math.floor(Math.random() * targets.length)];
          const dx = target.x - currentPos.current.x;
          const dz = target.z - currentPos.current.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist > 1) {
            _shootDir.current.set(dx / dist, 0, dz / dist);
            const surfY = getSurfaceHeight(currentPos.current.x, currentPos.current.z);
            _shootPos.current.set(
              currentPos.current.x + _shootDir.current.x * 0.8,
              surfY + 1.2,
              currentPos.current.z + _shootDir.current.z * 0.8,
            );
            shootRef.current(_shootPos.current, _shootDir.current, npcId);
          }
        }
        shootTimerRef.current = SHOOT_INTERVAL_MIN + Math.random() * (SHOOT_INTERVAL_MAX - SHOOT_INTERVAL_MIN);
      }
    }

    if (!groupRef.current) return;

    const isMoving = !isDancing.current && waitTimer.current <= 0;
    const baseBob = isPlaying ? Math.sin(time * 4) * 0.15 : 0;
    const activeDance = danceMove.current;
    const danceTime = frozenTimeRef.current - danceStartTime.current;

    // Position — use surface height so NPCs walk on platforms properly
    const surfaceY = getSurfaceHeight(currentPos.current.x, currentPos.current.z);
    let posY = surfaceY + baseBob;

    // Sync hype proxy from shared hype map
    const npcHype = npcHypeRef.current.get(npcId);
    if (npcHype) {
      hypeProxyRef.current.hype = npcHype.hype;
      hypeProxyRef.current.maxHype = npcHype.maxHype;
      hypeProxyRef.current.hyped = npcHype.hyped;
    }

    // When hyped: 3-phase hype drop animation
    const npcHyped = !!npcHype?.hyped;
    if (npcHyped && !wasNpcHypedRef.current) {
      hypeDropStartRef.current = elapsed;
    }
    if (!npcHyped && wasNpcHypedRef.current) {
      groupRef.current.visible = true;
      groupRef.current.scale.set(1, 1, 1);
      groupRef.current.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mat = (child as THREE.Mesh).material;
          if (mat && !Array.isArray(mat) && (mat as THREE.MeshStandardMaterial).opacity < 1) {
            (mat as THREE.MeshStandardMaterial).opacity = 1;
            (mat as THREE.MeshStandardMaterial).transparent = false;
          }
        }
      });
    }
    wasNpcHypedRef.current = npcHyped;

    if (npcHyped) {
      const hypePhase = elapsed - hypeDropStartRef.current;
      // Force hands-up dance during hype
      isDancing.current = true;
      danceMove.current = 1;
      danceStartTime.current = danceStartTime.current || elapsed;

      if (hypePhase < 1) {
        // Phase 1: Rapid spin, lift to 4.5, scale to 1.5x
        posY += hypePhase * 4.5;
        const targetScale = 1 + hypePhase * 0.5;
        groupRef.current.scale.set(targetScale, targetScale, targetScale);
        currentRotY.current += dt * 12;
      } else if (hypePhase < 2) {
        // Phase 2: Hold at max, start fading
        posY += 4.5;
        groupRef.current.scale.set(1.5, 1.5, 1.5);
        currentRotY.current += dt * 12;
        const fadeProgress = hypePhase - 1;
        const opacity = 1 - fadeProgress * 0.7;
        groupRef.current.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mat = (child as THREE.Mesh).material;
            if (mat && !Array.isArray(mat)) {
              (mat as THREE.MeshStandardMaterial).transparent = true;
              (mat as THREE.MeshStandardMaterial).opacity = opacity;
            }
          }
        });
      } else if (hypePhase < 3) {
        // Phase 3: Disappear
        const disappearProgress = hypePhase - 2;
        const scaleDown = Math.max(0.01, 1.5 * (1 - disappearProgress));
        groupRef.current.scale.set(scaleDown, scaleDown, scaleDown);
        posY += 4.5;
        currentRotY.current += dt * 12;
        if (hypePhase > 2.5) {
          groupRef.current.visible = false;
        }
      } else {
        groupRef.current.visible = false;
      }
    } else {
      // Smoothly return to normal scale
      const curScale = groupRef.current.scale.x;
      if (curScale > 1.01) {
        const lerpScale = curScale + (1 - curScale) * Math.min(dt * 3, 1);
        groupRef.current.scale.set(lerpScale, lerpScale, lerpScale);
      } else if (curScale !== 1) {
        groupRef.current.scale.set(1, 1, 1);
      }
    }

    // Earthquake bounce: NPCs jump when earthquake is active
    if (earthquakeActiveUntil > elapsed) {
      posY += Math.abs(Math.sin(elapsed * 8)) * 0.8;
    }

    groupRef.current.position.x = currentPos.current.x;
    groupRef.current.position.y = posY;
    groupRef.current.position.z = currentPos.current.z;

    // Report NPC position for projectile hit detection
    npcPositions.current.set(npcId, { x: currentPos.current.x, y: surfaceY, z: currentPos.current.z });

    // --- Dance animations ---
    if (activeDance === 1) {
      // Hands up — arms pumping
      groupRef.current.rotation.y = currentRotY.current;
      groupRef.current.rotation.x = 0;
      groupRef.current.position.y = surfaceY + baseBob + Math.abs(Math.sin(danceTime * 5)) * 0.12;
      if (leftArmRef.current) {
        leftArmRef.current.rotation.z = -(Math.PI * 0.7 + Math.sin(danceTime * 5) * 0.5);
        leftArmRef.current.rotation.x = Math.sin(danceTime * 3.5) * 0.6;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.z = Math.PI * 0.7 + Math.sin(danceTime * 5 + Math.PI) * 0.5;
        rightArmRef.current.rotation.x = Math.sin(danceTime * 3.5 + 1) * 0.6;
      }
      if (headRef.current) {
        headRef.current.rotation.z = Math.sin(danceTime * 5) * 0.2;
        headRef.current.rotation.x = Math.sin(danceTime * 10) * 0.1;
        headRef.current.position.y = 1.5 + Math.abs(Math.sin(danceTime * 5)) * 0.04;
      }
      if (leftLegRef.current) { leftLegRef.current.rotation.set(0, 0, 0); leftLegRef.current.position.set(-0.1, 0.35, 0); }
      if (rightLegRef.current) { rightLegRef.current.rotation.set(0, 0, 0); rightLegRef.current.position.set(0.1, 0.35, 0); }
    } else if (activeDance === 2) {
      // Spin
      const spinProgress = danceTime / (DANCE_DURATION_MIN + 1);
      groupRef.current.rotation.y = spinStartRot.current + spinProgress * Math.PI * 2 * 3;
      groupRef.current.rotation.x = 0;
      if (leftArmRef.current) { leftArmRef.current.rotation.z = -1.2; leftArmRef.current.rotation.x = 0; }
      if (rightArmRef.current) { rightArmRef.current.rotation.z = 1.2; rightArmRef.current.rotation.x = 0; }
      if (headRef.current) { headRef.current.rotation.set(0, 0, 0); headRef.current.position.y = 1.5; }
      if (leftLegRef.current) { leftLegRef.current.rotation.set(0, 0, 0); leftLegRef.current.position.set(-0.1, 0.35, 0); }
      if (rightLegRef.current) { rightLegRef.current.rotation.set(0, 0, 0); rightLegRef.current.position.set(0.1, 0.35, 0); }
    } else if (activeDance === 3) {
      // Headbang
      groupRef.current.rotation.y = currentRotY.current;
      groupRef.current.rotation.x = 0;
      if (headRef.current) {
        headRef.current.position.y = 1.5 + Math.sin(danceTime * 12) * 0.08;
        headRef.current.rotation.x = Math.sin(danceTime * 12) * 0.4;
        headRef.current.rotation.z = 0;
      }
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -0.5 + Math.sin(danceTime * 12) * 0.5;
        leftArmRef.current.rotation.z = -0.3;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.x = -0.5 + Math.sin(danceTime * 12 + Math.PI) * 0.5;
        rightArmRef.current.rotation.z = 0.3;
      }
      if (leftLegRef.current) { leftLegRef.current.rotation.set(0, 0, 0); leftLegRef.current.position.set(-0.1, 0.35, 0); }
      if (rightLegRef.current) { rightLegRef.current.rotation.set(0, 0, 0); rightLegRef.current.position.set(0.1, 0.35, 0); }
    } else {
      // Idle/walking animation
      groupRef.current.rotation.y = currentRotY.current;
      groupRef.current.rotation.x = 0;
      const animSpeed = isMoving ? 8 : 4;
      const animIntensity = isMoving ? 0.5 : 0.3;

      if (headRef.current) {
        headRef.current.rotation.z = Math.sin(time * 2) * 0.1;
        headRef.current.rotation.x = 0;
        headRef.current.position.y = 1.5 + Math.sin(time * animSpeed) * 0.03;
      }
      if (leftArmRef.current) {
        leftArmRef.current.rotation.z = -0.3 + Math.sin(time * animSpeed) * animIntensity;
        leftArmRef.current.rotation.x = Math.sin(time * animSpeed + 0.5) * animIntensity;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.z = 0.3 - Math.sin(time * animSpeed + Math.PI) * animIntensity;
        rightArmRef.current.rotation.x = Math.sin(time * animSpeed + 1.5) * animIntensity;
      }
      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(isMoving ? Math.sin(time * animSpeed) * 0.4 : 0, 0, 0);
        leftLegRef.current.position.set(-0.1, 0.35, 0);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(isMoving ? Math.sin(time * animSpeed + Math.PI) * 0.4 : 0, 0, 0);
        rightLegRef.current.position.set(0.1, 0.35, 0);
      }
    }
  });

  return (
    <group ref={groupRef} position={[position[0], 0, position[2]]} rotation={[0, rotationY, 0]}>
      {/* Hype bar */}
      <HealthBar3D healthRef={hypeProxyRef} yOffset={2.1} />
      {/* Body */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[0.4, 0.6, 0.25]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0, 1.5, 0]}>
        <mesh>
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

      {/* Arms */}
      <mesh ref={leftArmRef} position={[-0.3, 1.1, 0]}>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh ref={rightArmRef} position={[0.3, 1.1, 0]}>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color={color} />
      </mesh>

      {/* Legs */}
      <mesh ref={leftLegRef} position={[-0.1, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh ref={rightLegRef} position={[0.1, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
    </group>
  );
};

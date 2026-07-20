'use client';

import React, { useRef, useEffect, useState, useMemo, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMultiplayer } from '../MultiplayerContext';
import { useScore } from '../ScoreContext';
import { useProjectiles } from '../ProjectileContext';
import { CharacterMesh } from './CharacterMesh';
import { getSurfaceHeight } from './Platforms';
import { useNpcPositions } from '../NpcPositionsContext';
import { useCamera } from '../CameraContext';
import { useHealth } from '../HealthContext';
import { HealthBar3D } from './HealthBar3D';
import { MAP } from '../constants';
import { levitateActiveUntil } from './SpecialEffects';

// Lightweight 3D text billboard using canvas texture
const TextSprite: React.FC<{
  text: string;
  position: [number, number, number];
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  maxWidth?: number;
}> = ({ text, position, fontSize = 24, color = '#ffffff', backgroundColor, borderColor, maxWidth = 300 }) => {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    ctx.font = `bold ${fontSize}px monospace`;
    const metrics = ctx.measureText(text);
    const paddingX = 16;
    const paddingY = 10;
    const width = Math.min(Math.ceil(metrics.width) + paddingX * 2, maxWidth);
    const height = fontSize + paddingY * 2;
    canvas.width = width;
    canvas.height = height;

    if (backgroundColor) {
      ctx.fillStyle = backgroundColor;
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(r, 0);
      ctx.lineTo(width - r, 0);
      ctx.quadraticCurveTo(width, 0, width, r);
      ctx.lineTo(width, height - r);
      ctx.quadraticCurveTo(width, height, width - r, height);
      ctx.lineTo(r, height);
      ctx.quadraticCurveTo(0, height, 0, height - r);
      ctx.lineTo(0, r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.closePath();
      ctx.fill();

      if (borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.font = `bold ${fontSize}px monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2, maxWidth - 32);

    if (color !== '#ffffff') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.fillText(text, width / 2, height / 2, maxWidth - 32);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, fontSize, color, backgroundColor, borderColor, maxWidth]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  const aspect = texture.image.width / texture.image.height;
  const scale = 0.012 * fontSize;

  return (
    <sprite position={position} scale={[scale * aspect, scale, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
};

// 3D grenade charge bar (replaces Html-based bar)
const GrenadeChargeBar3D: React.FC<{
  chargeRef: React.MutableRefObject<number>;
  chargingRef: React.MutableRefObject<number | null>;
  yOffset?: number;
}> = ({ chargeRef, chargingRef, yOffset = 2.5 }) => {
  const groupRef = useRef<THREE.Group>(null);
  const fillRef = useRef<THREE.Mesh>(null);
  const bgRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ camera }) => {
    const isCharging = chargingRef.current !== null;
    if (bgRef.current) {
      bgRef.current.visible = isCharging;
    }
    if (fillRef.current) {
      fillRef.current.visible = isCharging;
      if (isCharging) {
        const c = chargeRef.current;
        fillRef.current.scale.x = Math.max(c, 0.001);
        fillRef.current.position.x = -(1 - c) * 0.3;
        if (matRef.current) {
          if (c < 0.5) {
            matRef.current.color.setHex(0xff8800);
          } else if (c < 0.8) {
            matRef.current.color.setHex(0xffcc00);
          } else {
            matRef.current.color.setHex(0xff0055);
          }
        }
      }
    }
    if (groupRef.current) {
      groupRef.current.lookAt(camera.position);
    }
  }, -1);

  return (
    <group ref={groupRef} position={[0, yOffset, 0]}>
      {/* Background */}
      <mesh ref={bgRef} visible={false}>
        <planeGeometry args={[0.6, 0.08]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.8} depthTest={false} />
      </mesh>
      {/* Fill */}
      <mesh ref={fillRef} visible={false}>
        <planeGeometry args={[0.6, 0.06]} />
        <meshBasicMaterial ref={matRef} color="#ff8800" transparent opacity={1} depthTest={false} />
      </mesh>
    </group>
  );
};

interface PlayerDancerProps {
  isPlayingRef: MutableRefObject<boolean>;
}

const JUMP_VELOCITY = 0.28;
const DOUBLE_JUMP_VELOCITY = 0.22;
const GRAVITY = 0.018;
const DANCE_DURATION = [0, 4, 3, 4, 4, 3]; // seconds per dance move (index 0 unused)

export const PlayerDancer: React.FC<PlayerDancerProps> = ({ isPlayingRef }) => {
  const {
    username,
    updatePosition,
    playerColor,
    faceType,
    costumeId,
    accessoryId,
    lastMessage,
    lastMessageAt,
    players,
  } = useMultiplayer();
  const { scoreAction, setPlayerPosition } = useScore();
  const { shoot, throwGrenade, checkHits } = useProjectiles();
  const { positions: npcPositions } = useNpcPositions();
  const { playerPosRef: camPlayerPosRef, cameraYawRef } = useCamera();
  const { localHypeRef, addHype, addNpcHype, getHypeAmount, isHyped, decayHype } = useHealth();
  const addHypeRef = useRef(addHype);
  addHypeRef.current = addHype;
  const addNpcHypeRef = useRef(addNpcHype);
  addNpcHypeRef.current = addNpcHype;
  const getHypeAmountRef = useRef(getHypeAmount);
  getHypeAmountRef.current = getHypeAmount;
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const playersRef = useRef(players);
  playersRef.current = players;
  const [visibleBubble, setVisibleBubble] = useState<string | null>(null);

  useEffect(() => {
    if (lastMessage && lastMessageAt) {
      setVisibleBubble(lastMessage);
      const timer = setTimeout(() => setVisibleBubble(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastMessage, lastMessageAt]);

  const truncatedBubble = useMemo(() => {
    if (!visibleBubble) return null;
    return visibleBubble.length > 60 ? visibleBubble.slice(0, 57) + '...' : visibleBubble;
  }, [visibleBubble]);
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const leftLegRef = useRef<THREE.Mesh>(null);
  const rightLegRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Group>(null);
  const frozenTimeRef = useRef<number>(0);
  const lastUpdateRef = useRef(0);

  // Jump state
  const jumpVelocityRef = useRef(0);
  const jumpYRef = useRef(0);
  const isJumpingRef = useRef(false);
  const hasDoubleJumpedRef = useRef(false);
  const surfaceYRef = useRef(0);

  // Dance state
  const danceMoveRef = useRef(0);
  const danceStartRef = useRef(0);
  const spinStartRotationRef = useRef(0);
  const lastDanceScoreSecondRef = useRef(0);

  // Hype drop phase tracking
  const hypeDropStartRef = useRef(0);
  const wasHypedRef = useRef(false);

  // Shoot cooldown refs
  const shootCooldownRef = useRef(0);
  const grenadeCooldownRef = useRef(0);
  const shootRef = useRef(shoot);
  shootRef.current = shoot;
  const throwGrenadeRef = useRef(throwGrenade);
  throwGrenadeRef.current = throwGrenade;
  const checkHitsRef = useRef(checkHits);
  checkHitsRef.current = checkHits;

  // Grenade charge-up state (ref-based to avoid re-renders)
  const grenadeChargeRef = useRef(0);
  const grenadeChargeStartRef = useRef<number | null>(null);

  // Score refs for use in callbacks
  const scoreActionRef = useRef(scoreAction);
  scoreActionRef.current = scoreAction;
  const setPlayerPositionRef = useRef(setPlayerPosition);
  setPlayerPositionRef.current = setPlayerPosition;

  const keysRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  const positionRef = useRef({ x: 0, z: 6 });
  const rotationRef = useRef(0);

  // Persistent vectors to avoid GC pressure in useFrame
  const _camForward = useRef(new THREE.Vector3());
  const _camRight = useRef(new THREE.Vector3());
  const _upVec = useRef(new THREE.Vector3(0, 1, 0));
  const _hitMapRef = useRef(new Map<string, { x: number; y: number; z: number }>());

  const BOUNDS = {
    minX: -14,
    maxX: 14,
    minZ: -14,
    maxZ: 14,
  };

  const MOVE_SPEED = 0.14;
  const BASE_JUMP_HEIGHT = 0.15;

  useEffect(() => {
    const isChatFocused = () => {
      const el = document.activeElement;
      return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isChatFocused()) return;

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          keysRef.current.forward = true;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          keysRef.current.backward = true;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          keysRef.current.left = true;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          keysRef.current.right = true;
          break;
        case ' ':
          if (!isJumpingRef.current && jumpYRef.current <= surfaceYRef.current + 0.01) {
            // First jump from ground
            isJumpingRef.current = true;
            hasDoubleJumpedRef.current = false;
            jumpVelocityRef.current = JUMP_VELOCITY;
            scoreActionRef.current('jump', 'Jump');
          } else if (isJumpingRef.current && !hasDoubleJumpedRef.current) {
            // Double jump while airborne
            hasDoubleJumpedRef.current = true;
            jumpVelocityRef.current = DOUBLE_JUMP_VELOCITY;
            scoreActionRef.current('jump', 'Double Jump!');
          }
          break;
        case '1':
          danceMoveRef.current = 1;
          danceStartRef.current = frozenTimeRef.current;
          lastDanceScoreSecondRef.current = 0;
          break;
        case '2':
          danceMoveRef.current = 2;
          danceStartRef.current = frozenTimeRef.current;
          spinStartRotationRef.current = rotationRef.current;
          lastDanceScoreSecondRef.current = 0;
          break;
        case '3':
          danceMoveRef.current = 3;
          danceStartRef.current = frozenTimeRef.current;
          lastDanceScoreSecondRef.current = 0;
          break;
        case '4':
          danceMoveRef.current = 4;
          danceStartRef.current = frozenTimeRef.current;
          lastDanceScoreSecondRef.current = 0;
          break;
        case '5':
          danceMoveRef.current = 5;
          danceStartRef.current = frozenTimeRef.current;
          lastDanceScoreSecondRef.current = 0;
          break;
        case '6':
        case 'q':
        case 'Q':
          // Wave at nearby player
          scoreActionRef.current('wave', 'Wave');
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          keysRef.current.forward = false;
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          keysRef.current.backward = false;
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          keysRef.current.left = false;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          keysRef.current.right = false;
          break;
      }
    };

    // Mouse: left click = shoot, right click hold = grenade charge
    const handleMouseDown = (e: MouseEvent) => {
      if (isChatFocused()) return;
      if (e.button === 0) {
        // Left click — shoot
        const now7 = Date.now();
        if (now7 - shootCooldownRef.current < 500) return;
        shootCooldownRef.current = now7;
        const rot = cameraYawRef.current;
        const dir = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
        // Spawn projectile in front of the character (0.8 units forward) so it visually exits from the front
        const pos = new THREE.Vector3(
          positionRef.current.x + dir.x * 0.8,
          jumpYRef.current + 1.2,
          positionRef.current.z + dir.z * 0.8,
        );
        shootRef.current(pos, dir, usernameRef.current ?? '');
        scoreActionRef.current('shoot', 'Disparo');
      } else if (e.button === 2) {
        // Right click — start charging grenade
        e.preventDefault();
        const now8 = Date.now();
        if (now8 - grenadeCooldownRef.current < 2000) return;
        if (grenadeChargeStartRef.current !== null) return;
        grenadeChargeStartRef.current = now8;
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 2 && grenadeChargeStartRef.current !== null) {
        // Release grenade
        const elapsed = (Date.now() - grenadeChargeStartRef.current) / 1000;
        const charge = Math.min(elapsed / 2, 1);
        grenadeChargeStartRef.current = null;
        grenadeChargeRef.current = 0;
        grenadeCooldownRef.current = Date.now();
        const rot2 = cameraYawRef.current;
        const speed = 3 + charge * 7;
        const dir2 = new THREE.Vector3(Math.sin(rot2), 0, Math.cos(rot2));
        // Spawn grenade in front of the character
        const pos2 = new THREE.Vector3(
          positionRef.current.x + dir2.x * 0.8,
          jumpYRef.current + 1.2,
          positionRef.current.z + dir2.z * 0.8,
        );
        throwGrenadeRef.current(pos2, dir2, usernameRef.current ?? '', speed);
        scoreActionRef.current('shoot', 'Granada');
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useFrame(({ clock, camera }, delta) => {
    // Update grenade charge value (3D bar reads from ref each frame)
    if (grenadeChargeStartRef.current !== null) {
      const elapsed = (Date.now() - grenadeChargeStartRef.current) / 1000;
      grenadeChargeRef.current = Math.min(elapsed / 2, 1);
    }

    // Hype: decay over time
    decayHype(delta);
    const alive = true; // Players are always active in the hype system

    const isPlaying = isPlayingRef.current;

    if (isPlaying) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const time = frozenTimeRef.current;

    // Get camera forward/right projected onto the XZ plane
    const camForward = _camForward.current;
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    camForward.normalize();

    const camRight = _camRight.current;
    camRight.crossVectors(camForward, _upVec.current).normalize();

    let moveX = 0;
    let moveZ = 0;

    // Block input when dead
    const keys = alive ? keysRef.current : { forward: false, backward: false, left: false, right: false };
    if (keys.forward) {
      moveX += camForward.x * MOVE_SPEED;
      moveZ += camForward.z * MOVE_SPEED;
    }
    if (keys.backward) {
      moveX -= camForward.x * MOVE_SPEED;
      moveZ -= camForward.z * MOVE_SPEED;
    }
    if (keys.left) {
      moveX -= camRight.x * MOVE_SPEED;
      moveZ -= camRight.z * MOVE_SPEED;
    }
    if (keys.right) {
      moveX += camRight.x * MOVE_SPEED;
      moveZ += camRight.z * MOVE_SPEED;
    }

    const isMoving = moveX !== 0 || moveZ !== 0;

    // Auto-stop dance after duration + score periodically while dancing
    const danceMove = danceMoveRef.current;
    if (danceMove > 0) {
      const elapsed = time - danceStartRef.current;
      if (elapsed > DANCE_DURATION[danceMove]) {
        scoreActionRef.current('danceComplete', 'Baile');
        danceMoveRef.current = 0;
      } else {
        // Score +1 every second while dancing
        const secondsElapsed = Math.floor(elapsed);
        if (secondsElapsed > lastDanceScoreSecondRef.current) {
          lastDanceScoreSecondRef.current = secondsElapsed;
          scoreActionRef.current('jump', 'Bailando');
        }
      }
    }

    // Try new position, check if walkable
    const newX = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, positionRef.current.x + moveX));
    const newZ = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, positionRef.current.z + moveZ));
    const newSurfaceY = getSurfaceHeight(newX, newZ);
    const heightDiff = newSurfaceY - jumpYRef.current;

    // Allow walking up stairs (small height increases) but block walking into tall walls
    if (heightDiff > MAP.maxStepHeight && !isJumpingRef.current) {
      // Too tall to walk up — block movement but allow sliding along the wall
      const slideX = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, positionRef.current.x + moveX));
      const slideSurfaceX = getSurfaceHeight(slideX, positionRef.current.z);
      if (slideSurfaceX - jumpYRef.current <= MAP.maxStepHeight) {
        positionRef.current.x = slideX;
      }
      const slideZ = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, positionRef.current.z + moveZ));
      const slideSurfaceZ = getSurfaceHeight(positionRef.current.x, slideZ);
      if (slideSurfaceZ - jumpYRef.current <= MAP.maxStepHeight) {
        positionRef.current.z = slideZ;
      }
    } else {
      positionRef.current.x = newX;
      positionRef.current.z = newZ;
    }

    // Surface detection at final position
    const surfaceY = getSurfaceHeight(positionRef.current.x, positionRef.current.z);
    surfaceYRef.current = surfaceY;

    // Jump physics
    if (isJumpingRef.current) {
      jumpVelocityRef.current -= GRAVITY;
      jumpYRef.current += jumpVelocityRef.current;
      if (jumpYRef.current <= surfaceY) {
        jumpYRef.current = surfaceY;
        isJumpingRef.current = false;
        hasDoubleJumpedRef.current = false;
        jumpVelocityRef.current = 0;
      }
    } else if (jumpYRef.current > surfaceY + 0.01) {
      // Falling off a platform edge — allow double jump while falling too
      if (!isJumpingRef.current) {
        isJumpingRef.current = true;
        hasDoubleJumpedRef.current = false;
      }
      jumpVelocityRef.current -= GRAVITY;
      jumpYRef.current += jumpVelocityRef.current;
      if (jumpYRef.current <= surfaceY) {
        jumpYRef.current = surfaceY;
        isJumpingRef.current = false;
        hasDoubleJumpedRef.current = false;
        jumpVelocityRef.current = 0;
      }
    } else if (heightDiff <= MAP.maxStepHeight && heightDiff >= 0) {
      // Walk up stairs smoothly
      jumpYRef.current = surfaceY;
    } else if (surfaceY < jumpYRef.current) {
      // Walk down — snap to lower surface
      jumpYRef.current = surfaceY;
    }

    if (groupRef.current) {
      const baseBob = isPlaying ? Math.sin(time * 4) * BASE_JUMP_HEIGHT : 0;

      groupRef.current.position.x = positionRef.current.x;
      groupRef.current.position.y = baseBob + jumpYRef.current;
      groupRef.current.position.z = positionRef.current.z;

      // --- Hype Drop transformation (3-phase: 0-1s spin+lift, 1-2s hold+fade, 2-3s disappear) ---
      const hyped = localHypeRef.current.hyped;
      if (hyped && !wasHypedRef.current) {
        hypeDropStartRef.current = time;
      }
      if (!hyped && wasHypedRef.current) {
        // Reset visibility when hype ends
        groupRef.current.visible = true;
        groupRef.current.scale.set(1, 1, 1);
      }
      wasHypedRef.current = hyped;

      if (hyped) {
        const hypePhase = time - hypeDropStartRef.current;

        if (hypePhase < 1) {
          // Phase 1 (0-1s): Rapid spin, lift to 4.5 units, scale to 1.5x
          groupRef.current.position.y += hypePhase * 4.5;
          const targetScale = 1 + hypePhase * 0.5;
          groupRef.current.scale.set(targetScale, targetScale, targetScale);
        } else if (hypePhase < 2) {
          // Phase 2 (1-2s): Continue spinning, hold at max height, start fading
          groupRef.current.position.y += 4.5;
          groupRef.current.scale.set(1.5, 1.5, 1.5);
          const fadeProgress = hypePhase - 1; // 0 to 1
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
          // Phase 3 (2-3s): Character becomes invisible (scale to 0)
          const disappearProgress = hypePhase - 2; // 0 to 1
          const scaleDown = Math.max(0.01, 1.5 * (1 - disappearProgress));
          groupRef.current.scale.set(scaleDown, scaleDown, scaleDown);
          groupRef.current.position.y += 4.5;
          if (hypePhase > 2.5) {
            groupRef.current.visible = false;
          }
        } else {
          // Stay invisible for rest of hype
          groupRef.current.visible = false;
        }
      } else {
        // Smoothly return to normal scale
        const curScale = groupRef.current.scale.x;
        if (curScale > 1.01) {
          const lerpScale = curScale + (1 - curScale) * Math.min(delta * 3, 1);
          groupRef.current.scale.set(lerpScale, lerpScale, lerpScale);
        } else if (curScale !== 1) {
          groupRef.current.scale.set(1, 1, 1);
        }
        // Reset material opacity
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

      // Levitate special effect
      if (levitateActiveUntil > time) {
        groupRef.current.position.y += Math.sin(time * 2) * 0.5 + 2.0;
      }

      // Sync position to camera context for third-person camera
      camPlayerPosRef.current.set(positionRef.current.x, jumpYRef.current, positionRef.current.z);

      // Player faces away from camera (same direction camera looks)
      rotationRef.current = cameraYawRef.current;

      // Spin dance overrides rotation; hyped adds rapid spin
      if (hyped) {
        rotationRef.current += delta * 12;
        cameraYawRef.current = rotationRef.current;
      }

      if (danceMoveRef.current === 2) {
        const elapsed = time - danceStartRef.current;
        const progress = Math.min(elapsed / DANCE_DURATION[2], 1);
        const totalSpins = Math.floor(DANCE_DURATION[2]); // 1 spin per second
        groupRef.current.rotation.y = spinStartRotationRef.current + progress * Math.PI * 2 * totalSpins;
      } else {
        groupRef.current.rotation.y = rotationRef.current;
      }
    }

    // Player interactions — check nearby players
    const myX = positionRef.current.x;
    const myZ = positionRef.current.z;
    const myDance = danceMoveRef.current;

    playersRef.current.forEach((other) => {
      const dx = other.x - myX;
      const dz = other.z - myZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      // Bump: walk into another player within 1 unit
      if (dist < 1.0 && isMoving) {
        scoreActionRef.current('bump', 'Bump!');
      }

      // Dance Sync: same dance within 3 units
      if (dist < 3.0 && myDance > 0 && other.danceMove === myDance) {
        scoreActionRef.current('danceSync', 'Sync!');
      }
    });

    // Crowd Hype: 3+ players dancing nearby = bonus
    if (myDance > 0) {
      let nearbyDancers = 0;
      playersRef.current.forEach((other) => {
        const dx = other.x - myX;
        const dz = other.z - myZ;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 4.0 && (other.danceMove ?? 0) > 0) nearbyDancers++;
      });
      if (nearbyDancers >= 2) {
        scoreActionRef.current('crowdHype', 'Crowd Hype!');
      }
    }

    // Check projectile hits (includes both multiplayer players and NPCs)
    // Use body center height (+1.0) instead of feet for accurate hit detection
    if (usernameRef.current) {
      const playerPositions = _hitMapRef.current;
      playerPositions.clear();
      playerPositions.set(usernameRef.current!, { x: myX, y: jumpYRef.current + 1.0, z: myZ });
      playersRef.current.forEach((other) => {
        playerPositions.set(other.username, { x: other.x, y: (other.y ?? 0) + 1.0, z: other.z });
      });
      // Add NPC bot positions for hit detection (also offset to body center)
      npcPositions.current.forEach((pos, npcId) => {
        playerPositions.set(npcId, { x: pos.x, y: pos.y + 1.0, z: pos.z });
      });
      const { directHits, grenadeHits } = checkHitsRef.current(playerPositions, usernameRef.current!, getSurfaceHeight);
      for (const hitId of directHits) {
        if (hitId === username) {
          continue;
        }
        if (hitId.startsWith('npc-')) {
          const hypeDrop = addNpcHypeRef.current(hitId, getHypeAmountRef.current('shot'));
          scoreActionRef.current('hitTarget', hypeDrop ? 'HYPE DROP!' : 'Hype!');
        } else {
          scoreActionRef.current('hitTarget', 'Hype!');
        }
      }
      for (const hitId of grenadeHits) {
        if (hitId === username) {
          addHypeRef.current(getHypeAmountRef.current('grenade'));
          continue;
        }
        if (hitId.startsWith('npc-')) {
          const hypeDrop = addNpcHypeRef.current(hitId, getHypeAmountRef.current('grenade'));
          scoreActionRef.current('hitTarget', hypeDrop ? 'HYPE DROP!' : 'Boom!');
        } else {
          scoreActionRef.current('hitTarget', 'Boom!');
        }
      }
    }

    // Report position to score system
    setPlayerPositionRef.current(myX, jumpYRef.current, myZ);

    // Broadcast state
    const now = Date.now();
    if (now - lastUpdateRef.current > 100) {
      updatePosition(
        positionRef.current.x,
        jumpYRef.current,
        positionRef.current.z,
        rotationRef.current,
        danceMoveRef.current,
        isJumpingRef.current,
      );
      lastUpdateRef.current = now;
    }

    // Animations
    const activeDance = danceMoveRef.current;
    const danceTime = time - danceStartRef.current;

    if (activeDance === 1) {
      // Hands up — arms pumping high, body bouncing
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
      // Body bounce
      if (groupRef.current) {
        groupRef.current.position.y += Math.abs(Math.sin(danceTime * 5)) * 0.12;
        groupRef.current.rotation.x = 0;
      }
      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(0, 0, 0);
        leftLegRef.current.position.set(-0.12, 0.35, 0);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(0, 0, 0);
        rightLegRef.current.position.set(0.12, 0.35, 0);
      }
    } else if (activeDance === 2) {
      // Spin — arms extend out
      if (leftArmRef.current) {
        leftArmRef.current.rotation.z = -1.2;
        leftArmRef.current.rotation.x = 0;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.z = 1.2;
        rightArmRef.current.rotation.x = 0;
      }
      if (headRef.current) {
        headRef.current.rotation.z = 0;
        headRef.current.rotation.x = 0;
        headRef.current.position.y = 1.5;
      }
      if (groupRef.current) {
        groupRef.current.rotation.x = 0;
      }
      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(0, 0, 0);
        leftLegRef.current.position.set(-0.12, 0.35, 0);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(0, 0, 0);
        rightLegRef.current.position.set(0.12, 0.35, 0);
      }
    } else if (activeDance === 3) {
      // Headbang — head bobs, arms pump
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
      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(0, 0, 0);
        leftLegRef.current.position.set(-0.12, 0.35, 0);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(0, 0, 0);
        rightLegRef.current.position.set(0.12, 0.35, 0);
      }
    } else if (activeDance === 4) {
      // Split leg — drop to floor, legs rotate 90° outward into a full split
      const cycleTime = danceTime % 3.0; // 3s cycle: go down, hold, come up
      let spread: number;
      if (cycleTime < 0.8) {
        spread = cycleTime / 0.8; // ease into split
      } else if (cycleTime < 2.2) {
        spread = 1.0; // hold split
      } else {
        spread = 1.0 - (cycleTime - 2.2) / 0.8; // come back up
      }
      spread = spread * spread * (3 - 2 * spread); // smoothstep

      // Pivot from hip (top of leg). Leg center is 0.3 below hip.
      const legHalf = 0.3;
      const hipY = 0.65; // top of leg = 0.35 + 0.3
      const angle = spread * (Math.PI / 2);

      // Front leg (forward kick): rotate around hip
      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(-angle, 0, 0);
        leftLegRef.current.position.set(-0.12, hipY - legHalf * Math.cos(angle), -legHalf * Math.sin(angle));
      }
      // Back leg (backward kick): rotate around hip
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(angle, 0, 0);
        rightLegRef.current.position.set(0.12, hipY - legHalf * Math.cos(angle), legHalf * Math.sin(angle));
      }
      // Drop body as legs spread
      if (groupRef.current) {
        groupRef.current.position.y += -spread * 0.55;
        groupRef.current.rotation.x = 0;
      }
      // Arms out for balance
      if (leftArmRef.current) {
        leftArmRef.current.rotation.z = -(0.3 + spread * 0.9);
        leftArmRef.current.rotation.x = Math.sin(danceTime * 4) * 0.2;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.z = 0.3 + spread * 0.9;
        rightArmRef.current.rotation.x = Math.sin(danceTime * 4 + Math.PI) * 0.2;
      }
      if (headRef.current) {
        headRef.current.rotation.z = Math.sin(danceTime * 2) * 0.1;
        headRef.current.rotation.x = spread * 0.15;
        headRef.current.position.y = 1.5;
      }
    } else if (activeDance === 5) {
      // Backflip — tuck and rotate around body core, then land
      const flipDuration = 1.0;
      const flipCycle = danceTime % (flipDuration + 0.5); // flip + pause
      const flipping = flipCycle < flipDuration;
      const flipProgress = Math.min(flipCycle / flipDuration, 1);
      const pivotY = 1.4; // rotate around upper body/head

      if (groupRef.current) {
        if (flipping) {
          const angle = -flipProgress * Math.PI * 2;
          const jumpHeight = Math.sin(flipProgress * Math.PI) * 1.2;
          groupRef.current.rotation.x = angle;
          // Offset position to rotate around core instead of feet
          groupRef.current.position.y += jumpHeight + pivotY * (1 - Math.cos(angle));
        } else {
          groupRef.current.rotation.x = 0;
        }
      }
      // Tuck arms in during flip, spread on land
      if (leftArmRef.current) {
        leftArmRef.current.rotation.z = flipping ? -0.1 : -0.8;
        leftArmRef.current.rotation.x = flipping ? -1.2 : 0;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.z = flipping ? 0.1 : 0.8;
        rightArmRef.current.rotation.x = flipping ? -1.2 : 0;
      }
      if (headRef.current) {
        headRef.current.rotation.x = flipping ? -0.3 : 0;
        headRef.current.rotation.z = 0;
        headRef.current.position.y = 1.5;
      }
      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(flipping ? 0.6 : 0, 0, 0);
        leftLegRef.current.position.set(-0.12, 0.35, 0);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(flipping ? 0.6 : 0, 0, 0);
        rightLegRef.current.position.set(0.12, 0.35, 0);
      }
    } else {
      // Default idle/move animation
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
      // Reset legs
      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(isMoving ? Math.sin(time * animSpeed) * 0.4 : 0, 0, 0);
        leftLegRef.current.position.set(-0.12, 0.35, 0);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(isMoving ? Math.sin(time * animSpeed + Math.PI) * 0.4 : 0, 0, 0);
        rightLegRef.current.position.set(0.12, 0.35, 0);
      }
      // Reset group rotation.x (from backflip)
      if (groupRef.current) {
        groupRef.current.rotation.x = 0;
      }
    }
  });

  if (!username) return null;

  return (
    <group ref={groupRef} position={[0, 0, 6]}>
      {/* Health bar */}
      <HealthBar3D healthRef={localHypeRef} yOffset={2.4} />

      {/* Grenade charge bar (3D mesh, reads from ref each frame) */}
      <GrenadeChargeBar3D chargeRef={grenadeChargeRef} chargingRef={grenadeChargeStartRef} yOffset={2.5} />

      {/* Chat bubble (3D sprite -- no DOM sync overhead) */}
      {truncatedBubble && (
        <TextSprite
          text={truncatedBubble}
          position={[0, 2.8, 0]}
          fontSize={20}
          color="#ffffff"
          backgroundColor="rgba(0,0,0,0.85)"
          borderColor="rgba(255,0,85,0.5)"
        />
      )}

      {/* Name label above head (3D sprite) */}
      <TextSprite
        text={username}
        position={[0, 2.2, 0]}
        fontSize={14}
        color={playerColor}
        backgroundColor="rgba(0,0,0,0.7)"
        borderColor={playerColor}
      />

      <CharacterMesh
        playerColor={playerColor}
        faceType={faceType}
        username={username}
        costumeId={costumeId}
        accessoryId={accessoryId}
        headRef={headRef}
        leftArmRef={leftArmRef}
        rightArmRef={rightArmRef}
        leftLegRef={leftLegRef}
        rightLegRef={rightLegRef}
      />
    </group>
  );
};

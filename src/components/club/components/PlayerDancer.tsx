'use client';

import React, { useRef, useEffect, useState, useMemo, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useMultiplayer } from '../MultiplayerContext';
import { CharacterMesh } from './CharacterMesh';
import { isGifMessage, decodeGifUrl } from '../../../lib/chatMessage';

interface PlayerDancerProps {
  isPlayingRef: MutableRefObject<boolean>;
}

const JUMP_VELOCITY = 0.15;
const GRAVITY = 0.006;
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
  } = useMultiplayer();
  const [visibleBubble, setVisibleBubble] = useState<string | null>(null);

  useEffect(() => {
    if (lastMessage && lastMessageAt) {
      setVisibleBubble(lastMessage);
      const timer = setTimeout(() => setVisibleBubble(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [lastMessage, lastMessageAt]);

  const isGif = visibleBubble ? isGifMessage(visibleBubble) : false;
  const gifUrl = isGif && visibleBubble ? decodeGifUrl(visibleBubble) : null;
  const truncatedBubble = useMemo(() => {
    if (!visibleBubble) return null;
    if (isGifMessage(visibleBubble)) return visibleBubble;
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

  // Dance state
  const danceMoveRef = useRef(0);
  const danceStartRef = useRef(0);
  const spinStartRotationRef = useRef(0);

  const [keys, setKeys] = useState({
    forward: false,
    backward: false,
    left: false,
    right: false,
  });

  const positionRef = useRef({ x: 0, z: 2 });
  const rotationRef = useRef(Math.atan2(0, -4 - 2));

  const BOUNDS = {
    minX: -6.5,
    maxX: 6.5,
    minZ: -2,
    maxZ: 6.5,
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

      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
          setKeys((k) => ({ ...k, forward: true }));
          break;
        case 'ArrowDown':
          setKeys((k) => ({ ...k, backward: true }));
          break;
        case 'ArrowLeft':
          setKeys((k) => ({ ...k, left: true }));
          break;
        case 'ArrowRight':
          setKeys((k) => ({ ...k, right: true }));
          break;
        case ' ':
          if (!isJumpingRef.current) {
            isJumpingRef.current = true;
            jumpVelocityRef.current = JUMP_VELOCITY;
            jumpYRef.current = 0;
          }
          break;
        case '1':
          danceMoveRef.current = 1;
          danceStartRef.current = frozenTimeRef.current;
          break;
        case '2':
          danceMoveRef.current = 2;
          danceStartRef.current = frozenTimeRef.current;
          spinStartRotationRef.current = rotationRef.current;
          break;
        case '3':
          danceMoveRef.current = 3;
          danceStartRef.current = frozenTimeRef.current;
          break;
        case '4':
          danceMoveRef.current = 4;
          danceStartRef.current = frozenTimeRef.current;
          break;
        case '5':
          danceMoveRef.current = 5;
          danceStartRef.current = frozenTimeRef.current;
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
          setKeys((k) => ({ ...k, forward: false }));
          break;
        case 'ArrowDown':
          setKeys((k) => ({ ...k, backward: false }));
          break;
        case 'ArrowLeft':
          setKeys((k) => ({ ...k, left: false }));
          break;
        case 'ArrowRight':
          setKeys((k) => ({ ...k, right: false }));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useFrame(({ clock, camera }) => {
    const isPlaying = isPlayingRef.current;

    if (isPlaying) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const time = frozenTimeRef.current;

    // Get camera forward/right projected onto the XZ plane
    const camForward = new THREE.Vector3();
    camera.getWorldDirection(camForward);
    camForward.y = 0;
    camForward.normalize();

    const camRight = new THREE.Vector3();
    camRight.crossVectors(camForward, new THREE.Vector3(0, 1, 0)).normalize();

    let moveX = 0;
    let moveZ = 0;

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

    // Auto-stop dance after duration
    const danceMove = danceMoveRef.current;
    if (danceMove > 0) {
      const elapsed = time - danceStartRef.current;
      if (elapsed > DANCE_DURATION[danceMove]) {
        danceMoveRef.current = 0;
      }
    }

    positionRef.current.x += moveX;
    positionRef.current.z += moveZ;
    positionRef.current.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, positionRef.current.x));
    positionRef.current.z = Math.max(BOUNDS.minZ, Math.min(BOUNDS.maxZ, positionRef.current.z));

    // Jump physics
    if (isJumpingRef.current) {
      jumpVelocityRef.current -= GRAVITY;
      jumpYRef.current += jumpVelocityRef.current;
      if (jumpYRef.current <= 0) {
        jumpYRef.current = 0;
        isJumpingRef.current = false;
        jumpVelocityRef.current = 0;
      }
    }

    if (groupRef.current) {
      const baseBob = isPlaying ? Math.sin(time * 4) * BASE_JUMP_HEIGHT : 0;

      groupRef.current.position.x = positionRef.current.x;
      groupRef.current.position.y = baseBob + jumpYRef.current;
      groupRef.current.position.z = positionRef.current.z;

      if (isMoving) {
        const angle = Math.atan2(moveX, moveZ);
        rotationRef.current = angle;
      }

      // Spin dance overrides rotation
      if (danceMoveRef.current === 2) {
        const elapsed = time - danceStartRef.current;
        const progress = Math.min(elapsed / DANCE_DURATION[2], 1);
        const totalSpins = Math.floor(DANCE_DURATION[2]); // 1 spin per second
        groupRef.current.rotation.y = spinStartRotationRef.current + progress * Math.PI * 2 * totalSpins;
      } else {
        groupRef.current.rotation.y = rotationRef.current;
      }
    }

    // Broadcast state
    const now = Date.now();
    if (now - lastUpdateRef.current > 100) {
      updatePosition(
        positionRef.current.x,
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
    <group ref={groupRef} position={[0, 0, 2]}>
      {/* Chat bubble */}
      {truncatedBubble && (
        <Html position={[0, 2.8, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
          <div
            className="pointer-events-none"
            style={{
              backgroundColor: 'rgba(0,0,0,0.85)',
              border: '1px solid rgba(255,0,85,0.5)',
              borderRadius: '6px',
              textAlign: 'center',
              overflow: 'hidden',
            }}
          >
            {isGif && gifUrl ? (
              <img src={gifUrl} alt="GIF" style={{ maxWidth: '180px', maxHeight: '135px', display: 'block' }} />
            ) : (
              <div className="px-4 py-2 text-lg font-mono" style={{ color: '#fff', whiteSpace: 'nowrap' }}>
                {truncatedBubble}
              </div>
            )}
          </div>
        </Html>
      )}

      {/* Name label above head */}
      <Html position={[0, 2.2, 0]} center distanceFactor={10} zIndexRange={[10, 0]}>
        <div
          className="px-2 py-0.5 text-xs font-bold whitespace-nowrap pointer-events-none"
          style={{
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: playerColor,
            border: `1px solid ${playerColor}`,
            textShadow: `0 0 10px ${playerColor}`,
          }}
        >
          {username}
        </div>
      </Html>

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

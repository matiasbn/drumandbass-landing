'use client';

import React, { useRef, useState, useEffect, useMemo, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useMultiplayer, PlayerState } from '../MultiplayerContext';
import { CharacterMesh } from './CharacterMesh';
import { isGifMessage, decodeGifUrl } from '../../../lib/chatMessage';

interface RemotePlayerProps {
  player: PlayerState;
  isPlayingRef: MutableRefObject<boolean>;
}

const JUMP_HEIGHT_REMOTE = 0.8;

const RemotePlayer: React.FC<RemotePlayerProps> = ({ player, isPlayingRef }) => {
  const [visibleBubble, setVisibleBubble] = useState<string | null>(null);

  useEffect(() => {
    if (player.lastMessage && player.lastMessageAt) {
      setVisibleBubble(player.lastMessage);
      const age = Date.now() - player.lastMessageAt;
      const remaining = Math.max(5000 - age, 0);
      if (remaining <= 0) {
        setVisibleBubble(null);
        return;
      }
      const timer = setTimeout(() => setVisibleBubble(null), remaining);
      return () => clearTimeout(timer);
    }
  }, [player.lastMessage, player.lastMessageAt]);

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

  const targetPos = useRef({ x: player.x, z: player.z });
  const currentPos = useRef({ x: player.x, z: player.z });
  const targetRotation = useRef(player.rotation);
  const currentRotation = useRef(player.rotation);

  // Track dance move changes to know when it started
  const danceStartRef = useRef(0);
  const prevDanceMoveRef = useRef(0);
  const spinStartRotationRef = useRef(0);

  React.useEffect(() => {
    targetPos.current = { x: player.x, z: player.z };
    targetRotation.current = player.rotation;
  }, [player.x, player.z, player.rotation]);

  const BASE_JUMP_HEIGHT = 0.15;

  useFrame(({ clock }) => {
    const isPlaying = isPlayingRef.current;

    if (isPlaying) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const time = frozenTimeRef.current;

    // Detect dance move changes
    const danceMove = player.danceMove || 0;
    if (danceMove !== prevDanceMoveRef.current) {
      if (danceMove > 0) {
        danceStartRef.current = time;
        if (danceMove === 2) {
          spinStartRotationRef.current = currentRotation.current;
        }
      }
      prevDanceMoveRef.current = danceMove;
    }

    currentPos.current.x += (targetPos.current.x - currentPos.current.x) * 0.1;
    currentPos.current.z += (targetPos.current.z - currentPos.current.z) * 0.1;
    currentRotation.current += (targetRotation.current - currentRotation.current) * 0.1;

    const isMoving =
      Math.abs(targetPos.current.x - currentPos.current.x) > 0.01 ||
      Math.abs(targetPos.current.z - currentPos.current.z) > 0.01;

    if (groupRef.current) {
      const baseBob = isPlaying ? Math.sin(time * 4 + player.id.length) * BASE_JUMP_HEIGHT : 0;
      const jumpY = player.jumping ? Math.abs(Math.sin((time - danceStartRef.current) * 6)) * JUMP_HEIGHT_REMOTE : 0;
      groupRef.current.position.x = currentPos.current.x;
      groupRef.current.position.y = baseBob + jumpY;
      groupRef.current.position.z = currentPos.current.z;

      // Spin dance overrides rotation
      if (danceMove === 2) {
        const elapsed = time - danceStartRef.current;
        const spinDuration = 3.0; // match DANCE_DURATION[2]
        const progress = Math.min(elapsed / spinDuration, 1);
        const totalSpins = Math.floor(spinDuration); // 1 spin per second
        groupRef.current.rotation.y = spinStartRotationRef.current + progress * Math.PI * 2 * totalSpins;
      } else {
        groupRef.current.rotation.y = currentRotation.current;
      }
    }

    const danceTime = time - danceStartRef.current;

    if (danceMove === 1) {
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
    } else if (danceMove === 2) {
      // Spin
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
    } else if (danceMove === 3) {
      // Headbang
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
    } else if (danceMove === 4) {
      // Split leg — drop to floor, legs rotate 90° outward
      const cycleTime = danceTime % 3.0;
      let spread: number;
      if (cycleTime < 0.8) {
        spread = cycleTime / 0.8;
      } else if (cycleTime < 2.2) {
        spread = 1.0;
      } else {
        spread = 1.0 - (cycleTime - 2.2) / 0.8;
      }
      spread = spread * spread * (3 - 2 * spread); // smoothstep

      const legHalf = 0.3;
      const hipY = 0.65;
      const angle = spread * (Math.PI / 2);

      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(-angle, 0, 0);
        leftLegRef.current.position.set(-0.12, hipY - legHalf * Math.cos(angle), -legHalf * Math.sin(angle));
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(angle, 0, 0);
        rightLegRef.current.position.set(0.12, hipY - legHalf * Math.cos(angle), legHalf * Math.sin(angle));
      }
      if (groupRef.current) {
        groupRef.current.position.y += -spread * 0.55;
        groupRef.current.rotation.x = 0;
      }
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
    } else if (danceMove === 5) {
      // Backflip — rotate around upper body
      const flipDuration = 1.0;
      const flipCycle = danceTime % (flipDuration + 0.5);
      const flipping = flipCycle < flipDuration;
      const flipProgress = Math.min(flipCycle / flipDuration, 1);
      const pivotY = 1.4;

      if (groupRef.current) {
        if (flipping) {
          const angle = -flipProgress * Math.PI * 2;
          const jumpHeight = Math.sin(flipProgress * Math.PI) * 1.2;
          groupRef.current.rotation.x = angle;
          groupRef.current.position.y += jumpHeight + pivotY * (1 - Math.cos(angle));
        } else {
          groupRef.current.rotation.x = 0;
        }
      }
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
      // Default idle/move
      const animSpeed = isMoving ? 8 : 4;
      const animIntensity = isMoving ? 0.5 : 0.3;
      const offset = player.id.length * 0.5;

      if (headRef.current) {
        headRef.current.rotation.z = Math.sin(time * 2 + offset) * 0.1;
        headRef.current.rotation.x = 0;
        headRef.current.position.y = 1.5 + Math.sin(time * animSpeed + offset) * 0.03;
      }
      if (leftArmRef.current) {
        leftArmRef.current.rotation.z = -0.3 + Math.sin(time * animSpeed + offset) * animIntensity;
        leftArmRef.current.rotation.x = Math.sin(time * animSpeed + 0.5 + offset) * animIntensity;
      }
      if (rightArmRef.current) {
        rightArmRef.current.rotation.z = 0.3 - Math.sin(time * animSpeed + Math.PI + offset) * animIntensity;
        rightArmRef.current.rotation.x = Math.sin(time * animSpeed + 1.5 + offset) * animIntensity;
      }
      // Reset legs
      if (leftLegRef.current) {
        leftLegRef.current.rotation.set(isMoving ? Math.sin(time * animSpeed + offset) * 0.4 : 0, 0, 0);
        leftLegRef.current.position.set(-0.12, 0.35, 0);
      }
      if (rightLegRef.current) {
        rightLegRef.current.rotation.set(isMoving ? Math.sin(time * animSpeed + Math.PI + offset) * 0.4 : 0, 0, 0);
        rightLegRef.current.position.set(0.12, 0.35, 0);
      }
      // Reset group rotation.x (from backflip)
      if (groupRef.current) {
        groupRef.current.rotation.x = 0;
      }
    }
  });

  return (
    <group ref={groupRef} position={[player.x, 0, player.z]}>
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
            color: player.color,
            border: `1px solid ${player.color}`,
            textShadow: `0 0 10px ${player.color}`,
          }}
        >
          {player.username}
        </div>
      </Html>

      <CharacterMesh
        playerColor={player.color}
        faceType={player.faceType}
        username={player.username}
        costumeId={player.costumeId}
        accessoryId={player.accessoryId}
        headRef={headRef}
        leftArmRef={leftArmRef}
        rightArmRef={rightArmRef}
        leftLegRef={leftLegRef}
        rightLegRef={rightLegRef}
      />
    </group>
  );
};

interface OtherPlayersProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const OtherPlayers: React.FC<OtherPlayersProps> = ({ isPlayingRef }) => {
  const { players } = useMultiplayer();

  return (
    <>
      {Array.from(players.values()).map((player) => (
        <RemotePlayer key={player.id} player={player} isPlayingRef={isPlayingRef} />
      ))}
    </>
  );
};

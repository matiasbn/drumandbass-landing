'use client';

import React, { useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useMultiplayer, PlayerState } from '../MultiplayerContext';
import { useFaceTexture } from './useFaceTexture';

interface RemotePlayerProps {
  player: PlayerState;
  isPlayingRef: MutableRefObject<boolean>;
}

const JUMP_HEIGHT_REMOTE = 0.8;

const RemotePlayer: React.FC<RemotePlayerProps> = ({ player, isPlayingRef }) => {
  const faceTexture = useFaceTexture(player.username);
  const groupRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Mesh>(null);
  const rightArmRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
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
        const progress = Math.min(elapsed / 1.0, 1);
        groupRef.current.rotation.y = spinStartRotationRef.current + progress * Math.PI * 2;
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
    }
  });

  return (
    <group ref={groupRef} position={[player.x, 0, player.z]}>
      {/* Name label above head */}
      <Html position={[0, 2.2, 0]} center distanceFactor={10}>
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

      {/* Body */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={[0.45, 0.65, 0.28]} />
        <meshStandardMaterial color={player.color} emissive={player.color} emissiveIntensity={0.3} />
      </mesh>

      {/* Head */}
      <group ref={headRef} position={[0, 1.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.38, 0.3]} />
          <meshStandardMaterial color="#e0c4a8" />
        </mesh>
        {/* Face texture on front */}
        {faceTexture && (
          <mesh position={[0, 0, 0.151]}>
            <planeGeometry args={[0.32, 0.38]} />
            <meshBasicMaterial map={faceTexture} />
          </mesh>
        )}
      </group>

      <mesh ref={leftArmRef} position={[-0.32, 1.1, 0]} castShadow>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color={player.color} />
      </mesh>

      <mesh ref={rightArmRef} position={[0.32, 1.1, 0]} castShadow>
        <boxGeometry args={[0.12, 0.5, 0.12]} />
        <meshStandardMaterial color={player.color} />
      </mesh>

      <mesh position={[-0.12, 0.35, 0]} castShadow>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[0.12, 0.35, 0]} castShadow>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
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

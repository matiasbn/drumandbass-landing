'use client';

import React, { useRef, useMemo, useEffect, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getSharedRoundedUnitBox, getCharacterTexture } from './characterAssets';
import { NEON } from '../materials';

interface DJProps {
  isPlayingRef: MutableRefObject<boolean>;
}

const BEAT_HZ = 174 / 60; // pulsos por segundo (174 BPM, el mismo del club)

export const DJ: React.FC<DJProps> = ({ isPlayingRef }) => {
  const headRef = useRef<THREE.Group>(null);
  const torsoRef = useRef<THREE.Group>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const frozenTimeRef = useRef<number>(0);

  // Geometría redondeada compartida (misma que los personajes) + textura de tela.
  const geo = getSharedRoundedUnitBox();
  const tex = getCharacterTexture();

  // Materiales neón compartidos (visor + audífonos, y trim del pecho). Se les
  // pulsa el emissiveIntensity al beat para que el Bloom los haga latir.
  const cyanMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: NEON.cyan, emissive: NEON.cyan, emissiveIntensity: 1.6, toneMapped: false }),
    [],
  );
  const pinkMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: NEON.pink, emissive: NEON.pink, emissiveIntensity: 1.8, toneMapped: false }),
    [],
  );
  useEffect(() => () => { cyanMat.dispose(); pinkMat.dispose(); }, [cyanMat, pinkMat]);

  useFrame(({ clock }) => {
    const isPlaying = isPlayingRef.current;
    if (isPlaying) frozenTimeRef.current = clock.getElapsedTime();
    const time = frozenTimeRef.current;

    // Pulso al beat con ataque marcado (0 casi todo el ciclo, pico en el golpe).
    const beat = Math.pow(Math.max(0, Math.sin(time * Math.PI * 2 * BEAT_HZ)), 3);

    if (headRef.current) {
      headRef.current.position.y = 2.2 + Math.sin(time * 4) * 0.05 + beat * 0.05;
      headRef.current.rotation.y = Math.sin(time * 2) * 0.2;
      headRef.current.rotation.z = Math.sin(time * BEAT_HZ * Math.PI) * 0.05;
    }
    if (torsoRef.current) {
      torsoRef.current.position.y = 1.4 + beat * 0.03;
      torsoRef.current.rotation.z = Math.sin(time * 2) * 0.05;
    }
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(time * 6) * 0.3 - 0.5;
      leftArmRef.current.rotation.z = -0.3 + Math.sin(time * 3) * 0.1;
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = Math.sin(time * 4 + 1) * 0.2 - 0.4;
      rightArmRef.current.rotation.z = 0.3 + Math.cos(time * 5) * 0.15;
    }

    // Glow pulsante: audífonos/visor fuerte, trim del pecho suave.
    cyanMat.emissiveIntensity = 1.5 + beat * 2.6;
    pinkMat.emissiveIntensity = 1.3 + beat * 1.4;
  });

  const skin = '#e0c4a8';
  const jacket = '#20222b';

  return (
    // DJ protagonista de la cabina (1.45x). Ahora con chaqueta texturada, visor
    // y audífonos neón que laten al beat, y cantos redondeados como el resto.
    <group position={[0, 1.5, -0.8]} scale={1.45}>
      {/* Torso — chaqueta con textura + emissive suave + trim neón en el pecho */}
      <group ref={torsoRef} position={[0, 1.4, 0]}>
        <mesh geometry={geo} scale={[0.6, 0.8, 0.35]} castShadow>
          <meshStandardMaterial map={tex ?? undefined} color={jacket} emissive={jacket} emissiveIntensity={0.35} metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.08, 0.18]} material={pinkMat}>
          <boxGeometry args={[0.42, 0.035, 0.02]} />
        </mesh>
        <mesh position={[0, -0.08, 0.18]} material={pinkMat}>
          <boxGeometry args={[0.28, 0.025, 0.02]} />
        </mesh>
      </group>

      {/* Cabeza — piel texturada, visor neón (los "ojos") y audífonos */}
      <group ref={headRef} position={[0, 2.2, 0]}>
        <mesh geometry={geo} scale={[0.4, 0.45, 0.35]} castShadow>
          <meshStandardMaterial map={tex ?? undefined} color={skin} roughness={0.6} />
        </mesh>
        {/* Visor neón */}
        <mesh position={[0, 0.03, 0.18]} material={cyanMat}>
          <boxGeometry args={[0.34, 0.09, 0.03]} />
        </mesh>
        {/* Audífonos: banda oscura + 2 ear cups neón */}
        <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.245, 0.03, 8, 24, Math.PI]} />
          <meshStandardMaterial color="#101014" metalness={0.6} roughness={0.4} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.235, 0.02, 0]} rotation={[Math.PI / 2, 0, 0]} material={cyanMat}>
            <cylinderGeometry args={[0.1, 0.1, 0.07, 18]} />
          </mesh>
        ))}
      </group>

      {/* Brazos trabajando los decks */}
      <group ref={leftArmRef} position={[-0.45, 1.6, 0]}>
        <mesh geometry={geo} position={[-0.15, -0.2, 0.1]} scale={[0.15, 0.4, 0.15]} castShadow>
          <meshStandardMaterial map={tex ?? undefined} color={jacket} emissive={jacket} emissiveIntensity={0.3} />
        </mesh>
        <mesh geometry={geo} position={[-0.25, -0.5, 0.25]} scale={[0.12, 0.35, 0.12]} castShadow>
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
        <mesh geometry={geo} position={[-0.3, -0.7, 0.35]} scale={[0.11, 0.11, 0.09]} castShadow>
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
      </group>
      <group ref={rightArmRef} position={[0.45, 1.6, 0]}>
        <mesh geometry={geo} position={[0.15, -0.2, 0.1]} scale={[0.15, 0.4, 0.15]} castShadow>
          <meshStandardMaterial map={tex ?? undefined} color={jacket} emissive={jacket} emissiveIntensity={0.3} />
        </mesh>
        <mesh geometry={geo} position={[0.25, -0.5, 0.25]} scale={[0.12, 0.35, 0.12]} castShadow>
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
        <mesh geometry={geo} position={[0.3, -0.7, 0.35]} scale={[0.11, 0.11, 0.09]} castShadow>
          <meshStandardMaterial color={skin} roughness={0.6} />
        </mesh>
      </group>

      {/* Piernas */}
      <mesh geometry={geo} position={[-0.15, 0.5, 0]} scale={[0.2, 0.8, 0.25]} castShadow>
        <meshStandardMaterial color="#181a20" roughness={0.6} />
      </mesh>
      <mesh geometry={geo} position={[0.15, 0.5, 0]} scale={[0.2, 0.8, 0.25]} castShadow>
        <meshStandardMaterial color="#181a20" roughness={0.6} />
      </mesh>
    </group>
  );
};

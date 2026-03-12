'use client';

import React, { useMemo, MutableRefObject } from 'react';
import * as THREE from 'three';
import { getCostume, resolveColor, CostumeId, CostumeExtra } from './costumes';
import { getAccessory, AccessoryPiece } from './accessories';
import { useFaceTexture } from './useFaceTexture';

interface CharacterMeshProps {
  playerColor: string;
  faceType?: number;
  username: string;
  costumeId?: CostumeId | string;
  accessoryId?: string;
  headRef?: MutableRefObject<THREE.Group | null>;
  leftArmRef?: MutableRefObject<THREE.Mesh | null>;
  rightArmRef?: MutableRefObject<THREE.Mesh | null>;
}

const COSTUME_FACE_SIZE = 128;

function useCostumeFaceTexture(
  costumeId: CostumeId | string | undefined,
): THREE.CanvasTexture | null {
  const costume = getCostume(costumeId);

  return useMemo(() => {
    if (typeof document === 'undefined') return null;
    if (!costume.customFaceSvg) return null;

    const w = COSTUME_FACE_SIZE;
    const h = COSTUME_FACE_SIZE;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // Transparent background — face overlay only
    ctx.clearRect(0, 0, w, h);

    const svg = costume.customFaceSvg(w, h);
    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      texture.needsUpdate = true;
    };
    img.src = url;

    return texture;
  }, [costume]);
}

function ExtraGeometry({ extra, playerColor }: { extra: CostumeExtra; playerColor: string }) {
  const color = resolveColor(extra.color, playerColor);

  if (extra.type === 'sphere') {
    return (
      <mesh position={extra.position} castShadow>
        <sphereGeometry args={extra.args as [number, number, number]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    );
  }

  return (
    <mesh position={extra.position} castShadow>
      <boxGeometry args={extra.args as [number, number, number]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
    </mesh>
  );
}

function AccessoryGeometry({ piece, playerColor }: { piece: AccessoryPiece; playerColor: string }) {
  const color = resolveColor(piece.color, playerColor);
  const rotation = piece.rotation as [number, number, number] | undefined;
  const scale = piece.scale as [number, number, number] | undefined;

  if (piece.type === 'sphere') {
    return (
      <mesh position={piece.position} rotation={rotation} scale={scale} castShadow>
        <sphereGeometry args={piece.args as [number, number, number]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    );
  }

  if (piece.type === 'cylinder') {
    return (
      <mesh position={piece.position} rotation={rotation} scale={scale} castShadow>
        <cylinderGeometry args={piece.args as [number, number, number, number]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
      </mesh>
    );
  }

  return (
    <mesh position={piece.position} rotation={rotation} scale={scale} castShadow>
      <boxGeometry args={piece.args as [number, number, number]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} />
    </mesh>
  );
}

export const CharacterMesh: React.FC<CharacterMeshProps> = ({
  playerColor,
  faceType,
  username,
  costumeId,
  accessoryId,
  headRef,
  leftArmRef,
  rightArmRef,
}) => {
  const costume = getCostume(costumeId);
  const isDefault = costume.id === 'default';
  const accessory = getAccessory(accessoryId);

  // Colors
  const headColor = resolveColor(costume.colors.head, playerColor);
  const bodyColor = resolveColor(costume.colors.body, playerColor);
  const armColor = resolveColor(costume.colors.arms, playerColor);
  const legColor = resolveColor(costume.colors.legs, playerColor);

  // Body size
  const bodySize = costume.bodySize || [0.45, 0.65, 0.28];

  // Face texture: use player face for default, costume face for costumes
  const defaultFaceTexture = useFaceTexture(username, faceType);
  const costumeFaceTexture = useCostumeFaceTexture(costumeId);
  const faceTexture = isDefault ? defaultFaceTexture : costumeFaceTexture;

  // Split extras by attachment point
  const headExtras = costume.extras.filter(e => e.attachTo === 'head');
  const rootExtras = costume.extras.filter(e => e.attachTo === 'root');

  return (
    <>
      {/* Body */}
      <mesh position={[0, 1, 0]} castShadow>
        <boxGeometry args={bodySize as [number, number, number]} />
        <meshStandardMaterial color={bodyColor} emissive={bodyColor} emissiveIntensity={0.3} />
      </mesh>

      {/* Head group */}
      <group ref={headRef} position={[0, 1.5, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.32, 0.38, 0.3]} />
          <meshStandardMaterial color={headColor} emissive={headColor} emissiveIntensity={isDefault ? 0 : 0.25} />
        </mesh>
        {faceTexture && (
          <mesh position={[0, 0, 0.151]}>
            <planeGeometry args={[0.32, 0.38]} />
            <meshBasicMaterial map={faceTexture} transparent={!isDefault} />
          </mesh>
        )}
        {/* Head extras (ears, eye bulges, stem, etc.) */}
        {headExtras.map((extra, i) => (
          <ExtraGeometry key={i} extra={extra} playerColor={playerColor} />
        ))}
        {/* Accessories — only shown when costume is default */}
        {isDefault && accessory.pieces.map((piece, i) => (
          <AccessoryGeometry key={`acc-${i}`} piece={piece} playerColor={playerColor} />
        ))}
      </group>

      {/* Arms (hidden for some costumes like banana) */}
      {!costume.hideArms && (
        <>
          <mesh ref={leftArmRef} position={[-0.32, 1.1, 0]} castShadow>
            <boxGeometry args={[0.12, 0.5, 0.12]} />
            <meshStandardMaterial color={armColor} emissive={armColor} emissiveIntensity={isDefault ? 0 : 0.25} />
          </mesh>
          <mesh ref={rightArmRef} position={[0.32, 1.1, 0]} castShadow>
            <boxGeometry args={[0.12, 0.5, 0.12]} />
            <meshStandardMaterial color={armColor} emissive={armColor} emissiveIntensity={isDefault ? 0 : 0.25} />
          </mesh>
        </>
      )}

      {/* Legs */}
      <mesh position={[-0.12, 0.35, 0]} castShadow>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={legColor} emissive={legColor} emissiveIntensity={isDefault ? 0 : 0.15} />
      </mesh>
      <mesh position={[0.12, 0.35, 0]} castShadow>
        <boxGeometry args={[0.15, 0.6, 0.15]} />
        <meshStandardMaterial color={legColor} emissive={legColor} emissiveIntensity={isDefault ? 0 : 0.15} />
      </mesh>

      {/* Root extras (belly patch, etc.) */}
      {rootExtras.map((extra, i) => (
        <ExtraGeometry key={i} extra={extra} playerColor={playerColor} />
      ))}
    </>
  );
};

'use client';

import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCamera } from '../CameraContext';
import { sampleJuice, cameraZoom } from '../juice';

const CAMERA_DISTANCE = 5;
const CAMERA_HEIGHT_OFFSET = 2.2;
const CAMERA_LERP = 0.12;
const MOUSE_SENSITIVITY = 0.003;
const MIN_PITCH = -0.3; // can look slightly up
const MAX_PITCH = 1.0;  // looking down
const SHOULDER_OFFSET = 0.8; // right-shoulder offset (Fortnite-style)

/**
 * Third-person over-the-shoulder camera (Fortnite-style).
 * Desktop: pointer lock for mouse look, always active.
 * Mobile: controlled via touch on right side of screen.
 */
export const ThirdPersonCamera: React.FC = () => {
  const { playerPosRef, cameraYawRef, cameraPitchRef, pointerLockedRef } = useCamera();
  const { camera, gl } = useThree();

  const smoothPosRef = useRef(new THREE.Vector3(0, 0, 6));
  const extraDistRef = useRef(0); // alejamiento extra durante el CLUB DROP

  // Pointer lock + mouse look (desktop)
  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = (e: MouseEvent) => {
      // Don't lock if clicking UI elements
      if (e.target !== canvas) return;
      if (!pointerLockedRef.current) {
        canvas.requestPointerLock();
      }
    };

    const onLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === canvas;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!pointerLockedRef.current) return;
      cameraYawRef.current -= e.movementX * MOUSE_SENSITIVITY;
      cameraPitchRef.current = Math.max(
        MIN_PITCH,
        Math.min(MAX_PITCH, cameraPitchRef.current + e.movementY * MOUSE_SENSITIVITY),
      );
    };

    canvas.addEventListener('click', onClick);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMouseMove);

    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMouseMove);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    };
  }, [gl.domElement, cameraYawRef, cameraPitchRef, pointerLockedRef]);

  useFrame((_, delta) => {
    const target = playerPosRef.current;
    const yaw = cameraYawRef.current;
    const pitch = cameraPitchRef.current;

    // Smooth follow player position
    smoothPosRef.current.lerp(target, CAMERA_LERP);

    // Distancia con el extra del CLUB DROP (la cámara se aleja para dar
    // perspectiva del espectáculo). Se interpola suave, sin saltos.
    extraDistRef.current += (cameraZoom.extra - extraDistRef.current) * Math.min(1, delta * 2.2);
    const dist = CAMERA_DISTANCE + extraDistRef.current;

    // Spherical offset from player (behind)
    const offsetX = Math.sin(yaw) * Math.cos(pitch) * dist;
    const offsetY = Math.sin(pitch) * dist + CAMERA_HEIGHT_OFFSET + extraDistRef.current * 0.35;
    const offsetZ = Math.cos(yaw) * Math.cos(pitch) * dist;

    // Right-shoulder offset perpendicular to camera direction
    const shoulderX = Math.cos(yaw) * SHOULDER_OFFSET;
    const shoulderZ = -Math.sin(yaw) * SHOULDER_OFFSET;

    camera.position.set(
      smoothPosRef.current.x - offsetX + shoulderX,
      smoothPosRef.current.y + offsetY,
      smoothPosRef.current.z - offsetZ + shoulderZ,
    );

    // Look at a point slightly above and to the right of the player (over-shoulder aim point)
    camera.lookAt(
      smoothPosRef.current.x + shoulderX * 0.3,
      smoothPosRef.current.y + 1.5,
      smoothPosRef.current.z + shoulderZ * 0.3,
    );

    // Juice (§4): trauma-shake + kick de disparo aplicados SOBRE el offset visual —
    // la posición base se recalcula entera cada frame, así que esto es puramente
    // transitorio y nunca contamina la posición simulada del jugador.
    const j = sampleJuice(Math.min(delta, 0.05));
    if (j.kickPitchRad !== 0) camera.rotateX(j.kickPitchRad); // pitch +0.6° con recover 120ms
    if (j.roll !== 0) camera.rotateZ(j.roll); // roll de shake (máx 1°)
    if (j.offX !== 0 || j.offY !== 0) {
      camera.translateX(j.offX); // desplazamiento de shake en espacio local (máx 0.12u)
      camera.translateY(j.offY);
    }
    if (j.kickBack !== 0) camera.translateZ(j.kickBack); // retroceso del kick (0.06u)
  });

  return null;
};

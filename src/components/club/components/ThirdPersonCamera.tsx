'use client';

import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCamera } from '../CameraContext';

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

  useFrame(() => {
    const target = playerPosRef.current;
    const yaw = cameraYawRef.current;
    const pitch = cameraPitchRef.current;

    // Smooth follow player position
    smoothPosRef.current.lerp(target, CAMERA_LERP);

    // Spherical offset from player (behind)
    const offsetX = Math.sin(yaw) * Math.cos(pitch) * CAMERA_DISTANCE;
    const offsetY = Math.sin(pitch) * CAMERA_DISTANCE + CAMERA_HEIGHT_OFFSET;
    const offsetZ = Math.cos(yaw) * Math.cos(pitch) * CAMERA_DISTANCE;

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
  });

  return null;
};

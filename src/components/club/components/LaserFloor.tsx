'use client';

// Lásers de la pista (WS-3): el throb global ahora late con el beatClock de
// 174 BPM (M2) vía uniform u_beat — misma fuente que strobes y beat-shot.
// Etapas de energía (M4): media → lásers LENTOS (tiempo a 55%) y algo más tenues;
// EL BAJÓN → muy lentos y al 40%. Calidad baja: no se renderiza (es puro fill-rate).

import React, { useRef, useMemo, useEffect, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBeatPhase } from '../beatClock';
import { useQuality } from '../quality';
import { useEnergyOptional } from './Lighting';

interface LaserFloorProps {
  isPlayingRef: MutableRefObject<boolean>;
}

// Velocidad del sweep e intensidad por etapa de energía
const STAGE_SPEED = { full: 1.0, media: 0.55, bajon: 0.35 } as const;
const STAGE_INTENSITY = { full: 1.0, media: 0.75, bajon: 0.4 } as const;

const laserVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const laserFragmentShader = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;
uniform float u_beat;
uniform float u_intensity;

#define PI 3.14159265359

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float hash3(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}

float noise3d(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash3(i);
  float n100 = hash3(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash3(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash3(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash3(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash3(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash3(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash3(i + vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);
  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);
  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  vec3 shift = vec3(100.0);
  for (int i = 0; i < 2; i++) {
    v += a * noise3d(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

vec3 coneColor(int idx, float hueShift) {
  vec3 col;
  if (idx == 0) col = vec3(1.0, 0.0, 0.5);
  else if (idx == 1) col = vec3(0.5, 0.05, 1.0);
  else if (idx == 2) col = vec3(0.85, 0.0, 0.85);
  else col = vec3(0.15, 0.2, 1.0);

  float angle = hueShift;
  float cosA = cos(angle);
  float sinA = sin(angle);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 grey = vec3(lum);
  vec3 diff = col - grey;
  vec3 axis1 = normalize(vec3(1.0, -1.0, 0.0));
  vec3 axis2 = normalize(vec3(0.5, 0.5, -1.0));
  float d1 = dot(diff, axis1);
  float d2 = dot(diff, axis2);
  vec3 rotated = grey + axis1 * (d1 * cosA - d2 * sinA) + axis2 * (d1 * sinA + d2 * cosA);
  return clamp(rotated, 0.0, 1.0);
}

varying vec2 vUv;

void main() {
  vec2 fragUV = vUv;
  float aspect = u_res.x / u_res.y;
  vec2 uv = fragUV;
  uv.x = (uv.x - 0.5) * aspect;

  float t = u_time * 0.5;
  float intensity = u_intensity;

  vec3 fogCoord = vec3(fragUV * 3.0, t * 0.08);
  fogCoord.y -= t * 0.03;
  fogCoord.x += t * 0.015;
  float fog = fbm(fogCoord);
  fog = fog * fog * 1.5;

  vec3 col = vec3(0.0);

  float hueShift = sin(t * 0.07) * 0.2;
  // Throb global al beat real de 174 BPM (u_beat viene del beatClock, no de sin(t))
  float globalBeat = u_beat * 0.25;

  // Far layer: 2 cones
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float originX = (fi - 0.5) * 0.4 * aspect;
    originX += sin(t * 0.07 + fi * 2.5) * 0.1 * aspect;
    vec2 origin = vec2(originX, 1.05);

    float sweepAmp = 0.4 + fi * 0.1;
    float sweepFreq = 0.3 + fi * 0.11;
    float theta = sin(t * sweepFreq * 0.7 + fi * 1.9) * sweepAmp;
    vec2 dir = vec2(sin(theta), -cos(theta));

    vec2 toPixel = uv - origin;
    float along = dot(toPixel, dir);
    float perp = abs(toPixel.x * dir.y - toPixel.y * dir.x);

    float halfWidth = 0.13 + fi * 0.015;
    float coneWidth = halfWidth * max(along, 0.0) + 0.012;
    float inCone = exp(-perp * perp / (coneWidth * coneWidth * 0.55));
    inCone *= smoothstep(0.0, 0.08, along);
    inCone *= exp(-along * along * 0.15);

    float fogMod = 0.25 + fog * 0.75;
    float volumetric = inCone * fogMod;

    vec3 coneCol = coneColor(i, hueShift + fi * 0.15);
    col += coneCol * volumetric * 0.35 * intensity * (1.0 + globalBeat);
  }

  // Near layer: 2 cones
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    int colorIdx = i + 2;

    float originX = (fi - 0.5) * 0.5 * aspect + 0.15 * aspect;
    originX += sin(t * 0.1 + fi * 3.1 + 1.0) * 0.08 * aspect;
    vec2 origin = vec2(originX, 1.02);

    float sweepAmp = 0.5 + fi * 0.08;
    float sweepFreq = 0.4 + fi * 0.13;
    float theta = sin(t * sweepFreq + fi * 2.3 + 0.7) * sweepAmp;

    // Snap del barrido acoplado al beat real
    float snapGate = smoothstep(0.5, 0.85, sin(t * 0.7 + fi * 2.094));
    theta += u_beat * snapGate * 0.15 * sin(t * 1.3 + fi);

    vec2 dir = vec2(sin(theta), -cos(theta));

    vec2 toPixel = uv - origin;
    float along = dot(toPixel, dir);
    float perp = abs(toPixel.x * dir.y - toPixel.y * dir.x);

    float halfWidth = 0.11 + fi * 0.012;
    float coneWidth = halfWidth * max(along, 0.0) + 0.01;

    float inCone = exp(-perp * perp / (coneWidth * coneWidth * 0.4));
    float coreLine = exp(-perp * perp / (coneWidth * coneWidth * 0.04));
    inCone = inCone + coreLine * 0.4;
    inCone *= smoothstep(0.0, 0.06, along);
    inCone *= exp(-along * along * 0.1);

    float fogMod = 0.2 + fog * 0.8;
    float volumetric = inCone * fogMod;

    vec3 coneCol = coneColor(colorIdx, hueShift + fi * 0.15 + 0.5);
    col += coneCol * volumetric * 0.75 * intensity * (1.0 + globalBeat);
  }

  float brightness = dot(col, vec3(0.299, 0.587, 0.114));
  float whiteBlend = smoothstep(0.4, 1.2, brightness);
  col = mix(col, vec3(brightness * 1.3), whiteBlend * 0.5);

  // Ground haze — simplified, single fbm call
  float groundHaze = smoothstep(0.2, 0.0, fragUV.y);
  col += col * groundHaze * 0.3;
  col += vec3(0.06, 0.03, 0.1) * groundHaze * fog * intensity;

  // Tone mapping
  float exposure = 2.0;
  col = 1.0 - exp(-col * exposure);

  // Vignette
  vec2 vigUV = fragUV - 0.5;
  float vigDist = dot(vigUV, vigUV);
  float vig = 1.0 - vigDist * 0.8;
  col *= clamp(vig, 0.0, 1.0);

  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col, max(col.r, max(col.g, col.b)) * 0.9);
}
`;

const LaserFloorInner: React.FC<LaserFloorProps> = ({ isPlayingRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  // Tiempo propio acumulado: la etapa de energía escala su velocidad (lásers lentos)
  const laserTimeRef = useRef<number>(0);
  const speedRef = useRef(1);
  const intensityRef = useRef(1);
  const energy = useEnergyOptional();

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: laserVertexShader,
      fragmentShader: laserFragmentShader,
      uniforms: {
        u_time: { value: 0.0 },
        u_res: { value: new THREE.Vector2(1024, 1024) },
        u_beat: { value: 0.0 },
        u_intensity: { value: 1.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, []);

  useEffect(() => {
    return () => shaderMaterial.dispose();
  }, [shaderMaterial]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // Objetivos por etapa (GLORIA = full) con lerp suave
    let targetSpeed = 1;
    let targetIntensity = 1;
    if (energy) {
      const gloria = energy.gloriaActiveRef.current;
      const stage = energy.stageRef.current;
      targetSpeed = gloria ? 1 : STAGE_SPEED[stage];
      targetIntensity = gloria ? 1 : STAGE_INTENSITY[stage];
    }
    speedRef.current += (targetSpeed - speedRef.current) * Math.min(1, dt * 2);
    intensityRef.current += (targetIntensity - intensityRef.current) * Math.min(1, dt * 2);

    if (isPlayingRef.current) {
      laserTimeRef.current += dt * speedRef.current;
      // Pulso al beat: cae con la fase (máximo justo EN el beat, igual que isOnBeat)
      const beatPulse = Math.pow(1 - getBeatPhase(), 3);
      shaderMaterial.uniforms.u_beat.value = beatPulse;
    }
    shaderMaterial.uniforms.u_time.value = laserTimeRef.current;
    shaderMaterial.uniforms.u_intensity.value = intensityRef.current;
  });

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.43, 0]}
      material={shaderMaterial}
    >
      <planeGeometry args={[14, 14]} />
    </mesh>
  );
};

export const LaserFloor: React.FC<LaserFloorProps> = ({ isPlayingRef }) => {
  const quality = useQuality();
  // Calidad baja: los lásers son puro costo de fragment shader — fuera
  if (quality === 'baja') return null;
  return <LaserFloorInner isPlayingRef={isPlayingRef} />;
};

'use client';

import React, { useRef, useMemo, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StrobeWallsProps {
  isPlayingRef: MutableRefObject<boolean>;
}

const strobeVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const strobeFragmentShader = `
precision highp float;
uniform float u_time;
uniform vec2 u_res;

#define PI 3.141592653589793
#define MAX_SHAPES 5

vec3 ACESFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

vec2 hash2(float n) {
  return vec2(hash(n), hash(n + 7.31));
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = i.x + i.y * 57.0;
  return mix(mix(hash(n), hash(n + 1.0), f.x),
             mix(hash(n + 57.0), hash(n + 58.0), f.x), f.y);
}

mat2 rot2(float a) {
  float c = cos(a); float s = sin(a);
  return mat2(c, -s, s, c);
}

float sdTriangle(vec2 p, float r) {
  float k = sqrt(3.0);
  p.x = abs(p.x) - r;
  p.y = p.y + r / k;
  if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0 * r, 0.0);
  return -length(p) * sign(p.y);
}

float sdParallelogram(vec2 p, float wi, float he, float sk) {
  vec2 e = vec2(sk, he);
  p = (p.y < 0.0) ? -p : p;
  vec2 w = p - e;
  w.x -= clamp(w.x, -wi, wi);
  vec2 d = vec2(dot(w, w), -w.y);
  float s = p.x * e.y - p.y * e.x;
  p = (s < 0.0) ? -p : p;
  vec2 v = p - vec2(wi, 0);
  v -= e * clamp(dot(v, e) / dot(e, e), -1.0, 1.0);
  d = min(d, vec2(dot(v, v), wi * he - abs(s)));
  return sqrt(d.x) * sign(-d.y);
}

float sdRhombus(vec2 p, vec2 b) {
  vec2 q = abs(p);
  float h = clamp((-2.0 * dot(q, b) + dot(b, b)) / dot(b, b), -1.0, 1.0);
  float d = length(q - 0.5 * b * vec2(1.0 - h, 1.0 + h));
  return d * sign(q.x * b.y + q.y * b.x - b.x * b.y);
}

float sdHexagon(vec2 p, float r) {
  vec2 q = abs(p);
  float d = dot(q, normalize(vec2(1.0, 1.732)));
  return max(d, q.y) - r;
}

float sdTrapezoid(vec2 p, float r1, float r2, float he) {
  vec2 k1 = vec2(r2, he);
  vec2 k2 = vec2(r2 - r1, 2.0 * he);
  p.x = abs(p.x);
  vec2 ca = vec2(max(0.0, p.x - ((p.y < 0.0) ? r1 : r2)), abs(p.y) - he);
  vec2 cb = p - k1 + k2 * clamp(dot(k1 - p, k2) / dot(k2, k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot(ca, ca), dot(cb, cb)));
}

float evalShape(vec2 p, int type, float scale) {
  float d = 1e5;
  if (type == 0) d = sdTriangle(p, scale * 0.36);
  else if (type == 1) d = sdParallelogram(p, scale * 0.38, scale * 0.14, scale * 0.15);
  else if (type == 2) d = sdRhombus(p, vec2(scale * 0.12, scale * 0.40));
  else if (type == 3) d = sdHexagon(p, scale * 0.25);
  else if (type == 4) d = sdTrapezoid(p, scale * 0.15, scale * 0.35, scale * 0.18);
  return d;
}

vec3 decayColor(float phase) {
  // Moody cyberpunk palette — deep purple, indigo, plum
  vec3 lavender = vec3(0.5, 0.3, 0.9);
  vec3 cyan = vec3(0.0, 0.6, 0.8);
  vec3 indigo = vec3(0.3, 0.1, 0.7);
  vec3 plum = vec3(0.5, 0.15, 0.5);
  vec3 deepBlue = vec3(0.05, 0.1, 0.4);
  vec3 dark = vec3(0.02, 0.01, 0.04);

  vec3 col = dark;
  if (phase < 0.05) col = mix(lavender, cyan, phase / 0.05);
  else if (phase < 0.20) col = mix(cyan, indigo, (phase - 0.05) / 0.15);
  else if (phase < 0.40) col = mix(indigo, plum, (phase - 0.20) / 0.20);
  else if (phase < 0.60) col = mix(plum, deepBlue, (phase - 0.40) / 0.20);
  else if (phase < 0.80) col = mix(deepBlue, dark * 3.0, (phase - 0.60) / 0.20);
  else col = mix(dark * 2.0, dark, (phase - 0.80) / 0.20);
  return col;
}

struct ShapeData {
  vec2 center;
  float rotation;
  float scale;
  int type;
  float birthTime;
};

ShapeData getShape(int idx, float flashInterval, float time) {
  ShapeData s;
  float fi = float(idx);
  bool isStrong = (mod(fi, 2.0) < 0.5);
  float cycleLen = float(MAX_SHAPES) * flashInterval;
  float cycle = floor(time / cycleLen);
  float seed = fi * 13.37 + cycle * 97.31;
  float jitter = (hash(seed + 10.0) - 0.5) * 0.2 * flashInterval;
  s.birthTime = fi * flashInterval + jitter;
  vec2 basePos = hash2(seed + 1.0) * 2.0 - 1.0;
  s.center = basePos * vec2(0.25, 0.20);
  float baseAngle = floor(hash(seed + 2.0) * 8.0) * (PI / 4.0);
  float angleJitter = (hash(seed + 5.0) - 0.5) * (PI / 6.0);
  s.rotation = baseAngle + angleJitter;
  float baseScale = 0.2 + hash(seed + 3.0) * 0.5;
  s.scale = isStrong ? baseScale * 1.3 : baseScale * 0.7;
  s.type = int(mod(hash(seed + 4.0) * 5.0, 5.0));
  return s;
}

varying vec2 vUv;

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  float t = u_time;
  float flashInterval = 1.4;
  float decayDuration = 2.5;
  float cycleLen = float(MAX_SHAPES) * flashInterval;
  float cycleTime = mod(t, cycleLen);

  // Background
  vec3 bg = vec3(0.015, 0.012, 0.025);
  float bgNoise = vnoise(p * 3.0 + t * 0.05);
  bg += vec3(0.008, 0.006, 0.015) * bgNoise;

  float currentShapeIdx = floor(cycleTime / flashInterval);
  float timeSinceLastFlash = cycleTime - currentShapeIdx * flashInterval;
  bool currentIsStrong = (mod(currentShapeIdx, 2.0) < 0.5);
  float bgPulseStrength = currentIsStrong ? 0.08 : 0.04;
  float bgPulse = exp(-timeSinceLastFlash * 8.0) * bgPulseStrength;
  bg += vec3(0.04, 0.03, 0.06) * bgPulse;

  vec3 col = bg;

  for (int i = 0; i < MAX_SHAPES; i++) {
      ShapeData shape = getShape(i, flashInterval, t);
      float birthT = shape.birthTime;
      float fi = float(i);
      bool isStrong = (mod(fi, 2.0) < 0.5);

      float age = cycleTime - birthT;
      if (age < 0.0 || age > decayDuration) continue;

      float phase = age / decayDuration;

      vec2 localP = p - shape.center;
      localP = rot2(shape.rotation) * localP;
      float d = evalShape(localP, shape.type, shape.scale);

      float flashPhase = clamp(age / 0.2, 0.0, 1.0);
      float isFlashing = 1.0 - flashPhase;
      float beatMul = isStrong ? 1.4 : 0.8;

      float fillAlpha = smoothstep(0.005, -0.005, d);
      float interiorDist = clamp(-d / (shape.scale * 0.25), 0.0, 1.0);
      float edgeBrightness = 1.0 - interiorDist * 0.65;
      float fillFade = exp(-age * 2.5);
      float flashBright = isFlashing * 0.8 * beatMul + fillFade;
      vec3 fillColor = decayColor(phase) * flashBright * edgeBrightness;
      fillColor = mix(fillColor, vec3(1.2) * edgeBrightness, isFlashing * fillAlpha * 0.4);
      col += fillColor * fillAlpha * (1.0 - phase * phase) * 0.4;

      float edgeWidth = 0.006 + 0.003 * (1.0 - phase);
      float edge = smoothstep(edgeWidth, edgeWidth * 0.3, abs(d));
      float edgeFade = 1.0 - phase * phase * phase;
      vec3 edgeColor = decayColor(phase * 0.85) * edgeFade;
      col += edgeColor * edge * 0.8;

      float bloomWidthFlash = isStrong ? 0.08 : 0.05;
      float bloomWidthDecay = 0.015 + 0.015 * (1.0 - phase);
      float bloomWidth = mix(bloomWidthDecay, bloomWidthFlash, isFlashing);
      float bloom = exp(-abs(d) / bloomWidth);
      float bloomIntensity = mix(0.2, 0.8 * beatMul, isFlashing) * (1.0 - phase);
      vec3 bloomColor = decayColor(phase * 0.7);
      vec3 warmBloom = mix(bloomColor, bloomColor + vec3(0.05, 0.04, 0.02), bloom * isFlashing);
      col += warmBloom * bloom * bloomIntensity * 0.35;

      if (age < 0.15) {
        float hotBloomWidth = isStrong ? 0.08 : 0.05;
        float hotBloom = exp(-abs(d) / hotBloomWidth) * isFlashing;
        col += decayColor(0.0) * hotBloom * 0.3 * beatMul;
      }
  }

  // Scanlines
  float scanline = sin(vUv.y * u_res.y * 1.5) * 0.5 + 0.5;
  scanline = 0.92 + scanline * 0.08;
  col *= scanline;

  // Edge fade — smooth falloff so shapes never clip at panel borders
  float edgeFadeX = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float edgeFadeY = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  col *= edgeFadeX * edgeFadeY;

  // Vignette
  vec2 vc = vUv - 0.5;
  float vig = 1.0 - dot(vc, vc) * 1.2;
  col *= clamp(pow(max(vig, 0.0), 0.6), 0.0, 1.0);

  col = ACESFilm(col);
  col = pow(max(col, 0.0), vec3(0.95));

  float alpha = max(col.r, max(col.g, col.b));
  alpha = smoothstep(0.02, 0.15, alpha);
  gl_FragColor = vec4(col, alpha * 0.85);
}
`;

const StrobePanel: React.FC<{
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  timeOffset: number;
  isPlayingRef: MutableRefObject<boolean>;
}> = ({ position, rotation, size, timeOffset, isPlayingRef }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const frozenTimeRef = useRef<number>(0);

  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: strobeVertexShader,
      fragmentShader: strobeFragmentShader,
      uniforms: {
        u_time: { value: timeOffset },
        u_res: { value: new THREE.Vector2(size[0] * 48, size[1] * 48) },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }, [timeOffset, size]);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    material.uniforms.u_time.value = frozenTimeRef.current + timeOffset;
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation} material={material}>
      <planeGeometry args={size} />
    </mesh>
  );
};

export const StrobeWalls: React.FC<StrobeWallsProps> = ({ isPlayingRef }) => {
  return (
    <group>
      {/* Left side */}
      <StrobePanel
        position={[-11, 4.5, -1]}
        rotation={[0, Math.PI / 5, 0]}
        size={[7, 10]}
        timeOffset={0}
        isPlayingRef={isPlayingRef}
      />
      {/* Right side */}
      <StrobePanel
        position={[11, 4.5, -1]}
        rotation={[0, -Math.PI / 5, 0]}
        size={[7, 10]}
        timeOffset={7}
        isPlayingRef={isPlayingRef}
      />
      {/* Behind DJ */}
      <StrobePanel
        position={[-4, 5, -8]}
        rotation={[0.05, 0.15, 0]}
        size={[6, 9]}
        timeOffset={5}
        isPlayingRef={isPlayingRef}
      />
      <StrobePanel
        position={[4, 5, -8]}
        rotation={[0.05, -0.15, 0]}
        size={[6, 9]}
        timeOffset={8.5}
        isPlayingRef={isPlayingRef}
      />
      <StrobePanel
        position={[0, 6, -9.5]}
        rotation={[0.08, 0, 0]}
        size={[5, 7]}
        timeOffset={12}
        isPlayingRef={isPlayingRef}
      />
    </group>
  );
};

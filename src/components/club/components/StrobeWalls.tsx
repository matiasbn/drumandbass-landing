'use client';

// Muros strobe (WS-3): sincronizados al beatClock de 174 BPM (M2) — el MISMO
// pulso que valida el beat-shot, porque el jugador sincroniza con lo que VE.
// Cada panel flashea cada 4 beats (≈1.38s, casi el 1.4s del look original) y los
// 4 paneles van desfasados 1 beat entre sí: en CADA beat flashea exactamente un muro.
// Etapas de energía (M4): media → 70%, EL BAJÓN → strobes apagados, GLORIA → full.
// Calidad baja: versión simple (1 material basic compartido pulsando al beat).

import React, { useRef, useMemo, useEffect, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BEAT_PERIOD_MS, getBeatPhase } from '../beatClock';
import { useQuality } from '../quality';
import { useEnergyOptional } from './Lighting';

interface StrobeWallsProps {
  isPlayingRef: MutableRefObject<boolean>;
}

const BEAT_S = BEAT_PERIOD_MS / 1000;
// Un flash por panel cada 4 beats — reemplaza el viejo flashInterval fijo de 1.4s
const FLASH_INTERVAL_S = 4 * BEAT_S;

// Factor por etapa de energía (strobes APAGADOS en EL BAJÓN)
const STAGE_FACTOR = { full: 1.0, media: 0.7, bajon: 0.0 } as const;

interface PanelConfig {
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  /** Desfase en beats (0-3): reparte los flashes para que cada beat tenga un muro */
  beatOffset: number;
}

const PANELS: PanelConfig[] = [
  // Fuera del borde del piso (±22) para no invadir la zona caminable
  { position: [-25, 5, 0], rotation: [0, Math.PI / 2, 0], size: [24, 14], beatOffset: 0 },
  { position: [25, 5, 0], rotation: [0, -Math.PI / 2, 0], size: [24, 14], beatOffset: 2 },
  { position: [0, 5.5, -25], rotation: [0.05, 0, 0], size: [24, 14], beatOffset: 1 },
  { position: [0, 5.5, 25], rotation: [-0.05, Math.PI, 0], size: [24, 14], beatOffset: 3 },
];

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
uniform float u_intensity;

#define PI 3.141592653589793
#define MAX_SHAPES 2

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

float sdRhombus(vec2 p, vec2 b) {
  vec2 q = abs(p);
  float h = clamp((-2.0 * dot(q, b) + dot(b, b)) / dot(b, b), -1.0, 1.0);
  float d = length(q - 0.5 * b * vec2(1.0 - h, 1.0 + h));
  return d * sign(q.x * b.y + q.y * b.x - b.x * b.y);
}

float evalShape(vec2 p, int type, float scale) {
  if (type == 0) return sdTriangle(p, scale * 0.36);
  return sdRhombus(p, vec2(scale * 0.12, scale * 0.40));
}

vec3 decayColor(float phase) {
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
  s.birthTime = fi * flashInterval;
  vec2 basePos = hash2(seed + 1.0) * 2.0 - 1.0;
  s.center = basePos * vec2(0.25, 0.20);
  float baseAngle = floor(hash(seed + 2.0) * 8.0) * (PI / 4.0);
  float angleJitter = (hash(seed + 5.0) - 0.5) * (PI / 6.0);
  s.rotation = baseAngle + angleJitter;
  float baseScale = 0.2 + hash(seed + 3.0) * 0.5;
  s.scale = isStrong ? baseScale * 1.3 : baseScale * 0.7;
  s.type = int(mod(hash(seed + 4.0) * 2.0, 2.0));
  return s;
}

varying vec2 vUv;

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  float t = u_time;
  // Beat-lock: 4 beats de 174 BPM por flash (antes 1.4s arbitrarios).
  // Sin jitter de nacimiento: el flash cae EXACTO en el beat (es la guía del beat-shot).
  float flashInterval = ${FLASH_INTERVAL_S.toFixed(6)};
  float decayDuration = 2.5;
  float cycleLen = float(MAX_SHAPES) * flashInterval;
  float cycleTime = mod(t, cycleLen);

  vec3 bg = vec3(0.015, 0.012, 0.025);

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

      // Fill
      float fillAlpha = smoothstep(0.005, -0.005, d);
      float fillFade = exp(-age * 2.5);
      float flashBright = isFlashing * 0.8 * beatMul + fillFade;
      vec3 fillColor = decayColor(phase) * flashBright;
      fillColor = mix(fillColor, vec3(1.2), isFlashing * fillAlpha * 0.4);
      col += fillColor * fillAlpha * (1.0 - phase * phase) * 0.4;

      // Edge
      float edgeWidth = 0.006 + 0.003 * (1.0 - phase);
      float edge = smoothstep(edgeWidth, edgeWidth * 0.3, abs(d));
      float edgeFade = 1.0 - phase * phase * phase;
      vec3 edgeColor = decayColor(phase * 0.85) * edgeFade;
      col += edgeColor * edge * 0.8;

      // Simplified bloom: single smoothstep glow instead of multiple exp() calls
      float bloomWidth = 0.02 + 0.06 * isFlashing * (isStrong ? 1.0 : 0.6);
      float bloom = smoothstep(bloomWidth, 0.0, abs(d));
      float bloomIntensity = mix(0.2, 0.8 * beatMul, isFlashing) * (1.0 - phase);
      vec3 bloomColor = decayColor(phase * 0.7);
      col += bloomColor * bloom * bloomIntensity * 0.35;
  }

  float scanline = sin(vUv.y * u_res.y * 1.5) * 0.5 + 0.5;
  scanline = 0.92 + scanline * 0.08;
  col *= scanline;

  float edgeFadeX = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
  float edgeFadeY = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  col *= edgeFadeX * edgeFadeY;

  vec2 vc = vUv - 0.5;
  float vig = 1.0 - dot(vc, vc) * 1.2;
  col *= clamp(pow(max(vig, 0.0), 0.6), 0.0, 1.0);

  col = ACESFilm(col);
  col = pow(max(col, 0.0), vec3(0.95));

  col *= u_intensity;

  float alpha = max(col.r, max(col.g, col.b));
  alpha = smoothstep(0.02, 0.15, alpha);
  gl_FragColor = vec4(col, alpha * 0.85 * u_intensity);
}
`;

/** Tiempo alineado al beat: en cada beat, beatTime es un múltiplo exacto de BEAT_S */
function useBeatTime(isPlayingRef: MutableRefObject<boolean>) {
  // beats acumulados + última fase vista (para detectar el wrap)
  const stateRef = useRef({ beats: 0, lastPhase: 0, beatTime: 0 });
  const tick = () => {
    if (!isPlayingRef.current) return stateRef.current.beatTime;
    const s = stateRef.current;
    const ph = getBeatPhase();
    if (ph < s.lastPhase - 0.5) s.beats++;
    s.lastPhase = ph;
    s.beatTime = (s.beats + ph) * BEAT_S;
    return s.beatTime;
  };
  return tick;
}

/** Factor de intensidad por etapa de energía, con lerp suave */
function useEnergyFactor() {
  const energy = useEnergyOptional();
  const factorRef = useRef(1);
  const tick = (delta: number) => {
    let target = 1;
    if (energy) {
      target = energy.gloriaActiveRef.current ? 1 : STAGE_FACTOR[energy.stageRef.current];
    }
    const dt = Math.min(delta, 0.05);
    factorRef.current += (target - factorRef.current) * Math.min(1, dt * 3);
    return factorRef.current;
  };
  return tick;
}

// --- Versión completa (calidad alta/media): shader por panel, beat-locked ---

const FullStrobes: React.FC<StrobeWallsProps> = ({ isPlayingRef }) => {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([null, null, null, null]);
  const beatTick = useBeatTime(isPlayingRef);
  const energyTick = useEnergyFactor();

  const materials = useMemo(
    () =>
      PANELS.map(
        (panel) =>
          new THREE.ShaderMaterial({
            vertexShader: strobeVertexShader,
            fragmentShader: strobeFragmentShader,
            uniforms: {
              u_time: { value: panel.beatOffset * BEAT_S },
              u_res: { value: new THREE.Vector2(panel.size[0] * 48, panel.size[1] * 48) },
              u_intensity: { value: 1 },
            },
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          }),
      ),
    [],
  );

  useEffect(() => {
    return () => materials.forEach((m) => m.dispose());
  }, [materials]);

  useFrame((_, delta) => {
    const beatTime = beatTick();
    const factor = energyTick(delta);
    const visible = factor > 0.02;
    for (let i = 0; i < PANELS.length; i++) {
      materials[i].uniforms.u_time.value = beatTime + PANELS[i].beatOffset * BEAT_S;
      materials[i].uniforms.u_intensity.value = factor;
      const mesh = meshRefs.current[i];
      if (mesh) mesh.visible = visible;
    }
  });

  return (
    <group>
      {PANELS.map((panel, i) => (
        <mesh
          key={i}
          ref={(el) => {
            meshRefs.current[i] = el;
          }}
          position={panel.position}
          rotation={panel.rotation}
          material={materials[i]}
        >
          <planeGeometry args={panel.size} />
        </mesh>
      ))}
    </group>
  );
};

// --- Versión simple (calidad baja): 1 material basic compartido, flash al beat ---

const SimpleStrobes: React.FC<StrobeWallsProps> = ({ isPlayingRef }) => {
  const beatTick = useBeatTime(isPlayingRef);
  const energyTick = useEnergyFactor();
  const groupRef = useRef<THREE.Group>(null);

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#7f4ce6', // lavanda de la paleta strobe
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );

  useEffect(() => {
    return () => material.dispose();
  }, [material]);

  useFrame((_, delta) => {
    const beatTime = beatTick();
    const factor = energyTick(delta);
    // Pulso cada 2 beats con decay exponencial — la misma guía rítmica, sin shader
    const cycle = (beatTime / BEAT_S) % 2;
    material.opacity = 0.28 * Math.exp(-cycle * 3.5) * factor;
    if (groupRef.current) groupRef.current.visible = factor > 0.02;
  });

  return (
    <group ref={groupRef}>
      {PANELS.map((panel, i) => (
        <mesh key={i} position={panel.position} rotation={panel.rotation} material={material}>
          <planeGeometry args={panel.size} />
        </mesh>
      ))}
    </group>
  );
};

export const StrobeWalls: React.FC<StrobeWallsProps> = ({ isPlayingRef }) => {
  const quality = useQuality();
  return quality === 'baja' ? (
    <SimpleStrobes isPlayingRef={isPlayingRef} />
  ) : (
    <FullStrobes isPlayingRef={isPlayingRef} />
  );
};

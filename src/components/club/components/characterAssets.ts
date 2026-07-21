import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Assets compartidos de los personajes (jugador + NPCs). Objetivo del rediseño:
// que se vean MENOS cuadrados (esquinas redondeadas) y CON textura, y que
// resalten aunque las luces del club sean pocas.

/**
 * Caja de esquinas redondeadas de dimensión unidad (1×1×1). Se escala por
 * instancia con la matriz de animación, igual que la boxGeometry anterior, así
 * que las proporciones del baile no cambian — sólo se suavizan los cantos.
 * Radio y segmentos bajos para no inflar el conteo de triángulos.
 */
export function makeRoundedUnitBox(radius = 0.14, segments = 2): THREE.BufferGeometry {
  return new RoundedBoxGeometry(1, 1, 1, segments, radius);
}

// Box unidad redondeado compartido (cacheado) para el jugador y los remotos:
// se referencia con la prop `geometry` de cada mesh y se escala con `scale`,
// así todas las partes comparten una sola geometría.
let _sharedUnit: THREE.BufferGeometry | null = null;
export function getSharedRoundedUnitBox(): THREE.BufferGeometry {
  if (!_sharedUnit) _sharedUnit = new RoundedBoxGeometry(1, 1, 1, 2, 0.16);
  return _sharedUnit;
}

// ─── Atlas de CARAS para los bailarines instanciados ──────────────────
// 4×4 = 16 caras distintas (una por bot) en una sola textura. Cada instancia
// elige su celda con un desplazamiento de UV, así los 16 rostros se dibujan
// en UNA sola draw call. Fondo transparente: se ve el tono de piel debajo.
export const FACE_ATLAS_COLS = 4;
const FACE_CELL = 128;

let _faceAtlas: THREE.CanvasTexture | null = null;

export function getFaceAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  if (_faceAtlas) return _faceAtlas;

  const size = FACE_CELL * FACE_ATLAS_COLS;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const ink = '#15151c';
  for (let i = 0; i < FACE_ATLAS_COLS * FACE_ATLAS_COLS; i++) {
    const cx = (i % FACE_ATLAS_COLS) * FACE_CELL;
    const cy = Math.floor(i / FACE_ATLAS_COLS) * FACE_CELL;
    ctx.save();
    ctx.translate(cx, cy);

    const eyeY = 46 + (i % 3) * 4;
    const eyeDx = 26 + (i % 4) * 3;
    const eyeStyle = i % 4; // 0 punto · 1 cuadrado · 2 raya · 3 anteojos
    ctx.fillStyle = ink;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';

    if (eyeStyle === 3) {
      // Anteojos de fiesta
      ctx.fillRect(64 - eyeDx - 16, eyeY - 11, 32, 22);
      ctx.fillRect(64 + eyeDx - 16, eyeY - 11, 32, 22);
      ctx.beginPath();
      ctx.moveTo(64 - eyeDx + 16, eyeY);
      ctx.lineTo(64 + eyeDx - 16, eyeY);
      ctx.stroke();
    } else {
      for (const sx of [-1, 1]) {
        const ex = 64 + sx * eyeDx;
        if (eyeStyle === 0) {
          ctx.beginPath();
          ctx.arc(ex, eyeY, 8, 0, Math.PI * 2);
          ctx.fill();
        } else if (eyeStyle === 1) {
          ctx.fillRect(ex - 7, eyeY - 8, 14, 16);
        } else {
          ctx.beginPath();
          ctx.moveTo(ex - 9, eyeY);
          ctx.lineTo(ex + 9, eyeY);
          ctx.stroke();
        }
      }
    }

    // Boca: sonrisa, raya, "o" o lengua fuera
    const mouth = Math.floor(i / 4) % 4;
    const my = 88;
    ctx.beginPath();
    if (mouth === 0) {
      ctx.arc(64, my - 8, 16, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (mouth === 1) {
      ctx.moveTo(50, my);
      ctx.lineTo(78, my);
      ctx.stroke();
    } else if (mouth === 2) {
      ctx.arc(64, my, 10, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.arc(64, my - 6, 14, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.fillStyle = '#ff5c8a';
      ctx.beginPath();
      ctx.arc(64, my + 6, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  _faceAtlas = tex;
  return tex;
}

// Textura procedural compartida (una sola, cacheada). Gris con un degradado
// vertical (más claro arriba, más oscuro abajo) que hace de sombreado falso
// para dar forma sobre un material sin luces, más un tejido sutil de líneas
// que aporta "textura". Multiplica al color de instancia (que sí es vívido),
// así que cada personaje sale llamativo pero con volumen y detalle.
let _skinTex: THREE.CanvasTexture | null = null;

export function getCharacterTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null; // SSR
  if (_skinTex) return _skinTex;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Degradado vertical → sombreado de forma (arriba brilla, abajo apaga).
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.5, '#ededed');
  grad.addColorStop(1, '#bfbfbf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Líneas horizontales tenues → "tela"/textura.
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#000000';
  for (let y = 0; y < size; y += 3) ctx.fillRect(0, y, size, 1);
  // Brillo especular falso en una franja superior.
  ctx.globalAlpha = 0.10;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 2, size, 4);
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  _skinTex = tex;
  return tex;
}

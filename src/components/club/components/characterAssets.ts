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

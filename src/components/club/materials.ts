// Materiales y geometrías COMPARTIDOS de la escena estática del club (WS-3, §7).
// Regla: material-sharing + instancing, NO mergeGeometries (el look neón vive en los
// bordes emissive). El color real de cada pieza va por instancia (instanceColor),
// así toda la utilería converge en 2 materiales y un puñado de draw calls.

import * as THREE from 'three';

/** Paleta neón del club — misma que usaban los componentes por separado */
export const NEON = {
  pink: '#ff0055',
  cyan: '#00ccff',
  green: '#00ff41',
  orange: '#ff8800',
} as const;

// ---------------------------------------------------------------------------
// Geometrías unitarias compartidas (la forma real se logra con la escala por instancia)
// ---------------------------------------------------------------------------

/** Caja 1×1×1 — escala = [ancho, alto, profundidad] */
export const GEO_BOX = new THREE.BoxGeometry(1, 1, 1);
/** Cilindro radio 1, alto 1, 12 segmentos — escala = [radio, alto, radio] */
export const GEO_CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
/** Disco radio 1 (para conos de parlantes) — escala = [radio, radio, 1] */
export const GEO_CIRCLE = new THREE.CircleGeometry(1, 16);

// ---------------------------------------------------------------------------
// Materiales compartidos
// ---------------------------------------------------------------------------

/**
 * Cuerpos y utilería (negro mate / oscuro azulado / metales).
 * color blanco: el tinte real va en instanceColor. El emissive gris uniforme
 * reemplaza el viejo patrón "emissive = color" de cada mesh suelto (auto-luz
 * suave para que lo oscuro no desaparezca en el club).
 */
export const MAT_BODY = new THREE.MeshStandardMaterial({
  color: '#ffffff',
  emissive: '#16161d',
  emissiveIntensity: 0.8,
  metalness: 0.35,
  roughness: 0.5,
});

/**
 * Neón emisivo (rosa/cian/amarillo/verde y todo lo que brilla).
 * Basic + toneMapped=false: el instanceColor puede superar 1.0 (HDR) y el Bloom
 * lo levanta igual que los viejos meshStandardMaterial con emissiveIntensity 2-3.
 */
export const MAT_NEON = new THREE.MeshBasicMaterial({
  color: '#ffffff',
  toneMapped: false,
});

// ---------------------------------------------------------------------------
// Builder de InstancedMesh estático: matrices y colores se suben UNA vez
// ---------------------------------------------------------------------------

/** Descriptor de una pieza estática instanciada */
export interface StaticInst {
  /** posición absoluta */
  p: [number, number, number];
  /** escala (según la convención de la geometría unitaria) */
  s: [number, number, number];
  /** rotación euler opcional */
  r?: [number, number, number];
  /** color de la instancia */
  c: string;
  /** intensidad HDR (multiplica el color; >1 = brilla con Bloom). Default 1 */
  i?: number;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _sv = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * Crea un InstancedMesh estático: 1 draw call para N piezas.
 * Matrices e instanceColor se escriben una sola vez (equivalente a frames={1}).
 */
export function buildStaticInstances(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  items: readonly StaticInst[],
): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  for (let idx = 0; idx < items.length; idx++) {
    const it = items[idx];
    _v.set(it.p[0], it.p[1], it.p[2]);
    _sv.set(it.s[0], it.s[1], it.s[2]);
    if (it.r) {
      _e.set(it.r[0], it.r[1], it.r[2]);
      _q.setFromEuler(_e);
    } else {
      _q.identity();
    }
    _m.compose(_v, _q, _sv);
    mesh.setMatrixAt(idx, _m);
    _c.set(it.c).multiplyScalar(it.i ?? 1);
    mesh.setColorAt(idx, _c);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // Las instancias se reparten por todo el mapa: el culling por bounding de la
  // geometría unitaria las cortaría mal — la escena entera siempre está en cámara.
  mesh.frustumCulled = false;
  return mesh;
}

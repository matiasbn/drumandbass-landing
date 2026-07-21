// V2 Map Layout — shared spatial constants
export const MAP = {
  floorSize: 22, // 22 tiles de 2u = 44u totales (la superficie negra llega a ±22)
  tileSize: 2,
  djPosition: [0, 1.5, 0] as const,
  djPlatformRadius: 4,
  djPlatformHeight: 1.5,

  // Main stage: large elevated center area
  stageHalfSize: 8, // -8 to 8 in X and Z

  // El jugador puede caminar hasta el BORDE de la superficie negra (el piso
  // llega a ±22): antes se frenaba en ±18, muy adentro, y parecía un muro
  // invisible sobre las baldosas. El wireframe del fondo está a ±30, así que
  // sigue habiendo margen visual más allá del borde.
  bounds: {
    minX: -21.5,
    maxX: 21.5,
    minZ: -21.5,
    maxZ: 21.5,
  },

  moveSpeed: 0.14,
  jumpVelocity: 0.15,
  gravity: 0.006,

  // Max height difference player can walk up without jumping (stairs)
  maxStepHeight: 0.35,
};

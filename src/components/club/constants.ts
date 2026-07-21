// V2 Map Layout — shared spatial constants
export const MAP = {
  floorSize: 20, // 20 tiles of size 2 = 40 units total (mapa más grande)
  tileSize: 2,
  djPosition: [0, 1.5, 0] as const,
  djPlatformRadius: 4,
  djPlatformHeight: 1.5,

  // Main stage: large elevated center area
  stageHalfSize: 8, // -8 to 8 in X and Z

  bounds: {
    minX: -18,
    maxX: 18,
    minZ: -18,
    maxZ: 18,
  },

  moveSpeed: 0.14,
  jumpVelocity: 0.15,
  gravity: 0.006,

  // Max height difference player can walk up without jumping (stairs)
  maxStepHeight: 0.35,
};

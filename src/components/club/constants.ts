// V2 Map Layout — shared spatial constants
export const MAP = {
  floorSize: 16, // 16 tiles of size 2 = 32 units total
  tileSize: 2,
  djPosition: [0, 1.5, 0] as const,
  djPlatformRadius: 4,
  djPlatformHeight: 1.5,

  // Main stage: large elevated center area
  stageHalfSize: 8, // -8 to 8 in X and Z

  bounds: {
    minX: -14,
    maxX: 14,
    minZ: -14,
    maxZ: 14,
  },

  moveSpeed: 0.14,
  jumpVelocity: 0.15,
  gravity: 0.006,

  // Max height difference player can walk up without jumping (stairs)
  maxStepHeight: 0.35,
};

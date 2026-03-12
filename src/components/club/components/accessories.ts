// Accessory system for character customization
// Accessories render as extra geometry on top of the head
// They are independent of costumes — hidden when costume !== 'default'

import { PLAYER_COLOR } from './costumes';

export type AccessoryId = 'none' | 'beanie' | 'snapback' | 'headphones' | 'tophat' | 'crown';

export interface AccessoryPiece {
  type: 'box' | 'sphere' | 'cylinder';
  args: number[]; // geometry constructor args
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  color: string; // supports PLAYER_COLOR sentinel
}

export interface AccessoryDefinition {
  id: AccessoryId;
  label: string;
  emoji: string;
  pieces: AccessoryPiece[];
}

const ACCESSORIES: Record<AccessoryId, AccessoryDefinition> = {
  none: {
    id: 'none',
    label: 'Ninguno',
    emoji: '❌',
    pieces: [],
  },

  beanie: {
    id: 'beanie',
    label: 'Gorro',
    emoji: '🧶',
    pieces: [
      // Main dome (squashed sphere)
      { type: 'sphere', args: [0.18, 12, 8], position: [0, 0.22, 0], scale: [1, 0.6, 1], color: PLAYER_COLOR },
      // Ribbed brim (flat cylinder)
      { type: 'cylinder', args: [0.19, 0.19, 0.04, 16], position: [0, 0.12, 0], color: PLAYER_COLOR },
      // Pompom on top
      { type: 'sphere', args: [0.04, 6, 6], position: [0, 0.33, 0], color: '#ffffff' },
    ],
  },

  snapback: {
    id: 'snapback',
    label: 'Gorra',
    emoji: '🧢',
    pieces: [
      // Cap top (flat box)
      { type: 'box', args: [0.34, 0.06, 0.32], position: [0, 0.17, 0], color: PLAYER_COLOR },
      // Visor (box extending forward)
      { type: 'box', args: [0.28, 0.02, 0.16], position: [0, 0.14, 0.2], rotation: [-0.15, 0, 0], color: PLAYER_COLOR },
      // Cap body (slightly rounded top)
      { type: 'box', args: [0.33, 0.08, 0.31], position: [0, 0.21, 0], color: PLAYER_COLOR },
    ],
  },

  headphones: {
    id: 'headphones',
    label: 'Audífonos',
    emoji: '🎧',
    pieces: [
      // Headband arc (flat box across top)
      { type: 'box', args: [0.36, 0.03, 0.06], position: [0, 0.24, 0], color: '#333333' },
      // Left ear cup
      { type: 'sphere', args: [0.08, 8, 8], position: [-0.2, 0.05, 0], color: '#222222' },
      // Right ear cup
      { type: 'sphere', args: [0.08, 8, 8], position: [0.2, 0.05, 0], color: '#222222' },
      // Left ear cushion ring
      { type: 'cylinder', args: [0.07, 0.07, 0.04, 12], position: [-0.2, 0.05, 0], rotation: [0, 0, Math.PI / 2], color: '#444444' },
      // Right ear cushion ring
      { type: 'cylinder', args: [0.07, 0.07, 0.04, 12], position: [0.2, 0.05, 0], rotation: [0, 0, Math.PI / 2], color: '#444444' },
      // Left headband arm
      { type: 'box', args: [0.03, 0.16, 0.04], position: [-0.18, 0.15, 0], color: '#333333' },
      // Right headband arm
      { type: 'box', args: [0.03, 0.16, 0.04], position: [0.18, 0.15, 0], color: '#333333' },
    ],
  },

  tophat: {
    id: 'tophat',
    label: 'Sombrero',
    emoji: '🎩',
    pieces: [
      // Tall crown (cylinder)
      { type: 'cylinder', args: [0.12, 0.12, 0.3, 12], position: [0, 0.32, 0], color: '#1a1a1a' },
      // Brim (flat wide cylinder)
      { type: 'cylinder', args: [0.24, 0.24, 0.02, 16], position: [0, 0.16, 0], color: '#1a1a1a' },
      // Ribbon band
      { type: 'cylinder', args: [0.125, 0.125, 0.03, 12], position: [0, 0.2, 0], color: PLAYER_COLOR },
    ],
  },

  crown: {
    id: 'crown',
    label: 'Corona',
    emoji: '👑',
    pieces: [
      // Base band
      { type: 'box', args: [0.34, 0.08, 0.32], position: [0, 0.18, 0], color: '#FFD700' },
      // Front center point
      { type: 'box', args: [0.06, 0.1, 0.03], position: [0, 0.27, 0.14], color: '#FFD700' },
      // Front left point
      { type: 'box', args: [0.06, 0.08, 0.03], position: [-0.12, 0.25, 0.14], color: '#FFD700' },
      // Front right point
      { type: 'box', args: [0.06, 0.08, 0.03], position: [0.12, 0.25, 0.14], color: '#FFD700' },
      // Back center point
      { type: 'box', args: [0.06, 0.1, 0.03], position: [0, 0.27, -0.14], color: '#FFD700' },
      // Back left point
      { type: 'box', args: [0.06, 0.08, 0.03], position: [-0.12, 0.25, -0.14], color: '#FFD700' },
      // Back right point
      { type: 'box', args: [0.06, 0.08, 0.03], position: [0.12, 0.25, -0.14], color: '#FFD700' },
      // Center gem
      { type: 'sphere', args: [0.03, 6, 6], position: [0, 0.2, 0.165], color: '#ff0055' },
    ],
  },
};

export const ACCESSORY_IDS: AccessoryId[] = ['none', 'beanie', 'snapback', 'headphones', 'tophat', 'crown'];

export function getAccessory(id: AccessoryId | string | undefined): AccessoryDefinition {
  return ACCESSORIES[(id as AccessoryId)] || ACCESSORIES.none;
}

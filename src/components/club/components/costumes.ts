// Costume system for character customization
// PLAYER_COLOR is a sentinel value — when resolved, it uses the player's chosen color

export const PLAYER_COLOR = '__PLAYER_COLOR__';

export type CostumeId = 'default' | 'mono' | 'platano' | 'creeper' | 'rana';

export interface CostumeExtra {
  type: 'box' | 'sphere';
  args: [number, number, number] | [number, number, number]; // width/height/depth or radius/wSeg/hSeg
  position: [number, number, number];
  color: string;
  attachTo: 'root' | 'head';
}

export interface CostumeDefinition {
  id: CostumeId;
  label: string;
  emoji: string;
  colors: {
    head: string;
    body: string;
    arms: string;
    legs: string;
  };
  bodySize?: [number, number, number]; // override default body box size
  hideArms?: boolean;
  customFaceSvg?: (width: number, height: number) => string; // custom face SVG, null = use player's face
  extras: CostumeExtra[];
}

const COSTUMES: Record<CostumeId, CostumeDefinition> = {
  default: {
    id: 'default',
    label: 'Normal',
    emoji: '🧑',
    colors: {
      head: '#e0c4a8',
      body: PLAYER_COLOR,
      arms: PLAYER_COLOR,
      legs: '#222222',
    },
    extras: [],
  },

  mono: {
    id: 'mono',
    label: 'Mono',
    emoji: '🐒',
    colors: {
      head: '#D4A34A',
      body: '#C08B30',
      arms: '#D4A34A',
      legs: '#A07828',
    },
    customFaceSvg: (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none">
      <!-- Eyes -->
      <ellipse cx="${w * 0.35}" cy="${h * 0.38}" rx="${w * 0.09}" ry="${h * 0.1}" fill="#1a1a1a"/>
      <ellipse cx="${w * 0.65}" cy="${h * 0.38}" rx="${w * 0.09}" ry="${h * 0.1}" fill="#1a1a1a"/>
      <ellipse cx="${w * 0.35}" cy="${h * 0.36}" rx="${w * 0.04}" ry="${h * 0.04}" fill="white"/>
      <ellipse cx="${w * 0.65}" cy="${h * 0.36}" rx="${w * 0.04}" ry="${h * 0.04}" fill="white"/>
      <!-- Nose -->
      <ellipse cx="${w * 0.5}" cy="${h * 0.55}" rx="${w * 0.06}" ry="${h * 0.05}" fill="#8B6830"/>
      <!-- Mouth -->
      <path d="M${w * 0.38} ${h * 0.68} Q${w * 0.5} ${h * 0.78} ${w * 0.62} ${h * 0.68}" stroke="#1a1a1a" stroke-width="2" fill="none"/>
    </svg>`,
    extras: [
      // Left ear
      { type: 'sphere', args: [0.12, 8, 8], position: [-0.22, 0.05, 0], color: '#E8C478', attachTo: 'head' },
      // Right ear
      { type: 'sphere', args: [0.12, 8, 8], position: [0.22, 0.05, 0], color: '#E8C478', attachTo: 'head' },
      // Belly patch
      { type: 'box', args: [0.3, 0.4, 0.02], position: [0, 1, 0.15], color: '#E8C478', attachTo: 'root' },
    ],
  },

  platano: {
    id: 'platano',
    label: 'Plátano',
    emoji: '🍌',
    colors: {
      head: '#FFE940',
      body: '#FFE135',
      arms: '#FFE135',
      legs: '#B8960E',
    },
    bodySize: [0.3, 1.0, 0.25],
    hideArms: true,
    customFaceSvg: (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none">
      <!-- Simple dot eyes -->
      <circle cx="${w * 0.35}" cy="${h * 0.42}" r="${w * 0.06}" fill="#1a1a1a"/>
      <circle cx="${w * 0.65}" cy="${h * 0.42}" r="${w * 0.06}" fill="#1a1a1a"/>
      <!-- Simple line mouth -->
      <line x1="${w * 0.38}" y1="${h * 0.65}" x2="${w * 0.62}" y2="${h * 0.65}" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
    extras: [
      // Stem on top of head
      { type: 'box', args: [0.06, 0.18, 0.06], position: [0.02, 0.28, 0], color: '#5A8C2A', attachTo: 'head' },
      // Brown tip at bottom of body
      { type: 'box', args: [0.22, 0.08, 0.2], position: [0, 0.5, 0], color: '#A08520', attachTo: 'root' },
      // Banana stripe left
      { type: 'box', args: [0.01, 0.85, 0.01], position: [-0.12, 1, 0.13], color: '#D4C020', attachTo: 'root' },
      // Banana stripe right
      { type: 'box', args: [0.01, 0.85, 0.01], position: [0.12, 1, 0.13], color: '#D4C020', attachTo: 'root' },
    ],
  },

  creeper: {
    id: 'creeper',
    label: 'Creeper',
    emoji: '💥',
    colors: {
      head: '#6BCB77',
      body: '#55B565',
      arms: '#55B565',
      legs: '#48A058',
    },
    customFaceSvg: (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none">
      <!-- Square eyes -->
      <rect x="${w * 0.18}" y="${h * 0.22}" width="${w * 0.22}" height="${h * 0.2}" fill="#1a1a1a"/>
      <rect x="${w * 0.6}" y="${h * 0.22}" width="${w * 0.22}" height="${h * 0.2}" fill="#1a1a1a"/>
      <!-- Mouth -->
      <rect x="${w * 0.35}" y="${h * 0.5}" width="${w * 0.3}" height="${h * 0.12}" fill="#1a1a1a"/>
      <rect x="${w * 0.28}" y="${h * 0.62}" width="${w * 0.18}" height="${h * 0.16}" fill="#1a1a1a"/>
      <rect x="${w * 0.54}" y="${h * 0.62}" width="${w * 0.18}" height="${h * 0.16}" fill="#1a1a1a"/>
    </svg>`,
    extras: [],
  },

  rana: {
    id: 'rana',
    label: 'Rana',
    emoji: '🐸',
    colors: {
      head: '#4ADE80',
      body: '#34D472',
      arms: '#4ADE80',
      legs: '#2EBD60',
    },
    customFaceSvg: (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none">
      <!-- Wide mouth -->
      <path d="M${w * 0.2} ${h * 0.6} Q${w * 0.5} ${h * 0.85} ${w * 0.8} ${h * 0.6}" stroke="#1a1a1a" stroke-width="2.5" fill="none"/>
    </svg>`,
    extras: [
      // Left eye bulge (on top of head)
      { type: 'sphere', args: [0.1, 8, 8], position: [-0.1, 0.24, 0.05], color: 'white', attachTo: 'head' },
      // Right eye bulge
      { type: 'sphere', args: [0.1, 8, 8], position: [0.1, 0.24, 0.05], color: 'white', attachTo: 'head' },
      // Left pupil
      { type: 'sphere', args: [0.045, 6, 6], position: [-0.1, 0.26, 0.13], color: '#1a1a1a', attachTo: 'head' },
      // Right pupil
      { type: 'sphere', args: [0.045, 6, 6], position: [0.1, 0.26, 0.13], color: '#1a1a1a', attachTo: 'head' },
    ],
  },
};

export const COSTUME_IDS: CostumeId[] = ['default', 'mono', 'platano', 'creeper', 'rana'];

export function getCostume(id: CostumeId | string | undefined): CostumeDefinition {
  return COSTUMES[(id as CostumeId)] || COSTUMES.default;
}

/** Resolve a color value — replace PLAYER_COLOR sentinel with actual player color */
export function resolveColor(value: string, playerColor: string): string {
  return value === PLAYER_COLOR ? playerColor : value;
}

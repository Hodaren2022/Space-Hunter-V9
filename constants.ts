
import { EnemyDef, Weapon, Player, DevSettings } from './types';

export const WORLD_WIDTH = 3000;
export const WORLD_HEIGHT = 3000;

// Cyberpunk Color Palette
const C_NEON_RED = '#ff0055';
const C_NEON_GREEN = '#39ff14';
const C_NEON_BLUE = '#00f3ff'; // Cyan
const C_NEON_PURPLE = '#bc13fe';
const C_NEON_YELLOW = '#ffee00';
const C_WHITE = '#ffffff';
const C_DARK_METAL = '#2a2a2a';

// Reduced HP multipliers by 50% as requested
export const ENEMY_TYPES: Record<string, EnemyDef> = {
  basic: { 
    color: C_NEON_RED, radius: 14, hpMult: 0.5, speedMult: 1.0, exp: 2, minTime: 0, damage: 0.2, swarmCount: 1, shape: 'circle' 
  },
  tank: { 
    color: '#ff3300', radius: 22, hpMult: 2.0, speedMult: 0.6, exp: 10, minTime: 15, damage: 0.3, swarmCount: 1, shape: 'square' 
  },
  speedster: { 
    color: C_NEON_YELLOW, radius: 10, hpMult: 0.4, speedMult: 1.6, exp: 3, minTime: 30, damage: 0.2, swarmCount: 1, shape: 'triangle' 
  },
  swarmer: { 
    color: C_NEON_PURPLE, radius: 8, hpMult: 0.25, speedMult: 1.0, exp: 1, minTime: 60, damage: 0.1, swarmCount: 3, shape: 'circle' 
  },
  behemoth: { 
    color: '#0066ff', radius: 30, hpMult: 4.0, speedMult: 0.4, exp: 20, minTime: 90, damage: 0.5, swarmCount: 1, shape: 'hexagon' 
  },
  flicker: { 
    color: C_WHITE, radius: 14, hpMult: 0.75, speedMult: 1.2, exp: 5, minTime: 120, damage: 0.25, swarmCount: 1, shape: 'diamond',
    teleportCooldown: 180, invulnTime: 30, teleportRange: 300 
  },
  spitter: { 
    color: C_NEON_GREEN, radius: 16, hpMult: 1.0, speedMult: 0.8, exp: 8, minTime: 180, damage: 0.35, swarmCount: 1, shape: 'rhombus',
    attackCooldown: 180, projectileDamage: 10, projectileSpeed: 6, attackRange: 400 
  },
  ghost: { 
    color: '#888888', radius: 25, hpMult: 3.0, speedMult: 1.1, exp: 15, minTime: 240, damage: 0.4, swarmCount: 1, shape: 'pentagon' 
  },
};

export const DEFAULT_DEV_SETTINGS: DevSettings = { 
  dmg: 1.0, spd: 1.0, frq: 1.0, hp: 1.0, mov: 1.0, exp: 1.0 
};

export const INITIAL_PLAYER: Player = {
  x: WORLD_WIDTH / 2,
  y: WORLD_HEIGHT / 2,
  radius: 15,
  color: C_NEON_BLUE, // Cyan Player
  baseSpeed: 4,
  baseMaxHp: 100,
  maxHp: 100,
  hp: 100,
  level: 1,
  exp: 0,
  expToNext: 20,
  facingAngle: 0,
  weapons: [
    { id: 'missile', name: 'missile', type: 'projectile', baseDamage: 20, baseCooldown: 45, timer: 0, range: 350, baseSpeed: 8, count: 1 }
  ],
  stats: {
    area: 1, speed: 1, cdr: 1, magnet: 200, flameDmg: 0, hpRegen: 0, wingmanCount: 0
  }
};

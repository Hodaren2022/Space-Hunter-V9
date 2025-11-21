
export interface Point {
  x: number;
  y: number;
}

export interface Stats {
  area: number;
  speed: number;
  cdr: number;
  magnet: number;
  flameDmg: number;
  hpRegen: number;
  wingmanCount: number;
  flameRangeBonus?: number;
}

export interface Weapon {
  id: string;
  name: string;
  type?: string;
  baseDamage: number;
  baseCooldown: number;
  timer: number;
  range: number;
  baseSpeed: number;
  count: number;
}

export interface Player extends Point {
  radius: number;
  color: string;
  baseSpeed: number;
  baseMaxHp: number;
  maxHp: number;
  hp: number;
  level: number;
  exp: number;
  expToNext: number;
  facingAngle: number;
  weapons: Weapon[];
  stats: Stats;
}

export interface EnemyDef {
  color: string;
  radius: number;
  hpMult: number;
  speedMult: number;
  exp: number;
  minTime: number;
  damage: number;
  swarmCount: number;
  shape: 'circle' | 'square' | 'triangle' | 'hexagon' | 'diamond' | 'rhombus' | 'pentagon';
  teleportCooldown?: number;
  invulnTime?: number;
  teleportRange?: number;
  attackCooldown?: number;
  projectileDamage?: number;
  projectileSpeed?: number;
  attackRange?: number;
}

export interface Enemy extends Point {
  radius: number;
  color: string;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  exp: number;
  type: string;
  // AI States
  attackTimer: number;
  isAttacking: boolean;
  teleportTimer: number;
  isInvulnerable: boolean;
  invulnTimeRemaining: number;
}

export interface Projectile extends Point {
  vx: number;
  vy: number;
  damage: number;
  life: number;
  radius: number;
  color: string;
}

export interface Particle extends Point {
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface Gem extends Point {
  val: number;
  color?: string;
}

export interface DamageNumber extends Point {
  val: number;
  color: string;
  life: number;
}

export interface Lightning {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  color: string;
}

export interface Mine extends Point {
  damage: number;
  life: number;
  delay: number;
  speed: number;
  radius: number;
  color: string;
}

export interface GameState {
  isRunning: boolean;
  isPaused: boolean;
  frameCount: number;
  timeElapsed: number;
  player: Player;
  wingmen: Point[]; // Wingman positions
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: Projectile[];
  particles: Particle[];
  gems: Gem[];
  damageNumbers: DamageNumber[];
  lightnings: Lightning[];
  mines: Mine[];
  devSettings: DevSettings;
  camX: number;
  camY: number;
}

export interface DevSettings {
  dmg: number;
  spd: number;
  frq: number;
  hp: number;
  mov: number;
  exp: number;
}


import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  GameState, Player, Enemy, Projectile, Particle, Gem, DamageNumber, Lightning, Mine, Point, DevSettings
} from '../types';
import { ENEMY_TYPES, INITIAL_PLAYER, WORLD_HEIGHT, WORLD_WIDTH, DEFAULT_DEV_SETTINGS } from '../constants';
import { audioController } from '../utils/audio';
import { t, Lang } from '../utils/i18n';

interface GameCanvasProps {}

export const GameCanvas: React.FC<GameCanvasProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [uiState, setUiState] = useState({
    hp: 100, maxHp: 100, level: 1, exp: 0, expToNext: 20, time: "00:00", isGameOver: false, isLevelUp: false, isRunning: false
  });
  const [showDev, setShowDev] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [bgmVolume, setBgmVolume] = useState(0.2);
  const [sfxVolume, setSfxVolume] = useState(0.2);
  const [lang, setLang] = useState<Lang>('zh');
  const [devSettings, setDevSettings] = useState<DevSettings>(DEFAULT_DEV_SETTINGS);
  const [upgradeOptions, setUpgradeOptions] = useState<any[]>([]);

  // Mutable Game State
  const gameState = useRef<GameState & { glitchOffset: number }>({
    isRunning: false,
    isPaused: false,
    frameCount: 0,
    timeElapsed: 0,
    player: JSON.parse(JSON.stringify(INITIAL_PLAYER)),
    wingmen: [],
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    particles: [],
    gems: [],
    damageNumbers: [],
    lightnings: [],
    mines: [],
    devSettings: DEFAULT_DEV_SETTINGS,
    camX: 0,
    camY: 0,
    glitchOffset: 0 // For screen shake/glitch effects
  });

  const keys = useRef<Record<string, boolean>>({});
  const touchRef = useRef<{ start: Point | null, current: Point | null }>({ start: null, current: null });
  const requestRef = useRef<number>(0);
  const timerRef = useRef<number>(0);

  // --- Input Handlers ---
  useEffect(() => {
    // Keyboard
    const handleKeyDown = (e: KeyboardEvent) => { keys.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keys.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Touch (Native Listeners for passive: false support)
    const container = containerRef.current;
    
    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      // Allow interactions with UI buttons/inputs and upgrade options
      if (target.tagName === 'BUTTON' || 
          target.closest('button') || 
          target.tagName === 'INPUT' ||
          target.closest('.upgrade-option') ||
          target.closest('[data-upgrade]')) {
        return;
      }
      
      // Prevent default browser scroll/zoom behavior for game control
      if (e.cancelable) e.preventDefault();
      
      if (e.touches.length > 0) {
        const t = e.touches[0];
        touchRef.current.start = { x: t.clientX, y: t.clientY };
        touchRef.current.current = { x: t.clientX, y: t.clientY };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (touchRef.current.start && e.touches.length > 0) {
        if (e.cancelable) e.preventDefault();
        const t = e.touches[0];
        touchRef.current.current = { x: t.clientX, y: t.clientY };
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      touchRef.current.start = null;
      touchRef.current.current = null;
    };

    if (container) {
        container.addEventListener('touchstart', onTouchStart, { passive: false });
        container.addEventListener('touchmove', onTouchMove, { passive: false });
        container.addEventListener('touchend', onTouchEnd);
        container.addEventListener('touchcancel', onTouchEnd);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      audioController.stopBgm();
      
      if (container) {
        container.removeEventListener('touchstart', onTouchStart);
        container.removeEventListener('touchmove', onTouchMove);
        container.removeEventListener('touchend', onTouchEnd);
        container.removeEventListener('touchcancel', onTouchEnd);
      }
    };
  }, []);

  const toggleMute = () => {
    const muted = audioController.toggleMute();
    setIsMuted(muted);
  };

  const handleBgmChange = (val: number) => {
    setBgmVolume(val);
    audioController.setBgmVolume(val);
  };

  const handleSfxChange = (val: number) => {
    setSfxVolume(val);
    audioController.setSfxVolume(val);
  };

  const toggleLang = () => {
    setLang(prev => prev === 'zh' ? 'en' : 'zh');
  };

  // --- Game Logic Helpers ---
  const createDamageNumber = (x: number, y: number, val: number, color: string) => {
    gameState.current.damageNumbers.push({ x, y, val: Math.floor(val), color, life: 40 });
  };

  const createParticles = (x: number, y: number, color: string, count = 5) => {
    for (let i = 0; i < count; i++) {
      gameState.current.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1.0,
        color,
        size: Math.random() * 3 + 1
      });
    }
  };

  const createMuzzleFlash = (x: number, y: number, angle: number, color: string) => {
      // Directional burst
      for(let i=0; i<8; i++) {
          const speed = Math.random() * 3 + 2;
          const spread = (Math.random() - 0.5) * 0.5;
          gameState.current.particles.push({
              x, y,
              vx: Math.cos(angle + spread) * speed,
              vy: Math.sin(angle + spread) * speed,
              life: 0.4,
              color,
              size: Math.random() * 3
          });
      }
  };

  const killEnemy = (e: Enemy, index: number) => {
    gameState.current.enemies.splice(index, 1);
    gameState.current.gems.push({ x: e.x, y: e.y, val: e.exp });
    createParticles(e.x, e.y, e.color, 20);
    // Minor screen glitch on kill
    gameState.current.glitchOffset = 2;
  };

  const getNearestEnemy = (x: number, y: number, range: number) => {
    let nearest = null;
    let minDistance = Infinity;
    for (const e of gameState.current.enemies) {
      const dist = Math.hypot(e.x - x, e.y - y);
      if (dist < minDistance && dist <= range && !e.isInvulnerable) {
        minDistance = dist;
        nearest = e;
      }
    }
    return nearest;
  };

  const fireProjectile = (x: number, y: number, target: Enemy | null, weapon: any, damageMult: number, fixedAngle: number | null = null) => {
    let angle = fixedAngle;
    if (target && fixedAngle === null) {
      angle = Math.atan2(target.y - y, target.x - x);
    } else if (fixedAngle === null) {
      angle = Math.random() * Math.PI * 2;
    }

    if (angle === null) angle = 0;

    const settings = gameState.current.devSettings;
    const player = gameState.current.player;
    const speed = weapon.baseSpeed * player.stats.speed * settings.spd;
    
    let baseRadius = 6;
    if (weapon.id === 'shotgun') baseRadius = 4;
    if (weapon.id === 'crossbow') baseRadius = 4; 
    if (weapon.id === 'wand') baseRadius = 8;
    if (weapon.id === 'missile') baseRadius = 7;

    // Explicitly use player stats.area for size, this should only change if 'Giant Size' is taken
    const radius = baseRadius * (player.stats.area || 1.0);
    const dmg = weapon.baseDamage * settings.dmg * damageMult * (player.weapons.some(wp => wp.id === 'buff_dmg') ? 1.1 : 1);

    gameState.current.projectiles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      damage: dmg,
      life: weapon.range,
      radius,
      color: weapon.id, 
    });
    
    // Visuals
    let flashColor = '#fff';
    if(weapon.id === 'missile') flashColor = '#00f3ff';
    if(weapon.id === 'shotgun') flashColor = '#ffee00';
    if(weapon.id === 'wand') flashColor = '#bc13fe';
    createMuzzleFlash(x + Math.cos(angle)*15, y + Math.sin(angle)*15, angle, flashColor);

    if (damageMult === 1.0) { // Only play sound for main player
        if (weapon.id === 'shotgun' && fixedAngle !== null) {
          // Throttle
        } else {
          audioController.playWeaponAttack(weapon.id);
        }
    }
  };

  // --- Core Update Loop ---
  const update = (canvasWidth: number, canvasHeight: number) => {
    const state = gameState.current;
    if (state.isPaused || !state.isRunning) return;

    const settings = state.devSettings;
    const player = state.player;

    // Glitch decay
    if (Math.abs(state.glitchOffset) > 0.1) state.glitchOffset *= 0.9;
    else state.glitchOffset = 0;

    // 0. Regen
    player.hp = Math.min(player.maxHp, player.hp + player.stats.hpRegen);

    // 1. Camera - Center on player
    state.camX = player.x - canvasWidth / 2 + (Math.random() - 0.5) * state.glitchOffset;
    state.camY = player.y - canvasHeight / 2 + (Math.random() - 0.5) * state.glitchOffset;
    state.camX = Math.max(0, Math.min(WORLD_WIDTH - canvasWidth, state.camX));
    state.camY = Math.max(0, Math.min(WORLD_HEIGHT - canvasHeight, state.camY));

    // 2. Movement
    let dx = 0, dy = 0;
    let moveMagnitude = 0;

    if (keys.current['w'] || keys.current['ArrowUp']) dy = -1;
    if (keys.current['s'] || keys.current['ArrowDown']) dy = 1;
    if (keys.current['a'] || keys.current['ArrowLeft']) dx = -1;
    if (keys.current['d'] || keys.current['ArrowRight']) dx = 1;

    if (dx !== 0 || dy !== 0) {
        const dist = Math.hypot(dx, dy);
        dx /= dist; dy /= dist;
        moveMagnitude = 1.0;
    }

    if (touchRef.current.start && touchRef.current.current) {
      const tdx = touchRef.current.current.x - touchRef.current.start.x;
      const tdy = touchRef.current.current.y - touchRef.current.start.y;
      const dist = Math.hypot(tdx, tdy);
      const maxJoystickRadius = 50;
      if (dist > 0) {
        dx = tdx / dist;
        dy = tdy / dist;
        moveMagnitude = Math.min(dist / maxJoystickRadius, 1.0);
      }
    }

    if (moveMagnitude > 0) {
      const speed = player.baseSpeed * player.stats.speed * settings.mov * moveMagnitude;
      player.x += dx * speed;
      player.y += dy * speed;
      player.facingAngle = Math.atan2(dy, dx);
    }

    player.x = Math.max(player.radius, Math.min(WORLD_WIDTH - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(WORLD_HEIGHT - player.radius, player.y));

    // Wingman Movement - FIXED RELATIVE POSITION (No Orbit)
    const targetWingmenCount = player.stats.wingmanCount || 0;
    while(state.wingmen.length < targetWingmenCount) {
        state.wingmen.push({x: player.x, y: player.y});
    }
    
    const formationRadius = 70;
    state.wingmen.forEach((w, i) => {
        // Calculate Fixed Position in Formation
        // Evenly distributed circle, but DOES NOT rotate over time
        const angle = (Math.PI * 2 / state.wingmen.length) * i - (Math.PI / 2); // Start from top
        
        const tx = player.x + Math.cos(angle) * formationRadius;
        const ty = player.y + Math.sin(angle) * formationRadius;

        // Smooth Lerp to target position
        w.x += (tx - w.x) * 0.15;
        w.y += (ty - w.y) * 0.15;
    });


    // 3. Weapons & Wingman Attack Replication
    player.weapons.forEach(w => {
      w.timer++;
      const actualCooldown = w.baseCooldown * player.stats.cdr / settings.frq;

      if (w.timer >= actualCooldown) {
        w.timer = 0;

        // Define all shooters: Player (100% dmg) + Wingmen (33% dmg)
        const shooters = [
            { x: player.x, y: player.y, dmgMult: 1.0, isPlayer: true },
            ...state.wingmen.map(wm => ({ x: wm.x, y: wm.y, dmgMult: 0.333, isPlayer: false }))
        ];

        shooters.forEach(shooter => {
            // For each shooter, find their own nearest target
            let nearest = getNearestEnemy(shooter.x, shooter.y, w.range * player.stats.area);
            const needTarget = ['missile', 'shotgun', 'crossbow', 'wand', 'thunder'].includes(w.id);

            if (!needTarget || nearest) {
                const dmgFactor = shooter.dmgMult * settings.dmg * (player.weapons.some(wp => wp.id === 'buff_dmg') ? 1.1 : 1);

                if (w.id === 'missile') {
                    for (let i = 0; i < w.count; i++) {
                        setTimeout(() => { if (!state.isPaused) fireProjectile(shooter.x, shooter.y, nearest, w, shooter.dmgMult); }, i * (100 / settings.frq));
                    }
                } else if (w.id === 'wand' && nearest) {
                    for (let i = 0; i < w.count; i++) {
                        setTimeout(() => { if (!state.isPaused) fireProjectile(shooter.x, shooter.y, nearest, w, shooter.dmgMult); }, i * 150);
                    }
                } else if (w.id === 'shotgun' && nearest) {
                    if(shooter.isPlayer) audioController.playWeaponAttack('shotgun');
                    const baseAngle = Math.atan2(nearest.y - shooter.y, nearest.x - shooter.x);
                    for (let i = -1; i <= 1; i++) {
                        fireProjectile(shooter.x, shooter.y, null, w, shooter.dmgMult, baseAngle + (i * 0.25));
                    }
                } else if (w.id === 'crossbow' && nearest) {
                    fireProjectile(shooter.x, shooter.y, nearest, w, shooter.dmgMult);
                } else if (w.id === 'lightning') {
                    const targets = state.enemies.filter(e => !e.isInvulnerable && Math.hypot(e.x - shooter.x, e.y - shooter.y) < w.range * player.stats.area);
                    if (targets.length > 0) {
                        if(shooter.isPlayer) audioController.playWeaponAttack('lightning');
                        const target = targets[Math.floor(Math.random() * targets.length)];
                        const finalDamage = w.baseDamage * dmgFactor;
                        target.hp -= finalDamage;
                        createDamageNumber(target.x, target.y, finalDamage, '#00ffff');
                        createParticles(target.x, target.y, '#00ffff', 10);
                        state.lightnings.push({ 
                            x1: target.x + (Math.random()-0.5)*50, y1: target.y - 400,
                            x2: target.x, y2: target.y, 
                            life: 10, color: '#00ffff' 
                        });
                        if (target.hp <= 0) killEnemy(target, state.enemies.indexOf(target));
                    }
                } else if (w.id === 'thunder' && nearest) {
                    if(shooter.isPlayer) audioController.playWeaponAttack('lightning');
                    const maxChains = w.count; 
                    let currentTarget: Enemy | null = nearest;
                    let chainCount = 0;
                    const hitList: Enemy[] = [];
                    const dmg = w.baseDamage * dmgFactor;

                    while (currentTarget && chainCount < maxChains) {
                        const prevPos: {x: number, y: number} = chainCount === 0 ? shooter : hitList[chainCount - 1];
                        state.lightnings.push({
                            x1: prevPos.x, y1: prevPos.y,
                            x2: currentTarget.x, y2: currentTarget.y,
                            life: 15, color: '#ffee00'
                        });

                        hitList.push(currentTarget);
                        currentTarget.hp -= dmg;
                        createDamageNumber(currentTarget.x, currentTarget.y, dmg, '#ffee00');
                        createParticles(currentTarget.x, currentTarget.y, '#ffee00', 5);
                        
                        chainCount++;
                        let nextNearest = null;
                        let minD = Infinity;
                        for (const e of state.enemies) {
                            if (!hitList.includes(e) && !e.isInvulnerable) {
                            const d = Math.hypot(e.x - currentTarget.x, e.y - currentTarget.y);
                            if (d < 300 && d < minD) { minD = d; nextNearest = e; }
                            }
                        }
                        currentTarget = nextNearest;
                    }
                    hitList.forEach(e => { if (e.hp <= 0 && state.enemies.includes(e)) killEnemy(e, state.enemies.indexOf(e)); });
                } else if (w.id === 'mines') {
                    // Fixed: Removed setTimeout delay which caused stacking/overlapping deployments
                    // Deploys instantly in a small scatter pattern
                    if(shooter.isPlayer) audioController.playWeaponAttack('mines');
                    for (let i = 0; i < w.count; i++) {
                        const mineRadius = 10 * (player.stats.area || 1);
                        state.mines.push({
                            x: shooter.x + (Math.random() - 0.5) * 40,
                            y: shooter.y + (Math.random() - 0.5) * 40,
                            damage: (w.baseDamage * 2) * dmgFactor,
                            life: 300, delay: 60, speed: 0, 
                            radius: mineRadius, color: '#ff0055'
                        });
                    }
                }
            }
        });
      }

      // Continuous Effects (Orbit/Flame)
      // Orbit
      if (w.id === 'orbit') {
         const orbitSpeed = 0.05 * settings.spd;
         const orbitDist = 80 * player.stats.area;
         const orbRadius = 10 * (player.stats.area || 1);
         
         const emitters = [
             {x: player.x, y: player.y, dmgMult: 1.0, isPlayer: true}, 
             ...state.wingmen.map(wm => ({x: wm.x, y: wm.y, dmgMult: 0.333, isPlayer: false}))
         ];

         emitters.forEach(emitter => {
            for (let i = 0; i < w.count; i++) {
                const angle = (state.frameCount * orbitSpeed) + (i * (Math.PI * 2 / w.count));
                const ox = emitter.x + Math.cos(angle) * orbitDist;
                const oy = emitter.y + Math.sin(angle) * orbitDist;
                
                state.enemies.forEach(e => {
                    if (!e.isInvulnerable && Math.hypot(e.x - ox, e.y - oy) < e.radius + orbRadius) {
                    if (state.frameCount % Math.max(1, Math.floor(10 / settings.frq)) === 0) {
                        const dmg = w.baseDamage * settings.dmg * emitter.dmgMult;
                        e.hp -= dmg;
                        createDamageNumber(e.x, e.y, dmg, '#bc13fe');
                        createParticles(e.x, e.y, '#bc13fe', 3);
                        if (emitter.isPlayer && state.frameCount % 4 === 0) audioController.playWeaponAttack('orbit');
                        if (e.hp <= 0) killEnemy(e, state.enemies.indexOf(e));
                    }
                    }
                });
            }
         });
      }
    });

    // 4. Flame Aura (Plasma)
    if (player.stats.flameDmg > 0) {
      // Use flame range independently of global area if you want, or keep global area.
      // The fix: flame upgrade logic below no longer buffs global area, but we respect area here.
      const flameRange = (60 * player.stats.area) + (player.stats['flameRangeBonus'] || 0);
      const emitters = [
          {x: player.x, y: player.y, dmgMult: 1.0}, 
          ...state.wingmen.map(wm => ({x: wm.x, y: wm.y, dmgMult: 0.333}))
      ];

      emitters.forEach(emitter => {
          state.enemies.forEach(e => {
            if (!e.isInvulnerable && Math.hypot(emitter.x - e.x, emitter.y - e.y) < e.radius + flameRange) {
              if (state.frameCount % 15 === 0) {
                const dmg = player.stats.flameDmg * settings.dmg * emitter.dmgMult;
                e.hp -= dmg;
                createDamageNumber(e.x, e.y, dmg, '#ff5500');
                if (emitter.dmgMult === 1 && state.frameCount % 30 === 0) audioController.playWeaponAttack('flame');
                if (e.hp <= 0) killEnemy(e, state.enemies.indexOf(e));
              }
            }
          });
      });
    }

    // 5. Projectiles Update
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const p = state.projectiles[i];
      if (p.color === 'wand') {
         const nearest = getNearestEnemy(p.x, p.y, 300 * player.stats.area);
         if (nearest) {
           const targetAngle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
           const currentAngle = Math.atan2(p.vy, p.vx);
           let diff = targetAngle - currentAngle;
           while (diff < -Math.PI) diff += Math.PI * 2;
           while (diff > Math.PI) diff -= Math.PI * 2;
           const turnRate = 0.15; 
           const newAngle = currentAngle + Math.max(-turnRate, Math.min(turnRate, diff));
           const speed = Math.hypot(p.vx, p.vy);
           p.vx = Math.cos(newAngle) * speed;
           p.vy = Math.sin(newAngle) * speed;
         }
      }
      
      // Add projectile trail particles
      if (state.frameCount % 3 === 0) {
         if (p.color === 'missile') {
             createParticles(p.x, p.y, '#00f3ff', 1);
         } else if (p.color === 'crossbow') {
             // Subtle trail
         }
      }

      p.x += p.vx; p.y += p.vy; p.life--;
      let hit = false;
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];
        if (!e.isInvulnerable && Math.hypot(p.x - e.x, p.y - e.y) < e.radius + p.radius) {
          e.hp -= p.damage;
          createDamageNumber(e.x, e.y, p.damage, '#fff');
          let partColor = '#00f3ff';
          if(p.color === 'shotgun') partColor = '#ffee00';
          if(p.color === 'wand') partColor = '#bc13fe';
          createParticles(p.x, p.y, partColor, 5);
          audioController.playEnemyHit(e.type);
          hit = true;
          if (e.hp <= 0) killEnemy(e, j);
          break;
        }
      }
      if (hit || p.life <= 0) state.projectiles.splice(i, 1);
    }

    // 6. Enemy Projectiles
    for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = state.enemyProjectiles[i];
      p.x += p.vx; p.y += p.vy; p.life--;
      if (Math.hypot(p.x - player.x, p.y - player.y) < player.radius + p.radius) {
        player.hp -= p.damage;
        createParticles(p.x, p.y, p.color, 8);
        audioController.playEnemyHit('player');
        state.glitchOffset = 15; // Big glitch on hit
        state.enemyProjectiles.splice(i, 1);
        if (player.hp <= 0) endGame();
        continue;
      }
      if (p.life <= 0) state.enemyProjectiles.splice(i, 1);
    }

    // 7. Mines
    for (let i = state.mines.length - 1; i >= 0; i--) {
      const m = state.mines[i];
      m.life--;
      if (m.life <= 0) { state.mines.splice(i, 1); continue; }
      if (m.life < (300 - m.delay)) {
        const nearest = getNearestEnemy(m.x, m.y, 400 * player.stats.area);
        if (nearest) {
          const angle = Math.atan2(nearest.y - m.y, nearest.x - m.x);
          m.speed = Math.min(m.speed + 0.8, 12 * settings.spd);
          m.x += Math.cos(angle) * m.speed;
          m.y += Math.sin(angle) * m.speed;
          if (state.frameCount % 3 === 0) {
             state.particles.push({
                x: m.x, y: m.y,
                vx: -Math.cos(angle) * 2 + (Math.random()-0.5),
                vy: -Math.sin(angle) * 2 + (Math.random()-0.5),
                life: 0.5, color: '#ff0055', size: 2
             });
          }
        } else {
          m.speed *= 0.9;
          if(m.speed > 0.1) m.x += Math.cos(player.facingAngle) * m.speed;
        }
      }
      for (let j = state.enemies.length - 1; j >= 0; j--) {
        const e = state.enemies[j];
        if (!e.isInvulnerable && Math.hypot(m.x - e.x, m.y - e.y) < e.radius + m.radius) {
          e.hp -= m.damage;
          createDamageNumber(e.x, e.y, m.damage, '#ff0055');
          createParticles(m.x, m.y, '#ff0055', 20);
          audioController.playWeaponAttack('mine_explode');
          state.mines.splice(i, 1);
          if (e.hp <= 0) killEnemy(e, j);
          break;
        }
      }
    }

    // 8. Spawner (Same logic)
    const spawnRate = Math.max(15, 80 - Math.floor(state.timeElapsed / 12));
    if (state.frameCount % spawnRate === 0) {
      const availableTypes = Object.entries(ENEMY_TYPES).filter(([_, t]) => state.timeElapsed >= t.minTime);
      if (availableTypes.length > 0) {
        const [typeId, typeDef] = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.max(canvasWidth, canvasHeight) / 2 + 100;
        const ex = player.x + Math.cos(angle) * dist;
        const ey = player.y + Math.sin(angle) * dist;
        const finalX = Math.max(typeDef.radius, Math.min(WORLD_WIDTH - typeDef.radius, ex));
        const finalY = Math.max(typeDef.radius, Math.min(WORLD_HEIGHT - typeDef.radius, ey));
        const timeScale = 1 + (state.timeElapsed / 500);
        const finalHp = Math.max(1, (15 + state.timeElapsed * 0.6) * typeDef.hpMult * timeScale);
        const finalSpeed = (typeDef.speedMult * 2.5 + (state.timeElapsed / 400)) * 0.3;
        const xpScale = 1 + (state.timeElapsed / 60) * 0.5;
        const finalExp = Math.ceil(typeDef.exp * xpScale);
        for (let i = 0; i < typeDef.swarmCount; i++) {
          state.enemies.push({
            x: finalX + (i * 10), y: finalY + (i * 10),
            radius: typeDef.radius, color: typeDef.color,
            hp: finalHp, maxHp: finalHp, speed: finalSpeed,
            damage: typeDef.damage, exp: finalExp, type: typeId,
            // AI States
            attackTimer: 0, isAttacking: false, teleportTimer: 0,
            isInvulnerable: false, invulnTimeRemaining: 0
          });
        }
      }
    }

    // Enemy AI
    state.enemies.forEach(e => {
      const typeDef = ENEMY_TYPES[e.type];
      const distToPlayer = Math.hypot(player.x - e.x, player.y - e.y);
      let moveSpeed = e.speed;
      if (e.type === 'flicker') {
        e.teleportTimer++;
        if (e.isInvulnerable) {
          e.invulnTimeRemaining--;
          if (e.invulnTimeRemaining <= 0) e.isInvulnerable = false;
        }
        if (e.teleportTimer >= (typeDef.teleportCooldown || 180)) {
           const angle = Math.random() * Math.PI * 2;
           const range = typeDef.teleportRange || 300;
           let newX = e.x + Math.cos(angle) * range * Math.random();
           let newY = e.y + Math.sin(angle) * range * Math.random();
           newX = Math.max(e.radius, Math.min(WORLD_WIDTH - e.radius, newX));
           newY = Math.max(e.radius, Math.min(WORLD_HEIGHT - e.radius, newY));
           e.x = newX; e.y = newY;
           e.teleportTimer = 0; e.isInvulnerable = true;
           e.invulnTimeRemaining = typeDef.invulnTime || 30;
           createParticles(e.x, e.y, e.color, 20);
        }
      }
      if (e.type === 'spitter') {
        e.attackTimer++;
        if (distToPlayer <= (typeDef.attackRange || 400) && e.attackTimer >= (typeDef.attackCooldown || 180) && !e.isAttacking) {
           e.isAttacking = true; moveSpeed = 0;
           audioController.playWeaponAttack('spitter_charge');
           setTimeout(() => {
             if (state.isPaused || !state.enemies.includes(e)) return;
             const angle = Math.atan2(player.y - e.y, player.x - e.x);
             state.enemyProjectiles.push({
               x: e.x, y: e.y,
               vx: Math.cos(angle) * (typeDef.projectileSpeed || 6),
               vy: Math.sin(angle) * (typeDef.projectileSpeed || 6),
               damage: typeDef.projectileDamage || 10,
               life: 600, radius: 5, color: '#39ff14' // Neon green enemy shot
             });
             audioController.playWeaponAttack('crossbow');
             e.isAttacking = false; e.attackTimer = 0;
           }, 500);
        } else if (e.isAttacking) moveSpeed = 0;
      }
      if (!e.isAttacking) {
        const angle = Math.atan2(player.y - e.y, player.x - e.x);
        e.x += Math.cos(angle) * moveSpeed;
        e.y += Math.sin(angle) * moveSpeed;
      }
      if (Math.hypot(player.x - e.x, player.y - e.y) < player.radius + e.radius) {
        player.hp -= e.damage;
        if (player.hp <= 0) endGame();
      }
    });

    // Gems
    for (let i = state.gems.length - 1; i >= 0; i--) {
      const g = state.gems[i];
      const dist = Math.hypot(player.x - g.x, player.y - g.y);
      if (dist < player.stats.magnet) {
        g.x += (player.x - g.x) * 0.15;
        g.y += (player.y - g.y) * 0.15;
      }
      if (dist < player.radius + 10) {
        player.exp += g.val * settings.exp;
        state.gems.splice(i, 1);
        if (player.exp >= player.expToNext) levelUp();
      }
    }

    // Cleanup
    for (let i = state.particles.length - 1; i >= 0; i--) {
       state.particles[i].x += state.particles[i].vx;
       state.particles[i].y += state.particles[i].vy;
       state.particles[i].life -= 0.05;
       if (state.particles[i].life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.lightnings.length - 1; i >= 0; i--) {
      state.lightnings[i].life--;
      if (state.lightnings[i].life <= 0) state.lightnings.splice(i, 1);
    }

    state.frameCount++;
    setUiState(prev => ({
      ...prev,
      hp: player.hp, maxHp: player.maxHp, level: player.level, exp: player.exp, expToNext: player.expToNext
    }));
  };

  // --- Render Loop (Cyberpunk Style) ---
  const draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const state = gameState.current;
    
    // Clear
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(-state.camX, -state.camY);

    // --- Cyberpunk Grid Background ---
    const gridSize = 100;
    const startX = Math.floor(state.camX / gridSize) * gridSize;
    const endX = startX + width + gridSize;
    const startY = Math.floor(state.camY / gridSize) * gridSize;
    const endY = startY + height + gridSize;

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)'; // Faint Cyan Grid
    
    ctx.beginPath();
    for (let x = startX; x < endX; x += gridSize) {
       ctx.moveTo(x, startY); ctx.lineTo(x, endY);
    }
    for (let y = startY; y < endY; y += gridSize) {
       ctx.moveTo(startX, y); ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Add glowing intersections
    ctx.fillStyle = 'rgba(0, 243, 255, 0.3)';
    for (let x = startX; x < endX; x += gridSize) {
      for (let y = startY; y < endY; y += gridSize) {
        if (x > 0 && x < WORLD_WIDTH && y > 0 && y < WORLD_HEIGHT) {
             ctx.fillRect(x-1, y-1, 2, 2);
        }
      }
    }

    // World Border
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 5;
    ctx.shadowBlur = 20; ctx.shadowColor = '#ff0055';
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.shadowBlur = 0; ctx.lineWidth = 1;

    // --- Additive Blending for Glows ---
    ctx.globalCompositeOperation = 'lighter';

    // Gems
    state.gems.forEach(g => {
      ctx.fillStyle = '#39ff14'; // Neon Green
      ctx.shadowBlur = 15; ctx.shadowColor = '#39ff14';
      ctx.beginPath(); 
      ctx.moveTo(g.x, g.y-6); ctx.lineTo(g.x+6, g.y); ctx.lineTo(g.x, g.y+6); ctx.lineTo(g.x-6, g.y);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Particles
    state.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.beginPath(); ctx.rect(p.x, p.y, p.size, p.size); ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    // Player Projectiles - DIVERSE LOOKS
    state.projectiles.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      const angle = Math.atan2(p.vy, p.vx);

      if (p.color === 'crossbow') {
         // High tech bolt
         ctx.rotate(angle);
         ctx.fillStyle = '#ffffff';
         ctx.shadowBlur = 10; ctx.shadowColor = '#00f3ff';
         ctx.beginPath();
         ctx.rect(-p.radius * 2, -2, p.radius * 3, 4); // Long Trail
         ctx.fill();
         ctx.fillStyle = '#00f3ff';
         ctx.beginPath(); ctx.arc(p.radius, 0, 3, 0, Math.PI*2); ctx.fill(); // Head
      
      } else if (p.color === 'wand') {
         // Spinning star
         ctx.rotate(state.frameCount * 0.2);
         ctx.fillStyle = '#bc13fe';
         ctx.shadowBlur = 15; ctx.shadowColor = '#bc13fe';
         
         ctx.beginPath();
         for(let i=0; i<4; i++) {
             ctx.rotate(Math.PI/2);
             ctx.moveTo(0, -p.radius);
             ctx.lineTo(p.radius/2, 0);
             ctx.lineTo(0, p.radius);
             ctx.lineTo(-p.radius/2, 0);
         }
         ctx.fill();

      } else if (p.color === 'shotgun') {
         // Shrapnel shards
         ctx.rotate(angle);
         ctx.fillStyle = '#ffee00';
         ctx.shadowBlur = 5; ctx.shadowColor = '#ff5500';
         
         // Jagged shape
         ctx.beginPath();
         ctx.moveTo(p.radius, 0);
         ctx.lineTo(-p.radius, -p.radius + Math.random()*2);
         ctx.lineTo(-p.radius + 2, 0);
         ctx.lineTo(-p.radius, p.radius - Math.random()*2);
         ctx.fill();

      } else if (p.color === 'missile') {
         // Rocket
         ctx.rotate(angle);
         ctx.fillStyle = '#00f3ff';
         ctx.shadowBlur = 10; ctx.shadowColor = '#00f3ff';
         
         // Body
         ctx.beginPath(); 
         ctx.moveTo(p.radius, 0); 
         ctx.lineTo(-p.radius, -p.radius/1.5); 
         ctx.lineTo(-p.radius, p.radius/1.5); 
         ctx.fill();
         
         // Engine glow
         ctx.fillStyle = '#ffffff';
         ctx.beginPath(); ctx.arc(-p.radius, 0, 3, 0, Math.PI*2); ctx.fill();

      } else {
         // Default
         ctx.fillStyle = '#ffffff';
         ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      ctx.shadowBlur = 0;
    });

    // Enemy Projectiles (Orbs)
    state.enemyProjectiles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10; ctx.shadowColor = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
      // Core
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius/2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Mines
    state.mines.forEach(m => {
      const alpha = m.life < 30 ? m.life / 30 : 1;
      ctx.fillStyle = m.color;
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 20; ctx.shadowColor = m.color;
      
      ctx.beginPath(); ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2); ctx.fill();
      // Tech ring
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.radius * 1.2, 0 + state.frameCount*0.1, Math.PI + state.frameCount*0.1); ctx.stroke();
      
      if (m.life >= (300 - m.delay)) {
         ctx.beginPath(); ctx.arc(m.x, m.y, m.radius * 2, 0, Math.PI * 2); 
         ctx.strokeStyle = `rgba(255, 0, 85, ${alpha})`; ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    });

    // Orbit
    const orbitWeapon = state.player.weapons.find(w => w.id === 'orbit');
    if (orbitWeapon) {
      const orbitSpeed = 0.05 * state.devSettings.spd;
      const orbitDist = 80 * state.player.stats.area;
      const orbRadius = 10 * (state.player.stats.area || 1);
      ctx.fillStyle = '#bc13fe';
      ctx.shadowBlur = 20; ctx.shadowColor = '#bc13fe';
      
      // Draw for Player and Wingmen
      const emitters = [state.player, ...state.wingmen];
      emitters.forEach(emitter => {
          for (let i = 0; i < orbitWeapon.count; i++) {
            const angle = (state.frameCount * orbitSpeed) + (i * (Math.PI * 2 / orbitWeapon.count));
            const ox = emitter.x + Math.cos(angle) * orbitDist;
            const oy = emitter.y + Math.sin(angle) * orbitDist;
            ctx.beginPath(); ctx.arc(ox, oy, orbRadius, 0, Math.PI * 2); ctx.fill();
          }
      });
      ctx.shadowBlur = 0;
    }

    // Lightnings
    state.lightnings.forEach(l => {
      ctx.strokeStyle = l.color;
      ctx.lineWidth = 3;
      ctx.shadowBlur = 20; ctx.shadowColor = l.color;
      ctx.beginPath();
      ctx.moveTo(l.x1, l.y1);
      const dist = Math.hypot(l.x2 - l.x1, l.y2 - l.y1);
      const steps = Math.max(2, Math.floor(dist / 20));
      for (let i = 1; i < steps; i++) {
         const t = i / steps;
         const tx = l.x1 + (l.x2 - l.x1) * t;
         const ty = l.y1 + (l.y2 - l.y1) * t;
         ctx.lineTo(tx + (Math.random()-0.5)*20, ty + (Math.random()-0.5)*20);
      }
      ctx.lineTo(l.x2, l.y2);
      ctx.stroke();
    });
    ctx.shadowBlur = 0; ctx.lineWidth = 1;

    // Enemies (Wireframe Style)
    ctx.globalCompositeOperation = 'source-over'; // Reset for enemies body
    state.enemies.forEach(e => {
      ctx.save();
      ctx.translate(e.x, e.y);
      
      // Glow behind
      ctx.shadowBlur = 10; ctx.shadowColor = e.color;
      
      // Fill dark
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.beginPath();
      if (e.type === 'tank') ctx.rect(-e.radius, -e.radius, e.radius*2, e.radius*2);
      else ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Stroke neon
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // HP Bar (Digital style)
      const hpPct = e.hp / e.maxHp;
      ctx.fillStyle = '#333';
      ctx.fillRect(-12, -e.radius - 10, 24, 4);
      ctx.fillStyle = hpPct > 0.5 ? '#39ff14' : '#ff0055';
      ctx.fillRect(-12, -e.radius - 10, 24 * hpPct, 4);
      
      ctx.restore();
    });

    // Flame Aura (Plasma Field)
    if (state.player.stats.flameDmg > 0) {
       ctx.globalCompositeOperation = 'lighter';
       const baseRange = (60 * state.player.stats.area) + (state.player.stats['flameRangeBonus'] || 0);
       
       // Fixed size with tiny noise (no pulsing scaling)
       const flameRange = baseRange + (Math.random() * 3);

       const emitters = [state.player, ...state.wingmen];
       
       // 1. Interference/Fusion Effects
       if (emitters.length > 1) {
           state.wingmen.forEach(wm => {
               const dist = Math.hypot(state.player.x - wm.x, state.player.y - wm.y);
               // Threshold for interaction: slightly less than 2x radius (touching)
               if (dist < flameRange * 2.2) {
                   // Fusion Link (The "Merge")
                   ctx.strokeStyle = 'rgba(255, 100, 50, 0.12)'; // Orange-Red glow (Reduced from 0.18)
                   ctx.lineWidth = flameRange * 1.2; // Thick connection
                   ctx.lineCap = 'round';
                   ctx.beginPath();
                   ctx.moveTo(state.player.x, state.player.y);
                   ctx.lineTo(wm.x, wm.y);
                   ctx.stroke();

                   // Interference Patterns (The "Disturbance")
                   // Draw erratic lines perpendicular to the connection
                   const midX = (state.player.x + wm.x) / 2;
                   const midY = (state.player.y + wm.y) / 2;
                   const angle = Math.atan2(wm.y - state.player.y, wm.x - state.player.x);
                   
                   ctx.strokeStyle = 'rgba(100, 255, 255, 0.25)'; // Cyan/White interference sparks (Reduced from 0.35)
                   ctx.lineWidth = 1.5;
                   ctx.beginPath();
                   
                   // Generate 3 random interference arcs
                   for(let i=0; i<3; i++) {
                       const offset = (Math.random() - 0.5) * flameRange * 0.8;
                       // Point on the connection line
                       const cx = midX + Math.cos(angle) * offset;
                       const cy = midY + Math.sin(angle) * offset;
                       
                       // Perpendicular displacement
                       const perpAngle = angle + Math.PI/2;
                       const jaggedSize = 15 + Math.random() * 10;
                       
                       ctx.moveTo(cx - Math.cos(perpAngle)*jaggedSize, cy - Math.sin(perpAngle)*jaggedSize);
                       // Zigzag
                       ctx.lineTo(cx, cy);
                       ctx.lineTo(cx + Math.cos(perpAngle)*jaggedSize, cy + Math.sin(perpAngle)*jaggedSize);
                   }
                   ctx.stroke();
               }
           });
       }

       // 2. Draw Emitters (Static size)
       emitters.forEach(emitter => {
           const grad = ctx.createRadialGradient(emitter.x, emitter.y, flameRange*0.3, emitter.x, emitter.y, flameRange);
           grad.addColorStop(0, 'rgba(255, 180, 50, 0.35)'); // Bright Core (Reduced from 0.5)
           grad.addColorStop(0.6, 'rgba(255, 50, 0, 0.1)'); // (Reduced from 0.14)
           grad.addColorStop(1, 'rgba(255, 0, 0, 0)');
           
           ctx.fillStyle = grad;
           ctx.beginPath(); ctx.arc(emitter.x, emitter.y, flameRange, 0, Math.PI*2); ctx.fill();
           
           // Inner ring (Rotating, not scaling)
           ctx.strokeStyle = 'rgba(255, 200, 100, 0.14)'; // (Reduced from 0.2)
           ctx.lineWidth = 1;
           ctx.beginPath(); 
           // Slow rotation
           ctx.arc(emitter.x, emitter.y, flameRange * 0.7, state.frameCount * 0.05, state.frameCount * 0.05 + Math.PI*1.5); 
           ctx.stroke();
       });
    }

    // Player (Cyberpunk Arrow)
    ctx.globalCompositeOperation = 'source-over';
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.rotate(state.player.facingAngle);
    // Engine trail
    ctx.fillStyle = 'rgba(0, 243, 255, 0.5)';
    ctx.shadowBlur = 20; ctx.shadowColor = '#00f3ff';
    ctx.beginPath(); ctx.moveTo(-10, -5); ctx.lineTo(-25 - Math.random()*10, 0); ctx.lineTo(-10, 5); ctx.fill();
    // Body
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#00f3ff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-10, -10); ctx.lineTo(-5, 0); ctx.lineTo(-10, 10); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();

    // Wingmen (Mini Cyberpunk Arrows - ORBITING)
    state.wingmen.forEach(w => {
        ctx.save();
        ctx.translate(w.x, w.y);
        ctx.rotate(state.player.facingAngle); // They face same as player or look at target (here same as player for simplicity)
        // Trail
        ctx.fillStyle = 'rgba(0, 243, 255, 0.3)';
        ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-15 - Math.random()*5, 0); ctx.lineTo(-5, 2); ctx.fill();
        // Body
        ctx.fillStyle = '#000';
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1;
        // Smaller triangle
        ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-3, 0); ctx.lineTo(-6, 6); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
    });

    ctx.restore(); // End camera transform

    // UI: Damage Numbers
    ctx.font = 'bold 16px Orbitron, monospace';
    for (let i = state.damageNumbers.length - 1; i >= 0; i--) {
      const d = state.damageNumbers[i];
      ctx.fillStyle = d.color;
      const screenX = d.x - state.camX;
      const screenY = d.y - state.camY;
      ctx.fillText(d.val.toString(), screenX, screenY - (40 - d.life));
      d.life--;
      if (d.life <= 0) state.damageNumbers.splice(i, 1);
    }

    // Visual Joystick (Cyber Style)
    if (touchRef.current.start && touchRef.current.current) {
       const { x: sx, y: sy } = touchRef.current.start;
       const { x: cx, y: cy } = touchRef.current.current;
       ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
       ctx.lineWidth = 2;
       ctx.beginPath(); ctx.arc(sx, sy, 40, 0, Math.PI * 2); ctx.stroke();
       
       const dist = Math.hypot(cx - sx, cy - sy);
       const maxDist = 40;
       const scale = dist > maxDist ? maxDist / dist : 1;
       const kx = sx + (cx - sx) * scale;
       const ky = sy + (cy - sy) * scale;
       
       ctx.fillStyle = 'rgba(0, 243, 255, 0.8)';
       ctx.beginPath(); ctx.arc(kx, ky, 15, 0, Math.PI * 2); ctx.fill();
       ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(kx, ky); ctx.stroke();
    }
  };

  const startGame = () => {
    audioController.init();
    audioController.startBgm();
    gameState.current.player = JSON.parse(JSON.stringify(INITIAL_PLAYER));
    gameState.current.player.maxHp = INITIAL_PLAYER.baseMaxHp * gameState.current.devSettings.hp;
    gameState.current.player.hp = gameState.current.player.maxHp;
    gameState.current.enemies = [];
    gameState.current.wingmen = [];
    gameState.current.projectiles = [];
    gameState.current.enemyProjectiles = [];
    gameState.current.gems = [];
    gameState.current.timeElapsed = 0;
    gameState.current.frameCount = 0;
    gameState.current.isPaused = false;
    gameState.current.isRunning = true;
    
    // Reset camera to center on player
    gameState.current.camX = 0;
    gameState.current.camY = 0;
    
    setUiState(prev => ({ ...prev, isGameOver: false, isRunning: true, time: "00:00" }));
    
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!gameState.current.isPaused && gameState.current.isRunning) {
        gameState.current.timeElapsed++;
        const m = Math.floor(gameState.current.timeElapsed / 60).toString().padStart(2, '0');
        const s = (gameState.current.timeElapsed % 60).toString().padStart(2, '0');
        setUiState(prev => ({ ...prev, time: `${m}:${s}` }));
      }
    }, 1000) as unknown as number;
  };

  const endGame = () => {
    gameState.current.isRunning = false;
    audioController.playGameOver();
    clearInterval(timerRef.current);
    setUiState(prev => ({ ...prev, isGameOver: true }));
  };

  const levelUp = () => {
    gameState.current.isPaused = true;
    audioController.playLevelUp();
    gameState.current.player.level++;
    gameState.current.player.exp -= gameState.current.player.expToNext;
    gameState.current.player.expToNext = Math.floor(gameState.current.player.expToNext * 1.2);
    generateUpgrades();
    setUiState(prev => ({ ...prev, isLevelUp: true }));
  };

  const generateUpgrades = () => {
    const player = gameState.current.player;
    const possible: any[] = [];

    const hasFlame = player.stats.flameDmg > 0;
    possible.push({
      type: hasFlame ? 'enhance' : 'new',
      key: 'weapon.flame',
      descKey: hasFlame ? 'desc.flame.upgrade' : 'desc.flame.new',
      tagKey: hasFlame ? 'upgrade.tag.aoe' : 'upgrade.tag.new_passive',
      action: () => {
        player.stats.flameDmg = (player.stats.flameDmg || 0) + 10;
        // Fix: Don't increase global area for flame upgrades, just flame range
        player.stats['flameRangeBonus'] = (player.stats['flameRangeBonus'] || 0) + 20;
      }
    });
    
    const hasCrossbow = player.weapons.find(w => w.id === 'crossbow');
    possible.push({
      type: hasCrossbow ? 'enhance' : 'new',
      key: 'weapon.crossbow',
      descKey: hasCrossbow ? 'desc.crossbow.upgrade' : 'desc.crossbow.new',
      tagKey: 'upgrade.tag.high_dmg',
      action: () => {
        if(hasCrossbow) { hasCrossbow.baseDamage += 30; hasCrossbow.baseCooldown *= 0.9; }
        else player.weapons.push({ id: 'crossbow', name: 'crossbow', baseDamage: 80, baseCooldown: 120, timer: 0, range: 400, baseSpeed: 12, count: 1 });
      }
    });
    
    const hasOrbit = player.weapons.find(w => w.id === 'orbit');
    possible.push({
      type: hasOrbit ? 'enhance' : 'new',
      key: 'weapon.orbit',
      descKey: hasOrbit ? 'desc.orbit.upgrade' : 'desc.orbit.new',
      tagKey: 'upgrade.tag.defensive',
      action: () => {
        if(hasOrbit) hasOrbit.count++;
        else player.weapons.push({ id: 'orbit', name: 'orbit', baseDamage: 10, baseCooldown: 0, timer: 0, range: 0, baseSpeed: 0, count: 1 });
      }
    });
    
    const hasMines = player.weapons.find(w => w.id === 'mines');
    possible.push({
      type: hasMines ? 'enhance' : 'new',
      key: 'weapon.mines',
      descKey: hasMines ? 'desc.mines.upgrade' : 'desc.mines.new',
      tagKey: 'upgrade.tag.trap',
      action: () => {
        if(hasMines) hasMines.count++;
        else player.weapons.push({ id: 'mines', name: 'mines', baseDamage: 40, baseCooldown: 180, timer: 0, range: 0, baseSpeed: 0, count: 1 });
      }
    });

    const hasWand = player.weapons.find(w => w.id === 'wand');
    possible.push({
      type: hasWand ? 'enhance' : 'new',
      key: 'weapon.wand',
      descKey: hasWand ? 'desc.wand.upgrade' : 'desc.wand.new',
      tagKey: 'upgrade.tag.homing',
      action: () => {
        if(hasWand) { hasWand.count++; hasWand.baseCooldown *= 0.9; }
        else player.weapons.push({ id: 'wand', name: 'wand', baseDamage: 15, baseCooldown: 60, timer: 0, range: 600, baseSpeed: 9, count: 1 });
      }
    });

    const hasThunder = player.weapons.find(w => w.id === 'thunder');
    possible.push({
      type: hasThunder ? 'enhance' : 'new',
      key: 'weapon.thunder',
      descKey: hasThunder ? 'desc.thunder.upgrade' : 'desc.thunder.new',
      tagKey: 'upgrade.tag.aoe',
      action: () => {
        if(hasThunder) { hasThunder.count += 2; } 
        else player.weapons.push({ id: 'thunder', name: 'thunder', baseDamage: 25, baseCooldown: 100, timer: 0, range: 400, baseSpeed: 0, count: 1 });
      }
    });

    // Wingman Upgrade
    const wingmanCount = player.stats.wingmanCount || 0;
    if (wingmanCount < 5) {
        possible.push({
            type: wingmanCount > 0 ? 'enhance' : 'new',
            key: 'title.wingman',
            descKey: wingmanCount > 0 ? 'desc.wingman.upgrade' : 'desc.wingman.new',
            tagKey: 'upgrade.tag.summon',
            action: () => { player.stats.wingmanCount = (player.stats.wingmanCount || 0) + 1; }
        });
    }

    possible.push({ type: 'stat', key: 'title.hp_regen', descKey: 'desc.hp_regen', tagKey: 'upgrade.tag.survival', action: () => { player.stats.hpRegen += 0.033; } });
    possible.push({ type: 'stat', key: 'title.magnet', descKey: 'desc.magnet', tagKey: 'upgrade.tag.utility', action: () => { player.stats.magnet += 100; } });
    possible.push({ type: 'stat', key: 'title.global_dmg', descKey: 'desc.global_dmg', tagKey: 'upgrade.tag.passive', action: () => { player.weapons.forEach(w => w.baseDamage = Math.floor((w.baseDamage||10) * 1.1)); } });
    possible.push({ type: 'stat', key: 'title.heal', descKey: 'desc.heal', tagKey: 'upgrade.tag.supply', action: () => { player.hp = Math.min(player.maxHp, player.hp + player.maxHp/2); } });
    possible.push({ type: 'stat', key: 'title.giant_size', descKey: 'desc.giant_size', tagKey: 'upgrade.tag.size', action: () => { player.stats.area += 0.25; } });

    setUpgradeOptions(possible.sort(() => 0.5 - Math.random()).slice(0, 3));
  };

  const selectUpgrade = (option: any) => {
    option.action();
    gameState.current.isPaused = false;
    setUiState(prev => ({ ...prev, isLevelUp: false }));
  };

  useEffect(() => {
    const loop = () => {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          canvasRef.current.width = window.innerWidth;
          canvasRef.current.height = window.innerHeight;
          update(canvasRef.current.width, canvasRef.current.height);
          draw(ctx, canvasRef.current.width, canvasRef.current.height);
        }
      }
      requestRef.current = requestAnimationFrame(loop);
    };
    requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [lang]); 

  // Handle settings panel pause/resume
  useEffect(() => {
    if (showDev) {
      // Opening settings - pause if game is running
      if (gameState.current.isRunning && !gameState.current.isPaused) {
        gameState.current.isPaused = true;
      }
    } else {
      // Closing settings - resume if game is running
      if (gameState.current.isRunning) {
        gameState.current.isPaused = false;
      }
    }
  }, [showDev]);

  const updateDevSetting = (key: keyof DevSettings, val: string) => {
     const num = parseFloat(val);
     setDevSettings(prev => {
         const next = { ...prev, [key]: num };
         gameState.current.devSettings = next;
         if (key === 'hp') {
             const p = gameState.current.player;
             const oldPct = p.hp / p.maxHp;
             p.maxHp = p.baseMaxHp * num;
             p.hp = p.maxHp * oldPct;
         }
         return next;
     });
  };

  return (
    <div ref={containerRef} 
         style={{
           position: 'relative',
           width: '100%',
           height: '100vh',
           fontFamily: 'Orbitron, monospace',
           touchAction: 'none'
         }}>
      
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />

      {/* Tech Corners */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '64px',
        height: '64px',
        borderTop: '4px solid #00f3ff',
        borderLeft: '4px solid #00f3ff',
        pointerEvents: 'none',
        opacity: 0.5
      }}></div>
      <div style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: '64px',
        height: '64px',
        borderTop: '4px solid #00f3ff',
        borderRight: '4px solid #00f3ff',
        pointerEvents: 'none',
        opacity: 0.5
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: '64px',
        height: '64px',
        borderBottom: '4px solid #00f3ff',
        borderLeft: '4px solid #00f3ff',
        pointerEvents: 'none',
        opacity: 0.5
      }}></div>
      <div style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: '64px',
        height: '64px',
        borderBottom: '4px solid #00f3ff',
        borderRight: '4px solid #00f3ff',
        pointerEvents: 'none',
        opacity: 0.5
      }}></div>

      <div style={{
        position: 'absolute',
        top: window.innerWidth <= 480 ? '120px' : '10px',
        right: '10px',
        display: 'flex',
        flexDirection: window.innerWidth <= 480 ? 'column' : 'row',
        gap: '8px',
        zIndex: 50
      }}>
        <button 
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: '1px solid #666',
            color: '#999',
            padding: 'clamp(6px, 2vw, 8px) clamp(8px, 3vw, 16px)',
            cursor: 'pointer',
            fontSize: 'clamp(12px, 3vw, 16px)',
            minWidth: '40px',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={toggleMute}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
        
        <button 
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: '1px solid #00f3ff',
            color: '#00f3ff',
            padding: 'clamp(6px, 2vw, 8px) clamp(8px, 3vw, 16px)',
            cursor: 'pointer',
            fontSize: 'clamp(12px, 3vw, 16px)',
            minWidth: '40px',
            minHeight: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setShowDev(!showDev)}
        >
          ⚙️
        </button>
      </div>

      {showDev && (
        <div style={{
          position: 'absolute',
          top: window.innerWidth <= 480 ? '200px' : '70px',
          right: '10px',
          left: window.innerWidth <= 480 ? '10px' : 'auto',
          width: window.innerWidth <= 480 ? 'auto' : 'min(320px, 90vw)',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          border: '1px solid #00f3ff',
          padding: 'clamp(12px, 3vw, 20px)',
          zIndex: 50,
          fontSize: 'clamp(12px, 2.5vw, 14px)',
          maxHeight: window.innerWidth <= 480 ? '60vh' : '80vh',
          overflowY: 'auto',
          color: 'white',
          borderRadius: '8px'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #666',
            paddingBottom: '12px',
            marginBottom: '16px'
          }}>
             <h3 style={{
               color: '#00f3ff',
               fontWeight: 'bold',
               textTransform: 'uppercase',
               letterSpacing: '0.1em'
             }}>設定控制台</h3>
             <button onClick={() => setShowDev(false)} style={{
               color: '#999',
               backgroundColor: 'transparent',
               border: 'none',
               cursor: 'pointer',
               fontSize: '16px'
             }}>✕</button>
          </div>
          
          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#ccc',
              marginBottom: '8px'
            }}>
               <span>語言</span>
            </div>
            <button onClick={toggleLang} style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #0088aa',
              color: '#00cccc',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}>
               {lang === 'zh' ? '繁體中文' : 'English'}
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#ccc',
              marginBottom: '4px'
            }}>
               <span>背景音樂</span>
               <span style={{ color: '#00f3ff', fontFamily: 'monospace' }}>{Math.round(bgmVolume * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05" 
              value={bgmVolume} 
              onChange={(e) => handleBgmChange(parseFloat(e.target.value))}
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#333',
                cursor: 'pointer'
              }}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#ccc',
              marginBottom: '4px'
            }}>
               <span>音效</span>
               <span style={{ color: '#00f3ff', fontFamily: 'monospace' }}>{Math.round(sfxVolume * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05" 
              value={sfxVolume} 
              onChange={(e) => handleSfxChange(parseFloat(e.target.value))}
              style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#333',
                cursor: 'pointer'
              }}
            />
          </div>

          {(['dmg', 'spd', 'frq', 'hp', 'mov', 'exp'] as const).map(k => (
            <div key={k} style={{ marginBottom: '16px' }}>
               <div style={{
                 display: 'flex',
                 justifyContent: 'space-between',
                 color: '#ccc',
                 marginBottom: '4px'
               }}>
                 <span>{k.toUpperCase()}</span>
                 <span style={{ color: '#00f3ff', fontFamily: 'monospace' }}>x{devSettings[k].toFixed(1)}</span>
               </div>
               <input 
                 type="range" min="0.5" max="6.0" step="0.1" 
                 value={devSettings[k]} 
                 onChange={(e) => updateDevSetting(k, e.target.value)}
                 style={{
                   width: '100%',
                   height: '4px',
                   backgroundColor: '#333',
                   cursor: 'pointer'
                 }}
               />
            </div>
          ))}
          <button 
            onClick={() => { 
                setDevSettings(DEFAULT_DEV_SETTINGS); 
                gameState.current.devSettings = DEFAULT_DEV_SETTINGS; 
            }}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#1a1a1a',
              border: '1px solid #0088aa',
              color: 'white',
              marginTop: '8px',
              textTransform: 'uppercase',
              cursor: 'pointer'
            }}
          >
            重置
          </button>
        </div>
      )}

      {uiState.isRunning && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          padding: 'clamp(10px, 3vw, 20px)',
          display: 'flex',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          zIndex: 10,
          userSelect: 'none',
          boxSizing: 'border-box'
        }}>
           {/* HP Bar - Left Side */}
           <div style={{ 
             width: 'clamp(120px, 35vw, 200px)',
             maxWidth: '45vw',
             minWidth: '120px'
           }}>
             <div style={{
               color: '#00f3ff',
               fontWeight: 'bold',
               marginBottom: '4px',
               display: 'flex',
               justifyContent: 'space-between',
               fontSize: 'clamp(12px, 2.5vw, 14px)'
             }}>
                <span>HP</span>
                <span style={{ fontFamily: 'monospace' }}>{Math.ceil(uiState.hp)}/{Math.ceil(uiState.maxHp)}</span>
             </div>
             <div style={{
               width: '100%',
               height: '16px',
               backgroundColor: '#000',
               border: '1px solid #0088aa',
               position: 'relative',
               transform: 'skewX(-15deg)'
             }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(to right, #dc2626, #ef4444)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  width: `${(uiState.hp / uiState.maxHp) * 100}%`,
                  boxShadow: '0 0 10px red'
                }} />
             </div>
           </div>

           {/* EXP and Time - Right Side */}
           <div style={{ 
             width: 'clamp(120px, 35vw, 200px)',
             maxWidth: '45vw',
             minWidth: '120px',
             textAlign: 'right'
           }}>
             <div style={{
               color: '#00f3ff',
               fontWeight: 'bold',
               marginBottom: '4px',
               display: 'flex',
               justifyContent: 'space-between',
               fontSize: 'clamp(12px, 2.5vw, 14px)'
             }}>
                 <span style={{ fontFamily: 'monospace' }}>LV.{uiState.level}</span>
                 <span style={{ fontSize: 'clamp(8px, 2vw, 10px)' }}>EXP</span>
             </div>
             <div style={{
               width: '100%',
               height: '8px',
               backgroundColor: '#000',
               border: '1px solid #0088aa',
               position: 'relative',
               marginBottom: '8px'
             }}>
                <div style={{
                  height: '100%',
                  background: 'linear-gradient(to right, #0891b2, #06b6d4)',
                  transition: 'all 0.2s',
                  width: `${(uiState.exp / uiState.expToNext) * 100}%`,
                  boxShadow: '0 0 10px cyan'
                }} />
             </div>
             <div style={{
               fontSize: 'clamp(18px, 4vw, 24px)',
               fontWeight: 'bold',
               fontFamily: 'monospace',
               color: 'white',
               textShadow: '0 0 10px cyan'
             }}>{uiState.time}</div>
           </div>
           
           </div>
      )}

      {/* Bottom Status Text - Separate from HUD */}
      {uiState.isRunning && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          color: '#0088aa',
          fontSize: '12px',
          letterSpacing: '0.2em',
          textAlign: 'center',
          pointerEvents: 'none',
          zIndex: 5
        }}>
           SYSTEM ONLINE // 拖拽移動
        </div>
      )}

      {uiState.isLevelUp && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.9)',
          zIndex: 9000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'clamp(10px, 2vw, 20px)',
          boxSizing: 'border-box'
        }}>
           <h2 style={{
             fontSize: 'clamp(20px, 5vw, 32px)',
             color: '#00f3ff',
             fontWeight: 'bold',
             marginBottom: 'clamp(8px, 2vw, 16px)',
             textTransform: 'uppercase',
             letterSpacing: '0.1em',
             textShadow: '0 0 20px cyan',
             textAlign: 'center',
             margin: '0 0 clamp(8px, 2vw, 16px) 0'
           }}>升級</h2>
           <div style={{
             display: 'flex',
             flexDirection: 'column',
             gap: 'clamp(8px, 1.5vw, 12px)',
             alignItems: 'center',
             width: '100%',
             maxWidth: '95vw',
             flex: '1',
             justifyContent: 'center'
           }}>
             {upgradeOptions.map((opt, i) => {
                // Dynamic translation of title based on type
                let title = '';
                if (opt.type === 'stat') {
                    title = t(opt.key, lang);
                } else {
                    // Composite title for weapons/enhancements
                    const prefix = opt.type === 'enhance' ? t('upgrade.enhance', lang) : t('upgrade.new', lang);
                    title = `${prefix}: ${t(opt.key, lang)}`;
                }
                
                return (
                   <div key={i} onClick={() => selectUpgrade(opt)} 
                        className="upgrade-option"
                        style={{
                          width: '100%',
                          maxWidth: 'min(380px, 90vw)',
                          background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.9) 0%, rgba(0, 136, 170, 0.1) 100%)',
                          border: '2px solid #0088aa',
                          borderRadius: '6px',
                          padding: 'clamp(8px, 2vw, 16px)',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          position: 'relative',
                          touchAction: 'manipulation',
                          minHeight: 'clamp(70px, 12vh, 90px)',
                          maxHeight: 'clamp(90px, 18vh, 120px)',
                          boxShadow: '0 2px 8px rgba(0, 136, 170, 0.2)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center'
                        }}
                        data-upgrade={i}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'scale(1.02)';
                          e.currentTarget.style.borderColor = '#ffaa00';
                          e.currentTarget.style.boxShadow = '0 8px 24px rgba(255, 170, 0, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.borderColor = '#0088aa';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 136, 170, 0.2)';
                        }}>
                      <div style={{
                        display: 'inline-block',
                        padding: 'clamp(3px, 1.3vw, 5px) clamp(8px, 2.6vw, 13px)',
                        backgroundColor: 'rgba(0, 136, 170, 0.3)',
                        border: '1px solid #00f3ff',
                        borderRadius: '3px',
                        fontSize: 'clamp(12px, 2.6vw, 14px)',
                        color: '#00cccc',
                        marginBottom: 'clamp(5px, 1.3vw, 10px)',
                        textTransform: 'uppercase',
                        fontWeight: 'bold'
                      }}>{t(opt.tagKey, lang)}</div>
                      <h3 style={{
                        color: '#ffaa00',
                        fontSize: 'clamp(18px, 4.5vw, 23px)',
                        fontWeight: 'bold',
                        marginBottom: 'clamp(3px, 0.7vw, 5px)',
                        textShadow: '0 0 10px rgba(255, 170, 0, 0.5)',
                        letterSpacing: '0.3px',
                        lineHeight: '1.1',
                        margin: '0 0 clamp(3px, 0.7vw, 5px) 0'
                      }}>{title}</h3>
                      <p style={{
                        color: '#cccccc',
                        fontSize: 'clamp(13px, 2.6vw, 16px)',
                        lineHeight: '1.2',
                        fontFamily: 'monospace',
                        opacity: 0.9,
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                        margin: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>{t(opt.descKey, lang)}</p>
                   </div>
                );
             })}
           </div>
        </div>
      )}

      {!uiState.isRunning && !uiState.isGameOver && (
         <div style={{
           position: 'fixed',
           top: 0,
           left: 0,
           width: '100vw',
           height: '100vh',
           backgroundColor: '#000000',
           zIndex: 10000,
           display: 'flex',
           flexDirection: 'column',
           alignItems: 'center',
           justifyContent: 'center',
           color: 'white',
           padding: '20px',
           boxSizing: 'border-box'
         }}>
            
            <h1 style={{
              fontSize: 'clamp(2rem, 8vw, 4rem)',
              fontWeight: 'bold',
              color: '#00f3ff',
              marginBottom: '2rem',
              textAlign: 'center',
              lineHeight: '1.2'
            }}>
              太空獵手 Space Hunter
            </h1>
            <p style={{
              color: '#0088aa',
              marginBottom: '3rem',
              fontSize: 'clamp(0.7rem, 2vw, 0.9rem)',
    letterSpacing: '0.3em',
              textAlign: 'center'
            }}>CYBERNETIC WARFARE SIMULATION V9.0</p>
            
            <button onClick={startGame} style={{
              width: 'min(300px, 80vw)',
              padding: '16px 32px',
              backgroundColor: 'rgba(0, 243, 255, 0.1)',
              border: '2px solid #00f3ff',
              color: '#00f3ff',
              fontSize: 'clamp(1rem, 3vw, 1.2rem)',
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: '16px'
            }}>
              開始遊戲
            </button>
            <button onClick={() => setShowDev(true)} style={{
              width: 'min(300px, 80vw)',
              padding: '12px 24px',
              backgroundColor: 'transparent',
              border: '1px solid #666',
              color: '#999',
              fontSize: 'clamp(0.8rem, 2.5vw, 0.9rem)',
              cursor: 'pointer'
            }}>
              設定
            </button>
         </div>
      )}

      {uiState.isGameOver && (
         <div style={{
           position: 'absolute',
           top: 0,
           left: 0,
           right: 0,
           bottom: 0,
           backgroundColor: 'rgba(0, 0, 0, 0.95)',
           zIndex: 9500,
           display: 'flex',
           flexDirection: 'column',
           alignItems: 'center',
           justifyContent: 'center',
           color: 'white',
           padding: '20px',
           boxSizing: 'border-box'
         }}>
            <h1 style={{
              fontSize: 'clamp(2.5rem, 10vw, 60px)',
              fontWeight: 'black',
              color: '#dc2626',
              marginBottom: '16px',
              textShadow: '0 0 30px red',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              textAlign: 'center'
            }}>遊戲結束</h1>
            <div style={{
              fontSize: 'clamp(1rem, 4vw, 24px)',
              marginBottom: '48px',
              fontFamily: 'monospace',
              borderTop: '1px solid #7f1d1d',
              borderBottom: '1px solid #7f1d1d',
              padding: '16px 0',
              width: '100%',
              maxWidth: '400px',
              textAlign: 'center',
              backgroundColor: 'rgba(127, 29, 29, 0.1)'
            }}>
              時間: <span style={{ color: 'white', marginLeft: '8px', textShadow: '0 0 10px white' }}>{uiState.time}</span>
            </div>
            <button onClick={startGame} style={{
              width: 'min(288px, 80vw)',
              padding: '16px',
              backgroundColor: 'rgba(127, 29, 29, 0.2)',
              border: '2px solid #ef4444',
              color: '#ef4444',
              fontSize: 'clamp(1rem, 3vw, 20px)',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.3s',
              transform: 'skewX(-10deg)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
              e.currentTarget.style.color = 'black';
              e.currentTarget.style.boxShadow = '0 0 40px red';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(127, 29, 29, 0.2)';
              e.currentTarget.style.color = '#ef4444';
              e.currentTarget.style.boxShadow = 'none';
            }}>
              重新開始
            </button>
         </div>
      )}

    </div>
  );
};

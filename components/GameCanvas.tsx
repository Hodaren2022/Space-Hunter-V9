
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
      
      // Allow interactions with UI elements (buttons, inputs, upgrade options, etc.)
      if (target.tagName === 'BUTTON' || 
          target.closest('button') || 
          target.tagName === 'INPUT' ||
          target.closest('[data-ui-element]') ||
          target.closest('.cursor-pointer') ||
          // Check if it's an upgrade option or any clickable UI element
          target.closest('[onclick]') ||
          target.onclick ||
          // Check for React onClick handlers
          target.getAttribute('data-clickable') === 'true') {
        return;
      }
      
      // Prevent default browser scroll/zoom behavior for game control only
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

    // 1. Camera
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
         className="relative w-full h-full font-[Orbitron] touch-none">
      
      <canvas ref={canvasRef} className="block w-full h-full" />

      {/* Tech Corners */}
      <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-cyan-400 pointer-events-none opacity-50"></div>
      <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-cyan-400 pointer-events-none opacity-50"></div>
      <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-cyan-400 pointer-events-none opacity-50"></div>
      <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-cyan-400 pointer-events-none opacity-50"></div>

      <button 
        className="absolute top-5 right-5 bg-black/50 border border-cyan-500 text-cyan-400 px-4 py-2 rounded-none z-50 backdrop-blur-md hover:bg-cyan-900/50 touch-manipulation"
        onClick={() => setShowDev(!showDev)}
        data-ui-element="settings-button"
        style={{ touchAction: 'manipulation' }}
      >
        ⚙️
      </button>

      <button 
        className="absolute top-5 right-20 bg-black/50 border border-neutral-500 text-neutral-400 px-4 py-2 rounded-none z-50 backdrop-blur-md hover:text-white touch-manipulation"
        onClick={toggleMute}
        data-ui-element="mute-button"
        style={{ touchAction: 'manipulation' }}
      >
        {isMuted ? '🔇' : '🔊'}
      </button>

      {showDev && (
        <div className="absolute top-20 right-5 w-80 bg-black/90 border border-cyan-500 p-6 z-50 text-sm shadow-[0_0_20px_rgba(0,243,255,0.2)] max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-neutral-700 pb-3 mb-4">
             <h3 className="text-cyan-400 font-bold uppercase tracking-widest">{t('settings.dev_console', lang)}</h3>
             <button 
              onClick={() => setShowDev(false)} 
              className="text-neutral-400 hover:text-white touch-manipulation"
              data-ui-element="close-button"
              style={{ touchAction: 'manipulation' }}
            >
              ✕
            </button>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between text-neutral-300 mb-2">
               <span>{t('settings.language', lang)}</span>
            </div>
            <button 
              onClick={toggleLang} 
              className="w-full py-2 bg-neutral-900 border border-cyan-800 hover:border-cyan-400 rounded-none text-cyan-300 font-bold touch-manipulation"
              data-ui-element="language-button"
              style={{ touchAction: 'manipulation' }}
            >
               {lang === 'zh' ? '繁體中文' : 'English'}
            </button>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-neutral-300 mb-1">
               <span>{t('settings.bgm', lang)}</span>
               <span className="text-cyan-400 font-mono">{Math.round(bgmVolume * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05" 
              value={bgmVolume} 
              onChange={(e) => handleBgmChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded-none appearance-none cursor-pointer"
            />
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-neutral-300 mb-1">
               <span>{t('settings.sfx', lang)}</span>
               <span className="text-cyan-400 font-mono">{Math.round(sfxVolume * 100)}%</span>
            </div>
            <input 
              type="range" min="0" max="1" step="0.05" 
              value={sfxVolume} 
              onChange={(e) => handleSfxChange(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded-none appearance-none cursor-pointer"
            />
          </div>

          {(['dmg', 'spd', 'frq', 'hp', 'mov', 'exp'] as const).map(k => (
            <div key={k} className="mb-4">
               <div className="flex justify-between text-neutral-300 mb-1">
                 <span>{t(`setting.${k}`, lang)}</span>
                 <span className="text-cyan-400 font-mono">x{devSettings[k].toFixed(1)}</span>
               </div>
               <input 
                 type="range" min="0.5" max="6.0" step="0.1" 
                 value={devSettings[k]} 
                 onChange={(e) => updateDevSetting(k, e.target.value)}
                 className="w-full accent-cyan-500 h-1 bg-neutral-800 rounded-none appearance-none cursor-pointer"
               />
            </div>
          ))}
          <button 
            onClick={() => { 
                setDevSettings(DEFAULT_DEV_SETTINGS); 
                gameState.current.devSettings = DEFAULT_DEV_SETTINGS; 
            }}
            className="w-full py-2 bg-neutral-900 hover:bg-cyan-900 text-white border border-cyan-700 rounded-none mt-2 uppercase touch-manipulation"
            data-ui-element="reset-button"
            style={{ touchAction: 'manipulation' }}
          >
            {t('btn.reset', lang)}
          </button>
        </div>
      )}

      {uiState.isRunning && (
        <div className="absolute top-0 left-0 w-full p-5 flex justify-between pointer-events-none z-10 select-none">
           <div className="w-40 md:w-64">
             <div className="text-cyan-400 font-bold drop-shadow-md mb-1 flex justify-between">
                <span>HP</span>
                <span className="font-mono">{Math.ceil(uiState.hp)}/{Math.ceil(uiState.maxHp)}</span>
             </div>
             <div className="w-full h-4 bg-black border border-cyan-800 relative skew-x-[-15deg]">
                <div className="h-full bg-gradient-to-r from-red-600 to-red-500 transition-all duration-200 shadow-[0_0_10px_red]" style={{ width: `${(uiState.hp / uiState.maxHp) * 100}%` }} />
             </div>
           </div>
           <div className="w-40 md:w-64 text-right mt-16">
             <div className="text-cyan-400 font-bold drop-shadow-md mb-1 flex justify-between">
                 <span className="font-mono">LV.{uiState.level}</span>
                 <span className="text-xs">EXP SYSTEM</span>
             </div>
             <div className="w-full h-2 bg-black border border-cyan-800 relative mb-2">
                <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 transition-all duration-200 shadow-[0_0_10px_cyan]" style={{ width: `${(uiState.exp / uiState.expToNext) * 100}%` }} />
             </div>
             <div className="text-4xl font-bold font-mono text-white drop-shadow-[0_0_10px_cyan]">{uiState.time}</div>
           </div>
           
           <div className="absolute bottom-12 left-1/2 transform -translate-x-1/2 text-cyan-700 text-xs tracking-[0.2em] text-center pointer-events-none w-full animate-pulse">
              SYSTEM ONLINE // {t('ui.drag', lang).toUpperCase()}
           </div>
        </div>
      )}

      {uiState.isLevelUp && (
        <div className="absolute inset-0 bg-black/90 z-40 flex flex-col items-center justify-center backdrop-blur-sm">
           <h2 className="text-4xl text-cyan-400 font-bold mb-8 uppercase tracking-widest drop-shadow-[0_0_20px_cyan]">{t('levelup.title', lang)}</h2>
           <div className="flex flex-wrap gap-6 justify-center p-4">
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
                   <div 
                     key={i} 
                     onClick={() => selectUpgrade(opt)}
                     onTouchStart={(e) => {
                       e.stopPropagation();
                       // Add visual feedback for touch
                       e.currentTarget.style.transform = 'scale(0.95)';
                       e.currentTarget.style.borderColor = '#fbbf24';
                     }}
                     onTouchEnd={(e) => {
                       e.stopPropagation();
                       // Reset visual feedback
                       e.currentTarget.style.transform = '';
                       e.currentTarget.style.borderColor = '';
                       // Trigger the upgrade selection
                       selectUpgrade(opt);
                     }}
                     onTouchCancel={(e) => {
                       e.stopPropagation();
                       // Reset visual feedback on cancel
                       e.currentTarget.style.transform = '';
                       e.currentTarget.style.borderColor = '';
                     }}
                     data-ui-element="upgrade-option"
                     data-clickable="true"
                     className="w-56 bg-black/80 border border-cyan-700 p-6 cursor-pointer hover:scale-105 hover:border-yellow-400 hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] transition-all duration-200 relative group clip-path-polygon touch-manipulation select-none"
                     style={{ touchAction: 'manipulation' }}
                   >
                      <div className="inline-block px-2 py-0.5 bg-cyan-900/30 border border-cyan-500 rounded-none text-[10px] text-cyan-300 mb-3 uppercase pointer-events-none">{t(opt.tagKey, lang)}</div>
                      <h3 className="text-yellow-400 text-lg font-bold mb-2 group-hover:text-white pointer-events-none">{title}</h3>
                      <p className="text-neutral-400 text-xs leading-relaxed font-mono pointer-events-none">{t(opt.descKey, lang)}</p>
                   </div>
                );
             })}
           </div>
        </div>
      )}

      {!uiState.isRunning && !uiState.isGameOver && (
         <div className="absolute inset-0 bg-black z-30 flex flex-col items-center justify-center text-white overflow-hidden">
            {/* Background Glitch Elements */}
            <div className="absolute inset-0 opacity-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgdmlld0JveD0iMCAwIDQwIDQwIj48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSJub25lIi8+PHBhdGggZD0iTTAgNDBoNDBNNDAgMEgwIiBzdHJva2U9IiMwMGYzZmYiIHN0cm9rZS1vcGFjaXR5PSIuMiIvPjwvc3ZnPg==')]"></div>
            
            <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-cyan-600 mb-2 drop-shadow-[0_0_30px_rgba(0,243,255,0.6)] tracking-tighter relative">
              {t('app.title', lang)}
            </h1>
            <p className="text-cyan-700 tracking-[0.5em] text-sm mb-12 animate-pulse">CYBERNETIC WARFARE SIMULATION V9.0</p>
            
            <button 
              onClick={startGame} 
              className="w-72 py-4 bg-cyan-900/20 border-2 border-cyan-500 text-cyan-400 text-xl font-bold uppercase tracking-widest hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_40px_cyan] transition-all duration-300 skew-x-[-10deg] touch-manipulation"
              data-ui-element="start-button"
              style={{ touchAction: 'manipulation' }}
            >
              {t('btn.start', lang)}
            </button>
            <button 
              onClick={() => setShowDev(true)} 
              className="mt-6 w-72 py-3 bg-transparent border border-neutral-700 text-neutral-500 text-sm uppercase hover:text-white hover:border-white transition-all skew-x-[-10deg] touch-manipulation"
              data-ui-element="settings-menu-button"
              style={{ touchAction: 'manipulation' }}
            >
              {t('btn.settings', lang)}
            </button>
         </div>
      )}

      {uiState.isGameOver && (
         <div className="absolute inset-0 bg-black/95 z-30 flex flex-col items-center justify-center text-white">
            <h1 className="text-6xl font-black text-red-600 mb-4 drop-shadow-[0_0_30px_red] tracking-widest uppercase">{t('gameover.title', lang)}</h1>
            <div className="text-2xl mb-12 font-mono border-t border-b border-red-900 py-4 w-full text-center bg-red-900/10">
              {t('gameover.time', lang)} <span className="text-white ml-2 drop-shadow-[0_0_10px_white]">{uiState.time}</span>
            </div>
            <button 
              onClick={startGame} 
              className="w-72 py-4 bg-red-900/20 border-2 border-red-500 text-red-500 text-xl font-bold uppercase tracking-widest hover:bg-red-500 hover:text-black hover:shadow-[0_0_40px_red] transition-all duration-300 skew-x-[-10deg] touch-manipulation"
              data-ui-element="restart-button"
              style={{ touchAction: 'manipulation' }}
            >
              {t('btn.restart', lang)}
            </button>
         </div>
      )}

    </div>
  );
};

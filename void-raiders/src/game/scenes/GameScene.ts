// Escena de gameplay — estilo Interstellar con sistema de audio procedural

import type { Scene, WeaponType } from "../../types";
import type { Game } from "../Game";
import { Bullet } from "../entities/Bullet";
import { Boss } from "../entities/Boss";
import { Enemy } from "../entities/Enemy";
import { Player } from "../entities/Player";
import { Camera } from "../systems/Camera";
import { CollisionSystem } from "../systems/CollisionSystem";
import { ParticleSystem } from "../systems/ParticleSystem";
import { Starfield } from "../systems/Starfield";
import { WaveManager, LEVELS } from "../systems/WaveManager";
import { WeaponSystem } from "../systems/WeaponSystem";
import { HUD } from "../ui/HUD";
import { Pool } from "../../utils/pool";
import { distance, distanceSq, lerpAngle } from "../../utils/math";
import { MenuScene } from "./MenuScene";
import { soundManager } from "../../audio/SoundManager";

const WEAPON_KEYS: Record<string, WeaponType> = {
  Digit1: "laser",
  Digit2: "missiles",
  Digit3: "plasma",
  Digit4: "burst",
};

const COMBO_WINDOW = 2;
const BOMBER_AOE   = 84;

const SHOOT_SOUND_GAP: Record<WeaponType, number> = { laser: 0.12, missiles: 0.35, plasma: 0.45, burst: 0.55 };

type Status = "playing" | "boss" | "cleared" | "gameover";

const BOSS_NAMES = ["VOID HERALD", "GRAVITY LEVIATHAN", "VOID CORE"];

export class GameScene implements Scene {
  private readonly game: Game;
  private readonly starfield = new Starfield(1.6);
  private readonly camera = new Camera();
  private readonly weapons = new WeaponSystem();
  private readonly bullets = new Pool<Bullet>(() => new Bullet(), 128);
  private readonly particles = new ParticleSystem();
  private readonly collisions = new CollisionSystem();
  private readonly waves = new WaveManager();
  private readonly hud = new HUD();
  private player: Player;
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;

  private status: Status = "playing";
  private level: number;
  private score = 0;
  private multiplier = 1;
  private comboCount = 0;
  private comboTimer = 0;
  private comboFlash = 0;
  private time = 0;

  private shootTimers: Record<WeaponType, number> = { laser: 0, missiles: 0, plasma: 0, burst: 0 };

  constructor(game: Game, level = 1) {
    this.game = game;
    this.level = level;
    this.player = new Player(game.width / 2, game.height * 0.82);
  }

  enter(): void {
    soundManager.init();
    soundManager.startAmbient();
    this.starfield.resize(this.game.width, this.game.height);
    this.waves.loadLevel(LEVELS[this.level - 1]);
  }

  exit(): void {
    soundManager.stopAmbient();
  }

  resize(width: number, height: number): void {
    this.starfield.resize(width, height);
  }

  update(dt: number): void {
    const { input } = this.game;
    this.time += dt;
    this.starfield.update(dt);
    this.particles.update(dt);
    this.camera.update(dt);
    if (this.comboFlash > 0) this.comboFlash -= dt;

    for (const k in this.shootTimers) {
      this.shootTimers[k as WeaponType] = Math.max(0, this.shootTimers[k as WeaponType] - dt);
    }

    // Estado terminal
    if (this.status === "cleared" || this.status === "gameover") {
      if (input.wasPressed("Escape")) this.game.changeScene(new MenuScene(this.game));
      if (this.status === "gameover" && input.wasPressed("KeyR")) {
        this.game.changeScene(new GameScene(this.game, this.level));
      }
      if (this.status === "cleared" && (input.wasPressed("Space") || input.wasPressed("Enter"))) {
        if (this.level < LEVELS.length) {
          this.game.changeScene(new GameScene(this.game, this.level + 1));
        } else {
          this.game.changeScene(new MenuScene(this.game));
        }
      }
      return;
    }

    if (input.wasPressed("Escape")) {
      this.game.changeScene(new MenuScene(this.game));
      return;
    }

    for (const code in WEAPON_KEYS) {
      if (input.wasPressed(code)) {
        this.weapons.setWeapon(WEAPON_KEYS[code]);
        soundManager.play('ui_click');
      }
    }

    this.updateCombo(dt);
    this.updatePlayerAndWeapons(dt);
    this.updateBullets(dt);
    this.resolveCollisions();

    if (this.status === "playing") {
      this.updateEnemiesAndWaves(dt);
      this.cleanupEnemies();
      if (this.waves.isComplete && this.enemies.length === 0) {
        this.spawnBossOrClear();
      }
    } else if (this.status === "boss" && this.boss) {
      this.updateBoss(dt);
    }
  }

  // ─── subsistemas ───────────────────────────────────────────────────────────

  private updateCombo(dt: number): void {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.multiplier = 1;
        this.comboCount = 0;
      }
    }
  }

  private updatePlayerAndWeapons(dt: number): void {
    const { input, pointer, width, height } = this.game;
    this.player.update(dt, input, pointer, width, height);
    this.weapons.update(dt);

    if (this.game.pointerDown && this.player.alive) {
      const nose = this.player.nose();
      const fired = this.weapons.tryFire(nose.x, nose.y, this.player.angle, this.bullets);
      if (fired) {
        if (this.weapons.current === "plasma") this.camera.shake(3, 0.1);
        const w = this.weapons.current;
        if (this.shootTimers[w] <= 0) {
          soundManager.play(`shoot_${w}`);
          this.shootTimers[w] = SHOOT_SOUND_GAP[w];
        }
      }
    }
  }

  private updateEnemiesAndWaves(dt: number): void {
    const incoming = this.waves.update(dt, this.enemies.length, this.game.width, this.game.height);
    if (incoming.length) this.enemies.push(...incoming);
    for (const e of this.enemies) e.update(dt, this.player, this.bullets, this.game.width);
  }

  private updateBullets(dt: number): void {
    const { width, height } = this.game;
    const margin = 40;
    for (const b of this.bullets.active) {
      // Misiles guiados: giran suavemente hacia el enemigo más cercano
      if (b.homing && b.friendly && b.alive) {
        const target = this.nearestTarget(b.x, b.y);
        if (target) {
          const desired = Math.atan2(target.y - b.y, target.x - b.x);
          const current = Math.atan2(b.vy, b.vx);
          const steered = lerpAngle(current, desired, 1 - Math.exp(-dt * 4.5));
          const spd = Math.hypot(b.vx, b.vy);
          b.vx = Math.cos(steered) * spd;
          b.vy = Math.sin(steered) * spd;
        }
      }
      b.update(dt);
      if (b.x < -margin || b.x > width + margin || b.y < -margin || b.y > height + margin) {
        b.alive = false;
      }
    }
    this.bullets.sweep((b) => !b.alive);
  }

  private nearestTarget(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = distanceSq(x, y, e.x, e.y);
      if (d < bestDist) { bestDist = d; best = e; }
    }
    if (this.boss?.alive) {
      const d = distanceSq(x, y, this.boss.x, this.boss.y);
      if (d < bestDist) best = this.boss;
    }
    return best;
  }

  private updateBoss(dt: number): void {
    if (!this.boss) return;
    this.boss.update(dt, this.player, this.bullets, this.game.width);

    if (this.boss.phaseJustChanged) {
      this.camera.shake(12, 0.4);
      this.particles.explosion(this.boss.x, this.boss.y, this.boss.color, 35, 320);
    }
  }

  private resolveCollisions(): void {
    // Balas del jugador vs enemigos
    this.collisions.bulletsVsEnemies(this.bullets, this.enemies, (enemy, bullet) => {
      this.particles.spark(bullet.x, bullet.y, bullet.color, 5);
      soundManager.play('enemy_hit');
      if (enemy.takeDamage(bullet.damage)) this.onEnemyKilled(enemy);
    });

    // Balas del jugador vs boss
    if (this.boss?.alive) {
      this.collisions.bulletsVsCircle(this.bullets, this.boss.x, this.boss.y, this.boss.radius, (b) => {
        this.particles.spark(b.x, b.y, b.color, 5);
        if (this.boss!.takeDamage(b.damage)) this.onBossKilled();
      });
      // Contacto directo boss-jugador
      if (!this.player.isInvulnerable && this.player.alive) {
        const d2 = distanceSq(this.boss.x, this.boss.y, this.player.x, this.player.y);
        const minDist = this.boss.radius + this.player.radius;
        if (d2 < minDist * minDist) this.hitPlayer();
      }
    }

    // Balas enemigas vs jugador
    this.collisions.enemyBulletsVsPlayer(this.bullets, this.player, () => this.hitPlayer());

    // Contacto enemigo-jugador
    this.collisions.enemiesVsPlayer(this.enemies, this.player, (enemy) => {
      this.hitPlayer();
      enemy.alive = false;
    });
  }

  private cleanupEnemies(): void {
    for (const e of this.enemies) {
      if (!e.alive && !e.scored) this.onEnemyKilled(e);
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  private spawnBossOrClear(): void {
    const levelDef = LEVELS[this.level - 1];
    if (levelDef.boss) {
      this.boss = new Boss(this.game.width / 2, -80, this.level);
      this.status = "boss";
      this.camera.shake(8, 0.4);
    } else {
      this.status = "cleared";
    }
  }

  // ─── eventos ───────────────────────────────────────────────────────────────

  private onEnemyKilled(enemy: Enemy): void {
    if (enemy.scored) return;
    enemy.scored = true;

    const heavy = enemy.type === "tank";
    this.particles.explosion(enemy.x, enemy.y, enemy.color, heavy ? 30 : 18, heavy ? 280 : 220);
    this.particles.explosion(enemy.x, enemy.y, "#f8c860", heavy ? 14 : 8, heavy ? 160 : 100);
    this.camera.shake(heavy ? 7 : 4, 0.18);
    soundManager.play(heavy ? 'explosion_large' : 'explosion_small');

    if (enemy.isAoe) {
      this.particles.explosion(enemy.x, enemy.y, "#e07030", 26, 320);
      this.particles.explosion(enemy.x, enemy.y, "#f8c860", 12, 280);
      this.camera.shake(8, 0.25);
      soundManager.play('explosion_large');
      if (distance(this.player.x, this.player.y, enemy.x, enemy.y) < BOMBER_AOE) {
        this.hitPlayer();
      }
    }

    this.addKill(enemy.points);
  }

  private onBossKilled(): void {
    if (!this.boss || this.boss.scored) return;
    this.boss.scored = true;
    this.particles.explosion(this.boss.x, this.boss.y, this.boss.color, 60, 380);
    this.particles.explosion(this.boss.x, this.boss.y, "#ffffff", 30, 500);
    this.camera.shake(16, 0.6);
    soundManager.play('explosion_large');
    this.addKill(this.boss.points);
    this.status = "cleared";
  }

  private addKill(points: number): void {
    this.comboCount += 1;
    this.comboTimer = COMBO_WINDOW;
    const newMult = Math.min(5, 1 + Math.floor(this.comboCount / 2));
    if (newMult > this.multiplier) {
      this.multiplier = newMult;
      this.comboFlash = 1;
      soundManager.play('combo');
    }
    this.score += points * this.multiplier;
  }

  private hitPlayer(): void {
    if (this.player.isInvulnerable || !this.player.alive) return;
    const died = this.player.takeDamage();
    this.camera.shake(8, 0.3);
    this.multiplier = 1;
    this.comboCount = 0;
    soundManager.play('player_hit');
    if (died) this.status = "gameover";
  }

  // ─── render ────────────────────────────────────────────────────────────────

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    ctx.fillStyle = "#020408";
    ctx.fillRect(0, 0, w, h);

    this.starfield.renderNebula(ctx);
    this.starfield.render(ctx);

    this.camera.begin(ctx);
    for (const b of this.bullets.active) b.render(ctx);
    for (const e of this.enemies) e.render(ctx);
    if (this.boss?.alive) this.boss.render(ctx);
    this.particles.render(ctx);
    if (this.player.alive) this.player.render(ctx, this.weapons.color);
    this.camera.end(ctx);

    this.hud.render(ctx, w, h, {
      score:          this.score,
      level:          this.level,
      levelName:      LEVELS[this.level - 1].name,
      wave:           this.waves.waveNumber,
      totalWaves:     this.waves.totalWaves,
      lives:          this.player.lives,
      weapon:         this.weapons.current,
      weaponColor:    this.weapons.color,
      multiplier:     this.multiplier,
      ammo:           this.weapons.ammo,
      maxAmmo:        this.weapons.maxAmmo,
      isReloading:    this.weapons.isReloading,
      reloadProgress: this.weapons.reloadProgress,
      ...(this.boss ? {
        bossHp:    this.boss.hp,
        bossMaxHp: this.boss.maxHp,
        bossPhase: this.boss.phase,
        bossColor: this.boss.color,
        bossName:  BOSS_NAMES[(this.level - 1) % BOSS_NAMES.length],
      } : {}),
    });

    if (this.comboFlash > 0 && this.multiplier > 1) this.renderComboFlash(ctx, w, h);
    if (this.status === "cleared" || this.status === "gameover") this.renderOverlay(ctx, w, h);

    this.renderVignette(ctx, w, h);
  }

  private renderComboFlash(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.comboFlash);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 44px 'Orbitron', sans-serif";
    ctx.fillStyle = "#f0c030";
    ctx.shadowColor = "#e8a030";
    ctx.shadowBlur = 20;
    ctx.fillText(`× ${this.multiplier}  COMBO`, w / 2, h / 2 - 130);
    ctx.restore();
  }

  private renderOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(2,4,10,0.78)";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (this.status === "gameover") {
      ctx.font = "900 68px 'Orbitron', sans-serif";
      ctx.fillStyle = "#cc2030";
      ctx.shadowColor = "#cc2030";
      ctx.shadowBlur = 32;
      ctx.fillText("MISSION FAILED", w / 2, h / 2 - 50);
      ctx.shadowBlur = 0;

      ctx.font = "400 16px 'Exo 2', sans-serif";
      ctx.fillStyle = "#887766";
      ctx.fillText("\"They say we won't survive the void.\"", w / 2, h / 2);
    } else {
      ctx.font = "900 58px 'Orbitron', sans-serif";
      ctx.fillStyle = "#e8a840";
      ctx.shadowColor = "#e8a840";
      ctx.shadowBlur = 28;
      ctx.fillText("SECTOR CLEARED", w / 2, h / 2 - 50);
      ctx.shadowBlur = 0;
    }

    ctx.font = "700 24px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#f0e8d0";
    ctx.fillText(this.score.toString().padStart(8, "0"), w / 2, h / 2 + 26);

    ctx.font = "400 13px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#667788";
    ctx.letterSpacing = "2px";
    const hint = this.status === "gameover"
      ? "R  RETRY  ·  ESC  MENU"
      : this.level < LEVELS.length
        ? "SPACE  NEXT SECTOR  ·  ESC  MENU"
        : "ESC  MENU";
    ctx.fillText(hint, w / 2, h / 2 + 68);
    ctx.letterSpacing = "0px";
    ctx.restore();
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 2.3, w / 2, h / 2, Math.max(w, h) / 1.05);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

// Escena de gameplay: nave, armas, enemigos, oleadas, colisiones y score

import type { Scene, WeaponType } from "../../types";
import type { Game } from "../Game";
import { Bullet } from "../entities/Bullet";
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
import { distance } from "../../utils/math";
import { MenuScene } from "./MenuScene";

const WEAPON_KEYS: Record<string, WeaponType> = {
  Digit1: "laser",
  Digit2: "missiles",
  Digit3: "plasma",
  Digit4: "burst",
};

const COMBO_WINDOW = 2; // segundos para encadenar combo
const BOMBER_AOE = 84; // radio de la explosión del bomber

type Status = "playing" | "cleared" | "gameover";

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

  private status: Status = "playing";
  private level = 1;
  private score = 0;
  private multiplier = 1;
  private comboCount = 0;
  private comboTimer = 0;
  private comboFlash = 0;

  constructor(game: Game) {
    this.game = game;
    this.player = new Player(game.width / 2, game.height / 2);
  }

  enter(): void {
    this.starfield.resize(this.game.width, this.game.height);
    this.waves.loadLevel(LEVELS[this.level - 1]);
  }

  resize(width: number, height: number): void {
    this.starfield.resize(width, height);
  }

  update(dt: number): void {
    const { input } = this.game;
    this.starfield.update(dt);
    this.particles.update(dt);
    this.camera.update(dt);
    if (this.comboFlash > 0) this.comboFlash -= dt;

    if (this.status !== "playing") {
      if (input.wasPressed("Escape")) this.game.changeScene(new MenuScene(this.game));
      if (this.status === "gameover" && input.wasPressed("KeyR")) {
        this.game.changeScene(new GameScene(this.game));
      }
      return;
    }

    if (input.wasPressed("Escape")) {
      this.game.changeScene(new MenuScene(this.game));
      return;
    }

    // cambio de arma (provisional con teclas; por voz en la Etapa 5)
    for (const code in WEAPON_KEYS) {
      if (input.wasPressed(code)) this.weapons.setWeapon(WEAPON_KEYS[code]);
    }

    this.updateCombo(dt);
    this.updatePlayerAndWeapons(dt);
    this.updateEnemiesAndWaves(dt);
    this.updateBullets(dt);
    this.resolveCollisions();
    this.cleanupEnemies();

    if (this.waves.isComplete && this.enemies.length === 0) {
      this.status = "cleared";
    }
  }

  // --- subsistemas -----------------------------------------------------------

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
      if (fired && this.weapons.current === "plasma") this.camera.shake(3, 0.1);
    }
  }

  private updateEnemiesAndWaves(dt: number): void {
    const incoming = this.waves.update(dt, this.enemies.length, this.game.width, this.game.height);
    if (incoming.length) this.enemies.push(...incoming);
    for (const e of this.enemies) e.update(dt, this.player, this.bullets);
  }

  private updateBullets(dt: number): void {
    const { width, height } = this.game;
    const margin = 40;
    for (const b of this.bullets.active) {
      b.update(dt);
      if (b.x < -margin || b.x > width + margin || b.y < -margin || b.y > height + margin) {
        b.alive = false;
      }
    }
    this.bullets.sweep((b) => !b.alive);
  }

  private resolveCollisions(): void {
    // balas del jugador vs enemigos
    this.collisions.bulletsVsEnemies(this.bullets, this.enemies, (enemy, bullet) => {
      this.particles.spark(bullet.x, bullet.y, bullet.color, 5);
      if (enemy.takeDamage(bullet.damage)) this.onEnemyKilled(enemy);
    });

    // balas enemigas vs jugador
    this.collisions.enemyBulletsVsPlayer(this.bullets, this.player, () => this.hitPlayer());

    // contacto enemigo-jugador
    this.collisions.enemiesVsPlayer(this.enemies, this.player, () => this.hitPlayer());
  }

  private cleanupEnemies(): void {
    // bombers que detonaron por proximidad (no marcados por balas)
    for (const e of this.enemies) {
      if (!e.alive && !e.scored) this.onEnemyKilled(e);
    }
    this.enemies = this.enemies.filter((e) => e.alive);
  }

  // --- eventos ---------------------------------------------------------------

  private onEnemyKilled(enemy: Enemy): void {
    if (enemy.scored) return;
    enemy.scored = true;

    const heavy = enemy.type === "tank";
    this.particles.explosion(enemy.x, enemy.y, enemy.color, heavy ? 30 : 18, heavy ? 280 : 220);
    this.camera.shake(heavy ? 7 : 4, 0.18);

    if (enemy.isAoe) {
      this.particles.explosion(enemy.x, enemy.y, "#ffaa33", 26, 320);
      this.camera.shake(8, 0.25);
      if (distance(this.player.x, this.player.y, enemy.x, enemy.y) < BOMBER_AOE) {
        this.hitPlayer();
      }
    }

    this.addKill(enemy.points);
  }

  private addKill(points: number): void {
    this.comboCount += 1;
    this.comboTimer = COMBO_WINDOW;
    const newMult = Math.min(5, 1 + Math.floor(this.comboCount / 2));
    if (newMult > this.multiplier) {
      this.multiplier = newMult;
      this.comboFlash = 1;
    }
    this.score += points * this.multiplier;
  }

  private hitPlayer(): void {
    if (this.player.isInvulnerable || !this.player.alive) return;
    const died = this.player.takeDamage();
    this.camera.shake(8, 0.3);
    this.multiplier = 1;
    this.comboCount = 0;
    if (died) this.status = "gameover";
  }

  // --- render ----------------------------------------------------------------

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.2);
    grad.addColorStop(0, "#0d1326");
    grad.addColorStop(1, "#0a0a0f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    this.starfield.render(ctx);

    this.camera.begin(ctx);
    for (const b of this.bullets.active) b.render(ctx);
    for (const e of this.enemies) e.render(ctx);
    this.particles.render(ctx);
    if (this.player.alive) this.player.render(ctx, this.weapons.color);
    this.camera.end(ctx);

    this.hud.render(ctx, w, {
      score: this.score,
      level: this.level,
      levelName: LEVELS[this.level - 1].name,
      wave: this.waves.waveNumber,
      totalWaves: this.waves.totalWaves,
      lives: this.player.lives,
      weapon: this.weapons.current,
      weaponColor: this.weapons.color,
      multiplier: this.multiplier,
    });

    if (this.comboFlash > 0 && this.multiplier > 1) this.renderComboFlash(ctx, w, h);
    if (this.status !== "playing") this.renderOverlay(ctx, w, h);

    this.renderVignette(ctx, w, h);
  }

  private renderComboFlash(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.comboFlash);
    ctx.textAlign = "center";
    ctx.font = "700 40px 'Orbitron', sans-serif";
    ctx.fillStyle = "#ffff00";
    ctx.shadowColor = "#ffaa00";
    ctx.shadowBlur = 16;
    ctx.fillText(`x${this.multiplier} COMBO!`, w / 2, h / 2 - 120);
    ctx.restore();
  }

  private renderOverlay(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.save();
    ctx.fillStyle = "rgba(5,6,12,0.7)";
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = "center";

    if (this.status === "gameover") {
      ctx.font = "900 64px 'Orbitron', sans-serif";
      ctx.fillStyle = "#ff2050";
      ctx.shadowColor = "#ff2050";
      ctx.shadowBlur = 24;
      ctx.fillText("GAME OVER", w / 2, h / 2 - 40);
    } else {
      ctx.font = "900 56px 'Orbitron', sans-serif";
      ctx.fillStyle = "#00ffff";
      ctx.shadowColor = "#00ffff";
      ctx.shadowBlur = 24;
      ctx.fillText("LEVEL CLEARED", w / 2, h / 2 - 40);
    }

    ctx.shadowBlur = 0;
    ctx.font = "700 22px 'Orbitron', sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(`SCORE  ${this.score.toString().padStart(7, "0")}`, w / 2, h / 2 + 20);

    ctx.font = "400 15px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#9fb3cc";
    const hint =
      this.status === "gameover"
        ? "R reiniciar · ESC menú"
        : "ESC menú · (siguiente nivel en la Etapa 4)";
    ctx.fillText(hint, w / 2, h / 2 + 60);
    ctx.restore();
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 2.5, w / 2, h / 2, Math.max(w, h) / 1.1);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

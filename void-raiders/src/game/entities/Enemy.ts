// Enemigos geométricos: factory + comportamiento por tipo

import type { EnemyType } from "../../types";
import type { Bullet } from "./Bullet";
import type { Player } from "./Player";
import type { Pool } from "../../utils/pool";
import { TAU, vecFromAngle } from "../../utils/math";

interface EnemyStats {
  hp: number;
  speed: number; // px/s
  radius: number;
  color: string;
  points: number;
  fireRate: number; // segundos entre disparos (0 = no dispara)
  aoe: boolean; // explota en área al morir (bomber)
}

const NORMAL = 110;

// Paleta Interstellar: colores más cinematográficos, menos neon puro
export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  basic:  { hp: 2, speed: NORMAL,        radius: 14, color: "#cc2033", points: 100, fireRate: 3.6, aoe: false },
  fast:   { hp: 1, speed: NORMAL * 1.8,  radius: 11, color: "#d07820", points: 150, fireRate: 0,   aoe: false },
  elite:  { hp: 3, speed: NORMAL * 0.85, radius: 16, color: "#a82848", points: 200, fireRate: 2.8, aoe: false },
  hunter: { hp: 2, speed: NORMAL * 1.5,  radius: 12, color: "#38a0b8", points: 175, fireRate: 2.6, aoe: false },
  tank:   { hp: 5, speed: NORMAL * 0.5,  radius: 22, color: "#7040b0", points: 300, fireRate: 3.8, aoe: false },
  sniper: { hp: 3, speed: 60,            radius: 15, color: "#208866", points: 250, fireRate: 4.2, aoe: false },
  bomber: { hp: 3, speed: NORMAL,        radius: 15, color: "#c04800", points: 200, fireRate: 0,   aoe: true  },
};

const ENEMY_BULLET  = "#e06050";
const SNIPER_BULLET = "#50cc88";

export class Enemy {
  type: EnemyType = "basic";
  x = 0;
  y = 0;
  hp = 1;
  maxHp = 1;
  radius = 14;
  color = "#ff0040";
  points = 100;
  alive = true;
  /** true si murió por proximidad/explosión propia (bomber). */
  detonated = false;
  /** true cuando la escena ya contabilizó su muerte (score/partículas). */
  scored = false;

  private speed = NORMAL;
  private fireRate = 0;
  private fireTimer = 0;
  private phase = 0; // para zigzag/sine
  private anchorY = 0; // línea de combate (objetivo vertical)
  private homeX = 0; // centro de patrulla horizontal
  private facingAngle = Math.PI / 2;
  private hitFlash = 0;
  private damageWobble = 0;

  spawn(type: EnemyType, x: number, y: number, anchorY: number): void {
    const s = ENEMY_STATS[type];
    this.type = type;
    this.x = x;
    this.y = y;
    this.hp = s.hp;
    this.maxHp = s.hp;
    this.radius = s.radius;
    this.color = s.color;
    this.points = s.points;
    this.speed = s.speed;
    this.fireRate = s.fireRate;
    this.fireTimer = s.fireRate * (0.5 + Math.random() * 0.5);
    this.phase = Math.random() * TAU;
    this.anchorY = anchorY;
    this.homeX = x;
    this.alive = true;
    this.detonated = false;
    this.scored = false;
    this.hitFlash = 0;
    this.damageWobble = 0;
  }

  /** Enemigos con 2+ HP de máximo (blindados). */
  get isArmored(): boolean {
    return this.maxHp >= 2;
  }

  get isAoe(): boolean {
    return ENEMY_STATS[this.type].aoe;
  }

  /** Aplica daño. Devuelve true si murió. */
  takeDamage(dmg: number): boolean {
    this.hp -= dmg;
    this.hitFlash = 0.22;
    this.damageWobble = 1;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt: number, player: Player, bullets: Pool<Bullet>, width: number): void {
    this.phase += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.damageWobble *= Math.exp(-dt * 14);
    const ang = Math.atan2(player.y - this.y, player.x - this.x);
    this.facingAngle = ang;

    switch (this.type) {
      case "basic":
        // baja a su línea de combate y patrulla de lado a lado
        this.holdLine(dt, width, 70);
        break;
      case "fast": {
        // intercepta al jugador con una oscilación lateral suave
        const perp = ang + Math.PI / 2;
        const wobble = Math.sin(this.phase * 3.5) * 55;
        this.x += (Math.cos(ang) * this.speed + Math.cos(perp) * wobble) * dt;
        this.y += (Math.sin(ang) * this.speed + Math.sin(perp) * wobble) * dt;
        break;
      }
      case "elite":
        this.holdLine(dt, width, 58);
        break;
      case "hunter": {
        const perp = ang + Math.PI / 2;
        const weave = Math.sin(this.phase * 4.2) * 42;
        this.x += (Math.cos(ang) * this.speed * 0.92 + Math.cos(perp) * weave) * dt;
        this.y += (Math.sin(ang) * this.speed * 0.92 + Math.sin(perp) * weave) * dt;
        break;
      }
      case "tank":
        // sostiene una línea baja, patrulla corta y pesada
        this.holdLine(dt, width, 45);
        break;
      case "sniper":
        // baja hasta su ancla (con frenado suave) y se queda estático
        if (this.y < this.anchorY) {
          this.y += Math.min(this.speed, (this.anchorY - this.y) * 3) * dt;
        }
        break;
      case "bomber":
        // kamikaze: embiste y explota en área al contacto
        this.x += Math.cos(ang) * this.speed * dt;
        this.y += Math.sin(ang) * this.speed * dt;
        this.contactDetonate(player);
        break;
    }

    // disparo
    if (this.fireRate > 0) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.fireRate;
        this.shoot(ang, bullets);
      }
    }
  }

  /**
   * Desciende a su línea de combate (`anchorY`) y patrulla de lado a lado en
   * torno a su posición de origen (`homeX`). No converge sobre el jugador, así
   * el fuego queda repartido y es esquivable.
   */
  private holdLine(dt: number, width: number, amp: number): void {
    if (this.y < this.anchorY) {
      this.y += Math.min(this.speed, (this.anchorY - this.y) * 3) * dt;
    } else {
      this.y = this.anchorY + Math.sin(this.phase * 1.4) * 12;
    }
    this.x = this.homeX + Math.sin(this.phase * 0.9) * amp;
    this.x = Math.max(this.radius, Math.min(width - this.radius, this.x));
  }

  private contactDetonate(player: Player): void {
    const dist = Math.hypot(player.x - this.x, player.y - this.y);
    if (dist < this.radius + player.radius + 6) {
      this.alive = false;
      this.detonated = true;
    }
  }

  private shoot(ang: number, bullets: Pool<Bullet>): void {
    const fire = (a: number, speed: number, color: string, radius: number): void => {
      const v = vecFromAngle(a, speed);
      bullets.obtain().init(this.x, this.y, v.x, v.y, {
        radius,
        damage: 1,
        color,
        friendly: false,
        life: 5,
      });
    };

    // pequeña imprecisión: el fuego es esquivable moviéndose
    const jitter = (Math.random() - 0.5) * 0.22;
    switch (this.type) {
      case "basic":
      case "elite":
        fire(ang + jitter, 150, ENEMY_BULLET, 4);
        break;
      case "hunter":
        fire(ang + jitter * 0.6, 175, ENEMY_BULLET, 3);
        fire(ang + jitter * 0.6 + 0.12, 165, ENEMY_BULLET, 3);
        break;
      case "tank":
        for (let i = -1; i <= 1; i++) fire(ang + i * 0.18 + jitter, 150, ENEMY_BULLET, 4);
        break;
      case "sniper":
        fire(ang, 340, SNIPER_BULLET, 3);
        break;
      default:
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    const wobble = this.damageWobble * Math.sin(this.phase * 22) * 0.06;
    ctx.scale(1 + wobble, 1 - wobble * 0.45);
    ctx.rotate(this.facingAngle - Math.PI / 2);

    const r = this.radius;
    const accent = this.color;
    const hull = this.darken(accent, 0.55);
    const glow = this.lighten(accent, 0.25);

    ctx.shadowColor = accent;
    ctx.shadowBlur = 14;
    ctx.fillStyle = accent;
    ctx.strokeStyle = hull;
    ctx.lineWidth = 1.1;

    switch (this.type) {
      case "basic":
        this.drawBasicFighter(ctx, r, accent, hull, glow);
        break;
      case "fast":
        this.drawInterceptor(ctx, r, accent, hull, glow);
        break;
      case "elite":
        this.drawEliteFighter(ctx, r, accent, hull, glow);
        break;
      case "hunter":
        this.drawHunter(ctx, r, accent, hull, glow);
        break;
      case "tank":
        this.drawGunship(ctx, r, accent, hull, glow);
        break;
      case "sniper":
        this.drawSniperNeedle(ctx, r, accent, hull, glow);
        break;
      case "bomber":
        this.drawBomber(ctx, r, accent, hull, glow);
        break;
    }

    if (this.isArmored) {
      this.renderArmorAura(ctx, r, accent, glow);
    }

    if (this.hitFlash > 0) {
      ctx.globalAlpha = this.hitFlash * 2.8;
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.05, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (this.maxHp > 1 && this.hp < this.maxHp) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * (this.hp / this.maxHp));
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Anillo orbital + escudos — solo enemigos blindados (2+ HP). */
  private renderArmorAura(
    ctx: CanvasRenderingContext2D,
    r: number,
    accent: string,
    glow: string,
  ): void {
    const pulse = 0.5 + 0.5 * Math.sin(this.phase * 3.8);
    const ringR = r + 9 + pulse * 4;
    const shield = this.lighten(accent, 0.35);

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = shield;
    ctx.lineWidth = 1.4;
    ctx.globalAlpha = 0.22 + pulse * 0.18;
    ctx.setLineDash([5, 7]);
    ctx.lineDashOffset = -this.phase * 48;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    const pipCount = Math.min(this.maxHp, 5);
    for (let i = 0; i < pipCount; i++) {
      const alive = i < this.hp;
      const a = this.phase * 2.2 + (i / pipCount) * TAU;
      const dist = r + 11 + pulse * 2;
      const px = Math.cos(a) * dist;
      const py = Math.sin(a) * dist;
      ctx.globalAlpha = alive ? 0.55 + pulse * 0.35 : 0.2;
      ctx.fillStyle = alive ? glow : "#445566";
      ctx.shadowColor = alive ? glow : "transparent";
      ctx.shadowBlur = alive ? 8 : 0;
      ctx.beginPath();
      ctx.arc(px, py, alive ? 3 : 2, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Caza estándar — alas en flecha, morro afilado. */
  private drawBasicFighter(
    ctx: CanvasRenderingContext2D,
    r: number,
    fill: string,
    hull: string,
    glow: string,
  ): void {
    this.drawEnginePlume(ctx, r, -0.82, glow, 0.7, 1);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-0.78 * r, 0.18 * r);
    ctx.lineTo(-0.58 * r, -0.62 * r);
    ctx.lineTo(0, -0.88 * r);
    ctx.lineTo(0.58 * r, -0.62 * r);
    ctx.lineTo(0.78 * r, 0.18 * r);
    ctx.closePath();
    ctx.fill();
    this.outlinePath(ctx, hull, 0.5);
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.moveTo(0, 0.72 * r);
    ctx.lineTo(-0.18 * r, 0.28 * r);
    ctx.lineTo(0.18 * r, 0.28 * r);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Élite — caza reforzado con placas laterales. */
  private drawEliteFighter(
    ctx: CanvasRenderingContext2D,
    r: number,
    fill: string,
    hull: string,
    glow: string,
  ): void {
    this.drawEnginePlume(ctx, r, -0.8, glow, 0.75, 0.9);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-0.88 * r, 0.28 * r);
    ctx.lineTo(-0.72 * r, -0.55 * r);
    ctx.lineTo(-0.38 * r, -0.78 * r);
    ctx.lineTo(0, -0.9 * r);
    ctx.lineTo(0.38 * r, -0.78 * r);
    ctx.lineTo(0.72 * r, -0.55 * r);
    ctx.lineTo(0.88 * r, 0.28 * r);
    ctx.closePath();
    ctx.fill();
    this.outlinePath(ctx, hull, 0.5);
    ctx.fillStyle = hull;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(-0.95 * r, -0.05 * r, 0.28 * r, 0.38 * r);
    ctx.fillRect(0.67 * r, -0.05 * r, 0.28 * r, 0.38 * r);
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(-0.82 * r, 0.12 * r, 0.1 * r, 0, TAU);
    ctx.arc(0.82 * r, 0.12 * r, 0.1 * r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Cazador — perfil asimétrico, estabilizador largo. */
  private drawHunter(
    ctx: CanvasRenderingContext2D,
    r: number,
    fill: string,
    hull: string,
    glow: string,
  ): void {
    this.drawEnginePlume(ctx, r, -0.75, glow, 0.8, 0.8, -0.15 * r);
    this.drawEnginePlume(ctx, r, -0.68, glow, 0.5, 0.45, 0.22 * r);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-0.55 * r, 0.1 * r);
    ctx.lineTo(-0.35 * r, -0.7 * r);
    ctx.lineTo(0.08 * r, -0.85 * r);
    ctx.lineTo(0.48 * r, -0.35 * r);
    ctx.lineTo(0.35 * r, 0.35 * r);
    ctx.closePath();
    ctx.fill();
    this.outlinePath(ctx, hull, 0.52);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0.12 * r, 0.5 * r);
    ctx.lineTo(0.42 * r, -0.2 * r);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Interceptor — delta estrecha, motor único brillante. */
  private drawInterceptor(
    ctx: CanvasRenderingContext2D,
    r: number,
    fill: string,
    hull: string,
    glow: string,
  ): void {
    this.drawEnginePlume(ctx, r, -0.72, glow, 0.85, 0.75);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-0.42 * r, -0.22 * r);
    ctx.lineTo(-0.1 * r, -0.78 * r);
    ctx.lineTo(0.1 * r, -0.78 * r);
    ctx.lineTo(0.42 * r, -0.22 * r);
    ctx.closePath();
    ctx.fill();
    this.outlinePath(ctx, hull, 0.55);
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(0, 0.55 * r);
    ctx.lineTo(0, -0.45 * r);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /** Cañonera pesada — fuselaje ancho, torretas laterales. */
  private drawGunship(
    ctx: CanvasRenderingContext2D,
    r: number,
    fill: string,
    hull: string,
    glow: string,
  ): void {
    for (const sx of [-0.72, 0.72]) {
      this.drawEnginePlume(ctx, r, -0.78, glow, 0.55, 0.55, sx * r);
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-0.95 * r, 0.42 * r);
    ctx.lineTo(-0.95 * r, -0.18 * r);
    ctx.lineTo(-0.55 * r, -0.82 * r);
    ctx.lineTo(0.55 * r, -0.82 * r);
    ctx.lineTo(0.95 * r, -0.18 * r);
    ctx.lineTo(0.95 * r, 0.42 * r);
    ctx.closePath();
    ctx.fill();
    this.outlinePath(ctx, hull, 0.45);
    ctx.fillStyle = hull;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(-0.22 * r, -0.35 * r, 0.44 * r, 0.55 * r);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(-0.62 * r, 0.08 * r, 0.14 * r, 0, TAU);
    ctx.arc(0.62 * r, 0.08 * r, 0.14 * r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Francotirador — aguja larga con estabilizadores. */
  private drawSniperNeedle(
    ctx: CanvasRenderingContext2D,
    r: number,
    fill: string,
    hull: string,
    glow: string,
  ): void {
    this.drawEnginePlume(ctx, r, -0.92, glow, 0.6, 0.65);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-0.14 * r, 0.48 * r);
    ctx.lineTo(-0.14 * r, -0.12 * r);
    ctx.lineTo(-0.38 * r, -0.22 * r);
    ctx.lineTo(-0.14 * r, -0.58 * r);
    ctx.lineTo(0, -0.95 * r);
    ctx.lineTo(0.14 * r, -0.58 * r);
    ctx.lineTo(0.38 * r, -0.22 * r);
    ctx.lineTo(0.14 * r, -0.12 * r);
    ctx.lineTo(0.14 * r, 0.48 * r);
    ctx.closePath();
    ctx.fill();
    this.outlinePath(ctx, hull, 0.55);
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(0, 0.78 * r, 0.12 * r, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Bombardero — cuerpo robusto, bahía central, motores en las alas. */
  private drawBomber(
    ctx: CanvasRenderingContext2D,
    r: number,
    fill: string,
    hull: string,
    glow: string,
  ): void {
    for (const sx of [-0.62, 0.62]) {
      this.drawEnginePlume(ctx, r, -0.68, glow, 0.65, 0.6, sx * r);
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-0.68 * r, 0.52 * r);
    ctx.lineTo(-0.82 * r, 0.05 * r);
    ctx.lineTo(-0.62 * r, -0.48 * r);
    ctx.lineTo(-0.32 * r, -0.72 * r);
    ctx.lineTo(0.32 * r, -0.72 * r);
    ctx.lineTo(0.62 * r, -0.48 * r);
    ctx.lineTo(0.82 * r, 0.05 * r);
    ctx.lineTo(0.68 * r, 0.52 * r);
    ctx.closePath();
    ctx.fill();
    this.outlinePath(ctx, hull, 0.48);
    ctx.fillStyle = hull;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(0, 0.15 * r, 0.22 * r, 0.32 * r, 0, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawEnginePlume(
    ctx: CanvasRenderingContext2D,
    r: number,
    back: number,
    glow: string,
    alpha: number,
    scale: number,
    offsetX = 0,
  ): void {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 12;
    const y0 = back * r;
    const len = 0.28 * r * scale;
    ctx.beginPath();
    ctx.moveTo(offsetX - 0.12 * r, y0);
    ctx.lineTo(offsetX, y0 - len);
    ctx.lineTo(offsetX + 0.12 * r, y0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private outlinePath(ctx: CanvasRenderingContext2D, hull: string, alpha: number): void {
    ctx.strokeStyle = hull;
    ctx.lineWidth = 0.9;
    ctx.globalAlpha = alpha;
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private darken(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, ((n >> 16) & 255) * (1 - amt)) | 0;
    const g = Math.max(0, ((n >> 8) & 255) * (1 - amt)) | 0;
    const b = Math.max(0, (n & 255) * (1 - amt)) | 0;
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  private lighten(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * amt) | 0;
    const g = Math.min(255, ((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * amt) | 0;
    const b = Math.min(255, (n & 255) + (255 - (n & 255)) * amt) | 0;
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }
}

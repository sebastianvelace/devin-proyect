// Boss final con 3 fases: patrulla + spread, aimed shots, espiral + minions

import type { EnemyType } from "../../types";
import type { Player } from "./Player";
import type { Bullet } from "./Bullet";
import type { Pool } from "../../utils/pool";
import { TAU, vecFromAngle } from "../../utils/math";

export const BOSS_MINION_CAP = 6;

const PHASE_THRESHOLDS = [0.67, 0.33];
const INTRO_DURATION = 2.2; // segundos de entrada dramática desde arriba

export class Boss {
  x: number;
  y = -80;
  hp: number;
  readonly maxHp: number;
  readonly radius = 50;
  readonly points: number;
  alive = true;
  scored = false;
  color = "#cc00ff";

  /** Se pone a true el frame en que cambia de fase — GameScene lo usa para efectos. */
  phaseJustChanged = false;

  private time = 0;
  private introTimer = INTRO_DURATION;
  private prevPhase = 1;
  // fireTimers[0]=spread, [1]=aimed, [2]=spiral — arranca con delay inicial
  private readonly fireTimers = [1.8, 1.2, 0.0];
  private minionTimer = 3;

  constructor(x: number, _y: number, level: number) {
    this.x = x;
    this.maxHp = 80 + (level - 1) * 60;
    this.hp = this.maxHp;
    this.points = 2000 * level;
  }

  get hpRatio(): number { return Math.max(0, this.hp / this.maxHp); }

  get phase(): number {
    if (this.hpRatio > PHASE_THRESHOLDS[0]) return 1;
    if (this.hpRatio > PHASE_THRESHOLDS[1]) return 2;
    return 3;
  }

  get isIntro(): boolean { return this.introTimer > 0; }

  takeDamage(dmg: number): boolean {
    this.hp = Math.max(0, this.hp - dmg);
    if (this.hp <= 0) { this.alive = false; return true; }
    return false;
  }

  update(dt: number, player: Player, bullets: Pool<Bullet>, width: number): void {
    this.time += dt;
    this.phaseJustChanged = false;

    // Intro: vuela desde arriba con easing cúbico
    if (this.introTimer > 0) {
      this.introTimer -= dt;
      const t = 1 - this.introTimer / INTRO_DURATION;
      const ease = 1 - Math.pow(1 - t, 3);
      this.y = -80 + ease * 170;
      this.x = width / 2;
      return;
    }

    // Detección de cambio de fase
    const ph = this.phase;
    if (ph > this.prevPhase) {
      this.prevPhase = ph;
      this.phaseJustChanged = true;
    }
    this.color = ph === 1 ? "#cc00ff" : ph === 2 ? "#ff6600" : "#ff0020";

    // Movimiento: patrulla sinusoidal, más rápido en fases avanzadas
    const moveRate = 0.38 + (ph - 1) * 0.18;
    this.x = width / 2 + Math.sin(this.time * moveRate) * (width * 0.34);
    this.y = 90 + Math.sin(this.time * 0.55) * 25;

    // Patrón 1: abanico hacia abajo (todas las fases)
    this.fireTimers[0] -= dt;
    if (this.fireTimers[0] <= 0) {
      this.fireTimers[0] = 2.4 - (ph - 1) * 0.3;
      const count = 4 + ph;
      const spd = 160 + (ph - 1) * 18;
      for (let i = 0; i < count; i++) {
        const ang = Math.PI / 2 + (i - (count - 1) / 2) * 0.27;
        const v = vecFromAngle(ang, spd);
        bullets.obtain().init(this.x, this.y + this.radius * 0.8, v.x, v.y, {
          radius: 5, damage: 1, color: this.color, friendly: false, life: 5,
        });
      }
    }

    // Patrón 2: doble disparo apuntado al jugador (fase 2+)
    if (ph >= 2) {
      this.fireTimers[1] -= dt;
      if (this.fireTimers[1] <= 0) {
        this.fireTimers[1] = Math.max(0.55, 1.5 - (ph - 2) * 0.4);
        const ang = Math.atan2(player.y - this.y, player.x - this.x);
        for (const off of [-0.1, 0.1]) {
          const v = vecFromAngle(ang + off, 245);
          bullets.obtain().init(this.x, this.y, v.x, v.y, {
            radius: 4, damage: 1, color: this.color, friendly: false, life: 4,
          });
        }
      }
    }

    // Patrón 3: espiral de 3 brazos (fase 3 solamente)
    if (ph === 3) {
      this.fireTimers[2] -= dt;
      if (this.fireTimers[2] <= 0) {
        this.fireTimers[2] = 0.13;
        const ang = this.time * 3.2;
        for (let arm = 0; arm < 3; arm++) {
          const v = vecFromAngle(ang + (arm / 3) * TAU, 195);
          bullets.obtain().init(this.x, this.y, v.x, v.y, {
            radius: 4, damage: 1, color: "#ff2040", friendly: false, life: 3.5,
          });
        }
      }
    }
  }

  /** Tipos de minion a spawnear este tick (vacío si no toca o está en intro). */
  pollMinionSpawns(dt: number): EnemyType[] {
    if (this.isIntro || !this.alive) return [];

    const ph = this.phase;
    const interval = ph === 1 ? 5 : ph === 2 ? 4 : 3;
    this.minionTimer -= dt;
    if (this.minionTimer > 0) return [];
    this.minionTimer = interval;

    if (ph === 1) return ["basic", "elite"];
    if (ph === 2) return ["fast", "hunter", "basic"];
    return ["fast", "hunter", "elite", "bomber"];
  }

  render(ctx: CanvasRenderingContext2D): void {
    const ph = this.phase;
    const pulse = 0.85 + Math.sin(this.time * (3 + ph)) * 0.15;
    const r = this.radius;
    const hull = this.shade(this.color, -0.45);
    const accent = this.shade(this.color, 0.22);
    const flicker = 0.7 + Math.sin(this.time * 6) * 0.3;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Halo de amenaza
    ctx.globalAlpha = 0.18 * pulse;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 40;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(0, 0, r + 22, r + 14, 0, 0, TAU);
    ctx.stroke();

    // Motores triples en popa (parte superior — boss mira hacia abajo)
    for (const ex of [-0.42, 0, 0.42]) {
      ctx.globalAlpha = flicker * 0.75;
      ctx.fillStyle = accent;
      ctx.shadowColor = accent;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(ex * r - 8, -0.78 * r);
      ctx.lineTo(ex * r, -0.78 * r - 16 * flicker);
      ctx.lineTo(ex * r + 8, -0.78 * r);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Crucero pesado — alas anchas, superestructura de mando
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 22 * pulse;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-0.92 * r, 0.38 * r);
    ctx.lineTo(-0.98 * r, -0.12 * r);
    ctx.lineTo(-0.55 * r, -0.62 * r);
    ctx.lineTo(-0.22 * r, -0.88 * r);
    ctx.lineTo(0.22 * r, -0.88 * r);
    ctx.lineTo(0.55 * r, -0.62 * r);
    ctx.lineTo(0.98 * r, -0.12 * r);
    ctx.lineTo(0.92 * r, 0.38 * r);
    ctx.closePath();
    ctx.fill();

    // Torre de mando
    ctx.fillStyle = hull;
    ctx.globalAlpha = 0.65;
    ctx.beginPath();
    ctx.moveTo(-0.18 * r, -0.55 * r);
    ctx.lineTo(0.18 * r, -0.55 * r);
    ctx.lineTo(0.14 * r, -0.82 * r);
    ctx.lineTo(-0.14 * r, -0.82 * r);
    ctx.closePath();
    ctx.fill();

    // Bahía de armas / ventral
    ctx.globalAlpha = 0.35 + ph * 0.08;
    ctx.fillStyle = accent;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0.42 * r, 0.2 * r, 0.32 * r, 0, 0, TAU);
    ctx.fill();

    // Cañones laterales (giran levemente con la fase)
    ctx.save();
    ctx.rotate(Math.sin(this.time * 1.4) * 0.06);
    ctx.fillStyle = hull;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(-0.88 * r, 0.05 * r, 0.18 * r, 0.38 * r);
    ctx.fillRect(0.7 * r, 0.05 * r, 0.18 * r, 0.38 * r);
    ctx.restore();

    // Contorno
    ctx.strokeStyle = hull;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(0, r);
    ctx.lineTo(-0.92 * r, 0.38 * r);
    ctx.lineTo(-0.98 * r, -0.12 * r);
    ctx.lineTo(-0.55 * r, -0.62 * r);
    ctx.lineTo(-0.22 * r, -0.88 * r);
    ctx.lineTo(0.22 * r, -0.88 * r);
    ctx.lineTo(0.55 * r, -0.62 * r);
    ctx.lineTo(0.98 * r, -0.12 * r);
    ctx.lineTo(0.92 * r, 0.38 * r);
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();

    // Barra de vida (espacio mundial, bajo el boss)
    const barW = 110;
    const bx = this.x - barW / 2;
    const by = this.y + this.radius + 14;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(bx, by, barW, 5);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.fillRect(bx, by, barW * this.hpRatio, 5);
    ctx.shadowBlur = 0;
  }

  private shade(hex: string, amt: number): string {
    const n = parseInt(hex.slice(1), 16);
    const ch = (c: number) =>
      amt >= 0
        ? Math.min(255, c + (255 - c) * amt) | 0
        : Math.max(0, c * (1 + amt)) | 0;
    const r = ch((n >> 16) & 255);
    const g = ch((n >> 8) & 255);
    const b = ch(n & 255);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }
}

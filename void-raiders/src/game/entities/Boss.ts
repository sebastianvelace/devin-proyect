// Boss final con 3 fases: patrulla + spread, aimed shots, espiral

import type { Player } from "./Player";
import type { Bullet } from "./Bullet";
import type { Pool } from "../../utils/pool";
import { TAU, vecFromAngle } from "../../utils/math";

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

  private readonly level: number;
  private time = 0;
  private introTimer = INTRO_DURATION;
  private prevPhase = 1;
  // fireTimers[0]=spread, [1]=aimed, [2]=spiral — arranca con delay inicial
  private readonly fireTimers = [1.8, 1.2, 0.0];

  constructor(x: number, _y: number, level: number) {
    this.x = x;
    this.level = level;
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

  render(ctx: CanvasRenderingContext2D): void {
    const ph = this.phase;
    const pulse = 0.85 + Math.sin(this.time * (3 + ph)) * 0.15;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Halo exterior
    ctx.globalAlpha = 0.22 * pulse;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 45;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius + 24, 0, TAU);
    ctx.stroke();

    // Hexágono principal giratorio
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 22 * pulse;
    ctx.save();
    ctx.rotate(this.time * (0.5 + (ph - 1) * 0.3));
    ctx.fillStyle = this.color;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      if (i === 0) ctx.moveTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
      else ctx.lineTo(Math.cos(a) * this.radius, Math.sin(a) * this.radius);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Núcleo interno (gira en sentido contrario)
    ctx.save();
    ctx.rotate(-this.time * 1.1);
    ctx.globalAlpha = 0.28 + ph * 0.1;
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 16;
    const innerR = this.radius * 0.42;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      if (i === 0) ctx.moveTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
      else ctx.lineTo(Math.cos(a) * innerR, Math.sin(a) * innerR);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

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
}

// Escolta aliada — sigue al jugador, disparo débil, HP limitado

import type { Player } from "./Player";
import type { Bullet } from "./Bullet";
import type { Pool } from "../../utils/pool";
import { clamp, lerp, lerpAngle } from "../../utils/math";

/** Probabilidad base al matar un enemigo (sin aliados al inicio). */
export const ALLY_DROP_BASE = 0.06;
/** Cada N bajas en el sector suman un escalón de probabilidad. */
export const ALLY_DROP_KILL_STEP = 6;
/** Bonus por escalón (hasta ALLY_DROP_CAP). */
export const ALLY_DROP_BONUS = 0.014;
export const ALLY_DROP_CAP = 0.22;
/** Si toca drop de aliado, esta fracción spawnea al instante (sin pickup). */
export const ALLY_DIRECT_SPAWN_RATIO = 0.19;

export function allyDropChance(killsThisLevel: number): number {
  const steps = Math.floor(killsThisLevel / ALLY_DROP_KILL_STEP);
  return Math.min(ALLY_DROP_CAP, ALLY_DROP_BASE + steps * ALLY_DROP_BONUS);
}

const FORMATION: { ox: number; oy: number }[] = [
  { ox: -52, oy: 28 },
  { ox: 52, oy: 28 },
  { ox: 0, oy: 48 },
];

const HULL = "#2a8a78";
const ACCENT = "#50e8c8";
const GLOW = "#80ffe0";
const BULLET_COLOR = "#60d8b8";

const FIRE_COOLDOWN = 1.05;
const BULLET_SPEED = 380;
const BULLET_DAMAGE = 1;

export class Ally {
  x = 0;
  y = 0;
  angle = 0;
  /** Radio visual del casco. */
  readonly radius = 7;
  /** Caja de colisión circular (coincide con el dibujo). */
  readonly collisionRadius = 7;
  hp = 1;
  readonly maxHp = 1;
  alive = true;
  readonly slot: number;

  private fireTimer = 0.3;

  constructor(slot: number) {
    this.slot = slot;
  }

  static formationOffset(slot: number, playerAngle: number): { x: number; y: number } {
    let ox: number;
    let oy: number;
    if (slot < FORMATION.length) {
      ox = FORMATION[slot].ox;
      oy = FORMATION[slot].oy;
    } else {
      const extra = slot - FORMATION.length;
      const ring = Math.floor(extra / 6) + 1;
      const idx = extra % 6;
      const dist = 54 + ring * 34;
      const a = (idx / 6) * Math.PI * 2 + ring * 0.38;
      ox = Math.cos(a) * dist * 0.92;
      oy = Math.sin(a) * dist * 0.58 + 30;
    }
    const ca = Math.cos(playerAngle);
    const sa = Math.sin(playerAngle);
    return {
      x: ox * ca - oy * sa,
      y: ox * sa + oy * ca,
    };
  }

  update(
    dt: number,
    player: Player,
    bullets: Pool<Bullet>,
    width: number,
    height: number,
    aimAt: { x: number; y: number } | null,
  ): void {
    if (!this.alive || !player.alive) return;

    const off = Ally.formationOffset(this.slot, player.angle);
    const tx = player.x + off.x;
    const ty = player.y + off.y;
    const follow = 1 - Math.exp(-dt * 9);
    this.x = lerp(this.x, tx, follow);
    this.y = lerp(this.y, ty, follow);
    this.x = clamp(this.x, this.radius, width - this.radius);
    this.y = clamp(this.y, this.radius, height - this.radius);

    const target = aimAt ?? { x: player.x, y: player.y + 80 };
    const desired = Math.atan2(target.y - this.y, target.x - this.x);
    this.angle = lerpAngle(this.angle, desired, 1 - Math.exp(-dt * 14));

    this.fireTimer -= dt;
    if (this.fireTimer <= 0 && aimAt) {
      this.fireTimer = FIRE_COOLDOWN;
      const nose = {
        x: this.x + Math.cos(this.angle) * 12,
        y: this.y + Math.sin(this.angle) * 12,
      };
      const spd = BULLET_SPEED;
      const vx = Math.cos(this.angle) * spd;
      const vy = Math.sin(this.angle) * spd;
      bullets.obtain().init(nose.x, nose.y, vx, vy, {
        radius: 2,
        damage: BULLET_DAMAGE,
        color: BULLET_COLOR,
        friendly: true,
        life: 2.8,
      });
    }
  }

  /** Un impacto hostil destruye la escolta. */
  takeDamage(): boolean {
    this.alive = false;
    return true;
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (!this.alive) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const flicker = 0.7 + Math.sin(Date.now() * 0.008 + this.slot) * 0.3;
    ctx.shadowColor = GLOW;
    ctx.shadowBlur = 12;

    for (const ey of [-3, 3]) {
      ctx.globalAlpha = flicker * 0.75;
      ctx.fillStyle = GLOW;
      ctx.beginPath();
      ctx.moveTo(-7, ey - 1);
      ctx.lineTo(-12 - flicker * 2, ey);
      ctx.lineTo(-7, ey + 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = HULL;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(5, -2.4);
    ctx.lineTo(-1, -7.5);
    ctx.lineTo(-9, -4.2);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-9, 4.2);
    ctx.lineTo(-1, 7.5);
    ctx.lineTo(5, 2.4);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(10, -1.8);
    ctx.lineTo(-4, -5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 1.8);
    ctx.lineTo(-4, 5);
    ctx.stroke();

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

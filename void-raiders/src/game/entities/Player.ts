// Nave del jugador — paleta Interstellar: blanco cálido + ámbar

import type { Vec2 } from "../../types";
import type { InputManager } from "../systems/InputManager";
import { clamp, normalize, lerp, lerpAngle } from "../../utils/math";

const BASE_SPEED  = 320;
const INVULN_TIME = 2.0;
const TRAIL_MAX   = 22;

const SHIP_FILL  = "#f4ead8";  // blanco cálido spacecraft
const SHIP_GLOW  = "#d48830";  // ámbar motor/acreción
const SHIELD_COL = "#80c8ff";  // azul hielo escudo
const DAMAGE_COL = "#ff3040";

interface TrailDot {
  x: number;
  y: number;
  life: number;
}

export class Player {
  x: number;
  y: number;
  angle = 0;
  readonly radius = 10;
  lives = 3;
  invuln = 0;
  speedMult = 1;
  shield = false;
  alive = true;

  private readonly trail: TrailDot[] = [];
  private vx = 0;
  private vy = 0;
  private trailTimer = 0;
  private engineFlicker = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get isInvulnerable(): boolean {
    return this.invuln > 0;
  }

  update(dt: number, input: InputManager, pointer: Vec2, width: number, height: number): void {
    if (this.invuln > 0) this.invuln -= dt;
    this.engineFlicker += dt * 8;

    let dx = 0;
    let dy = 0;
    if (input.isDown("KeyA") || input.isDown("ArrowLeft"))  dx -= 1;
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) dx += 1;
    if (input.isDown("KeyW") || input.isDown("ArrowUp"))    dy -= 1;
    if (input.isDown("KeyS") || input.isDown("ArrowDown"))  dy += 1;

    const moving = dx !== 0 || dy !== 0;
    const speed = BASE_SPEED * this.speedMult;
    let tx = 0;
    let ty = 0;
    if (moving) {
      const n = normalize(dx, dy);
      tx = n.x * speed;
      ty = n.y * speed;
    }

    const accel = 1 - Math.exp(-dt * 16);
    this.vx = lerp(this.vx, tx, accel);
    this.vy = lerp(this.vy, ty, accel);
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    this.x = clamp(this.x, this.radius, width - this.radius);
    this.y = clamp(this.y, this.radius, height - this.radius);

    const targetAngle = Math.atan2(pointer.y - this.y, pointer.x - this.x);
    this.angle = lerpAngle(this.angle, targetAngle, 1 - Math.exp(-dt * 24));

    this.trailTimer -= dt;
    if (moving && this.trailTimer <= 0) {
      this.trailTimer = 0.018;
      this.trail.push({ x: this.x, y: this.y, life: 0.5 });
      if (this.trail.length > TRAIL_MAX) this.trail.shift();
    }
    for (const d of this.trail) d.life -= dt;
    while (this.trail.length > 0 && this.trail[0].life <= 0) this.trail.shift();
  }

  nose(dist = 18): Vec2 {
    return { x: this.x + Math.cos(this.angle) * dist, y: this.y + Math.sin(this.angle) * dist };
  }

  takeDamage(): boolean {
    if (this.invuln > 0) return false;
    if (this.shield) {
      this.shield = false;
      this.invuln = INVULN_TIME;
      return false;
    }
    this.lives -= 1;
    this.invuln = INVULN_TIME;
    if (this.lives <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D, _weaponColor: string): void {
    // Trail ámbar
    for (const d of this.trail) {
      const a = Math.max(0, d.life / 0.5);
      ctx.globalAlpha = a * 0.45;
      ctx.fillStyle = SHIP_GLOW;
      ctx.shadowColor = SHIP_GLOW;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3.5 * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;

    const blink = this.invuln > 0 && Math.floor(this.invuln * 18) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Escudo (anillo azul hielo)
    if (this.shield) {
      ctx.globalAlpha = 0.55;
      ctx.strokeStyle = SHIELD_COL;
      ctx.lineWidth = 2;
      ctx.shadowColor = SHIELD_COL;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Destello del motor posterior
    const flicker = 0.7 + Math.sin(this.engineFlicker) * 0.3;
    ctx.globalAlpha = flicker * 0.85;
    ctx.fillStyle = SHIP_GLOW;
    ctx.shadowColor = SHIP_GLOW;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(-12, -4);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-12, 4);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // Cuerpo de la nave
    const fillColor = this.invuln > 0 ? DAMAGE_COL : SHIP_FILL;
    const glowColor = this.invuln > 0 ? "#ff6060" : SHIP_GLOW;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = fillColor;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-13, -11);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-13, 11);
    ctx.closePath();
    ctx.fill();

    // Líneas de acento ámbar
    if (this.invuln <= 0) {
      ctx.strokeStyle = SHIP_GLOW;
      ctx.lineWidth = 1.2;
      ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(8, -5); ctx.lineTo(-8, -7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, 5); ctx.lineTo(-8, 7);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }
}

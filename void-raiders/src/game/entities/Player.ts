// Nave del jugador: movimiento WASD, apuntado al mouse, vidas e invulnerabilidad

import type { Vec2 } from "../../types";
import type { InputManager } from "../systems/InputManager";
import { clamp, normalize } from "../../utils/math";

const BASE_SPEED = 320; // px/s
const INVULN_TIME = 1.5; // segundos tras recibir daño
const TRAIL_MAX = 18;

interface TrailDot {
  x: number;
  y: number;
  life: number;
}

export class Player {
  x: number;
  y: number;
  angle = 0;
  readonly radius = 10; // hitbox (menor que el visual)
  lives = 3;
  invuln = 0;
  speedMult = 1;
  shield = false;
  alive = true;

  private readonly trail: TrailDot[] = [];

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get isInvulnerable(): boolean {
    return this.invuln > 0;
  }

  update(
    dt: number,
    input: InputManager,
    pointer: Vec2,
    width: number,
    height: number,
  ): void {
    if (this.invuln > 0) this.invuln -= dt;

    // input direccional (8 direcciones, diagonal normalizada)
    let dx = 0;
    let dy = 0;
    if (input.isDown("KeyA") || input.isDown("ArrowLeft")) dx -= 1;
    if (input.isDown("KeyD") || input.isDown("ArrowRight")) dx += 1;
    if (input.isDown("KeyW") || input.isDown("ArrowUp")) dy -= 1;
    if (input.isDown("KeyS") || input.isDown("ArrowDown")) dy += 1;

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const n = normalize(dx, dy);
      const speed = BASE_SPEED * this.speedMult;
      this.x += n.x * speed * dt;
      this.y += n.y * speed * dt;
    }

    // la nave no sale del canvas
    this.x = clamp(this.x, this.radius, width - this.radius);
    this.y = clamp(this.y, this.radius, height - this.radius);

    // apuntar hacia el cursor
    this.angle = Math.atan2(pointer.y - this.y, pointer.x - this.x);

    // trail de partículas (atenuándose)
    if (moving) {
      this.trail.push({ x: this.x, y: this.y, life: 0.4 });
      if (this.trail.length > TRAIL_MAX) this.trail.shift();
    }
    for (const d of this.trail) d.life -= dt;
    while (this.trail.length > 0 && this.trail[0].life <= 0) this.trail.shift();
  }

  /** Devuelve la posición de la punta (origen de los disparos). */
  nose(distance = 16): Vec2 {
    return {
      x: this.x + Math.cos(this.angle) * distance,
      y: this.y + Math.sin(this.angle) * distance,
    };
  }

  /** Aplica un golpe. Devuelve true si el jugador murió en este golpe. */
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

  render(ctx: CanvasRenderingContext2D, weaponColor: string): void {
    // trail
    for (const d of this.trail) {
      const a = Math.max(0, d.life / 0.4);
      ctx.globalAlpha = a * 0.5;
      ctx.fillStyle = weaponColor;
      ctx.beginPath();
      ctx.arc(d.x, d.y, 3 * a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // parpadeo durante invulnerabilidad
    const blink = this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    if (this.shield) {
      ctx.strokeStyle = "#00ffff";
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, this.radius + 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = this.invuln > 0 ? "#ff4060" : "#00ffff";
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-12, -10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

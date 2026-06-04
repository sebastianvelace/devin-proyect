// Power-ups que caen de enemigos

import type { PowerUpType } from "../../types";
import { TAU } from "../../utils/math";

const COLORS: Record<PowerUpType, string> = {
  multishot: "#4080ff",
  shield:    "#60c8ff",
  speed:     "#e8c030",
  damage:    "#ff3040",
  bomb:      "#f0f0f0",
};

const LABELS: Record<PowerUpType, string> = {
  multishot: "MULTI",
  shield:    "SHIELD",
  speed:     "SPEED",
  damage:    "DMG+",
  bomb:      "BOMB",
};

export class PowerUp {
  type: PowerUpType = "shield";
  x = 0;
  y = 0;
  alive = true;
  radius = 12;
  private rotation = 0;
  private vy = 55;

  spawn(type: PowerUpType, x: number, y: number): void {
    this.type = type;
    this.x = x;
    this.y = y;
    this.alive = true;
    this.rotation = Math.random() * TAU;
    this.vy = 55 + Math.random() * 25;
  }

  update(dt: number, height: number): void {
    this.rotation += dt * 2.4;
    this.y += this.vy * dt;
    if (this.y > height + 40) this.alive = false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const color = COLORS[this.type];
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);

    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillStyle = color + "44";
    const s = this.radius;
    ctx.beginPath();
    ctx.rect(-s, -s, s * 2, s * 2);
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 8px 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(LABELS[this.type], 0, 0);

    ctx.restore();
  }
}

export const POWERUP_DROP_CHANCE = 0.15;

export function rollPowerUpType(): PowerUpType {
  const roll = Math.random();
  if (roll < 0.22) return "multishot";
  if (roll < 0.44) return "shield";
  if (roll < 0.62) return "speed";
  if (roll < 0.8)  return "damage";
  return "bomb";
}

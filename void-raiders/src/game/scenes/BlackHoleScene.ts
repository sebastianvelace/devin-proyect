// Cinemática Interstellar — agujero negro WebGL2 + nave en canvas 2D (sector 3 → acto 2)

import type { Scene } from "../../types";
import type { Game } from "../Game";
import type { RunState } from "../RunState";
import { ACT2_FIRST_SECTOR } from "../sectorConfig";
import { GameScene } from "./GameScene";
import { soundManager } from "../../audio/SoundManager";
import { BlackHoleWebGL } from "./BlackHoleWebGL";

const DURATION = 11;
const SHIP_FILL = "#f4ead8";
const SHIP_GLOW = "#d48830";

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  hue: string;
}

function easeInCubic(x: number): number {
  return x * x * x;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function pullStrength(t: number): number {
  if (t < 0.12) return 0;
  return easeInCubic((t - 0.12) / 0.88);
}

function lensStrength(t: number): number {
  return smoothstep(0.15, 0.92, t);
}

export class BlackHoleScene implements Scene {
  private readonly game: Game;
  private readonly run: RunState;
  private readonly trails: TrailParticle[] = [];
  private readonly gl: BlackHoleWebGL;
  private time = 0;
  private shipX: number;
  private shipY: number;
  private shipAngle = -Math.PI / 2;
  private audioStarted = false;

  constructor(game: Game, run: RunState) {
    this.game = game;
    this.run = run;
    this.gl = new BlackHoleWebGL();
    this.shipX = game.width / 2;
    this.shipY = game.height * 0.72;
  }

  enter(): void {
    soundManager.init();
    soundManager.stopAmbient();
    this.gl.resize(this.game.width, this.game.height, this.game.dpr);
  }

  exit(): void {
    this.gl.dispose();
  }

  resize(width: number, height: number): void {
    this.gl.resize(width, height, this.game.dpr);
  }

  update(dt: number): void {
    const clampedDt = Math.min(dt, 0.05);
    this.time += clampedDt;
    const t = Math.min(1, this.time / DURATION);
    const pull = pullStrength(t);

    if (!this.audioStarted) {
      this.audioStarted = true;
      soundManager.startBlackHoleCinematic();
    }
    soundManager.updateBlackHoleCinematic(t);

    const cx = this.game.width / 2;
    const cy = this.game.height * 0.46;
    const follow = 1 - Math.exp(-clampedDt * (2.5 + pull * 6));
    this.shipX += (cx - this.shipX) * follow;
    this.shipY += (cy - this.shipY) * follow * 1.15;
    this.shipAngle = -Math.PI / 2 + Math.sin(this.time * 1.6) * pull * 0.55 + pull * 0.35;

    const stretch = t < 0.22 ? 0 : easeInCubic((t - 0.22) / 0.65);
    if (stretch > 0.08 && Math.random() < 0.55 * stretch) {
      this.spawnTrail(this.shipX, this.shipY, cx, cy, stretch);
    }
    this.updateTrails(clampedDt, cx, cy, pull);

    if (this.game.input.wasPressed("KeyM")) soundManager.toggleMute();

    if (this.time >= DURATION) {
      soundManager.endBlackHoleCinematic();
      this.game.changeScene(
        new GameScene(this.game, ACT2_FIRST_SECTOR, this.run, { act2Entry: true }),
      );
    }
  }

  private spawnTrail(
    sx: number,
    sy: number,
    cx: number,
    cy: number,
    stretch: number,
  ): void {
    if (this.trails.length > 48) this.trails.shift();
    const dx = cx - sx;
    const dy = cy - sy;
    const len = Math.hypot(dx, dy) || 1;
    this.trails.push({
      x: sx + (Math.random() - 0.5) * 6,
      y: sy + (Math.random() - 0.5) * 6,
      vx: (dx / len) * (40 + stretch * 120) + (Math.random() - 0.5) * 20,
      vy: (dy / len) * (40 + stretch * 120) + (Math.random() - 0.5) * 20,
      life: 0.35 + Math.random() * 0.25,
      maxLife: 0.6,
      hue: Math.random() < 0.5 ? SHIP_GLOW : SHIP_FILL,
    });
  }

  private updateTrails(dt: number, cx: number, cy: number, pull: number): void {
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const p = this.trails[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.trails.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx += (cx - p.x) * pull * dt * 3;
      p.vy += (cy - p.y) * pull * dt * 3;
      p.vx *= 1 - dt * 1.2;
      p.vy *= 1 - dt * 1.2;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    const t = Math.min(1, this.time / DURATION);
    const grow = smoothstep(0.1, 0.95, t);
    const cx = w / 2;
    const cy = h * 0.46;

    this.gl.resize(w, h, this.game.dpr);
    this.gl.draw(this.time, lensStrength(t), grow, h, cy);
    ctx.drawImage(this.gl.canvas, 0, 0, w, h);

    this.renderTrails(ctx, t);
    this.renderShip(ctx, t);

    if (t > 0.78 && t < 0.92) {
      const titleA = smoothstep(0.78, 0.84, t) * (1 - smoothstep(0.86, 0.92, t));
      ctx.save();
      ctx.globalAlpha = titleA;
      ctx.textAlign = "center";
      ctx.font = "700 13px 'Orbitron', sans-serif";
      ctx.fillStyle = "#80c8ff";
      ctx.letterSpacing = "5px";
      ctx.fillText("ACT II — BEYOND THE VOID", cx, h * 0.88);
      ctx.restore();
    }

    if (t > 0.9) {
      const flash = smoothstep(0.9, 1, t);
      ctx.fillStyle = `rgba(255, 252, 248, ${flash * 0.95})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private renderTrails(ctx: CanvasRenderingContext2D, t: number): void {
    const stretch = t < 0.22 ? 0 : easeInCubic((t - 0.22) / 0.65);
    if (stretch < 0.05) return;

    for (const p of this.trails) {
      const a = (p.life / p.maxLife) * stretch;
      ctx.save();
      ctx.globalAlpha = a * 0.7;
      ctx.fillStyle = p.hue;
      ctx.shadowColor = SHIP_GLOW;
      ctx.shadowBlur = 6;
      const len = 4 + (1 - p.life / p.maxLife) * 14;
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillRect(-len / 2, -1, len, 2);
      ctx.restore();
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  private renderShip(ctx: CanvasRenderingContext2D, t: number): void {
    const stretch = t < 0.22 ? 0 : easeInCubic((t - 0.22) / 0.65);
    const fade = t > 0.72 ? Math.max(0, 1 - smoothstep(0.72, 0.9, t)) : 1;
    const cx = this.shipX;
    const cy = this.shipY;
    const scaleX = 1 + stretch * 3.6;
    const scaleY = Math.max(0.05, 1 - stretch * 0.94);
    const toSingularity = Math.atan2(
      this.game.height * 0.46 - cy,
      this.game.width / 2 - cx,
    );

    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(cx, cy);
    ctx.rotate(this.shipAngle + stretch * (toSingularity - this.shipAngle) * 0.35);
    ctx.scale(scaleX, scaleY);

    const r = 14;
    ctx.fillStyle = SHIP_FILL;
    ctx.shadowColor = SHIP_GLOW;
    ctx.shadowBlur = 10 + stretch * 28;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.55, r * 0.7);
    ctx.lineTo(0, r * 0.45);
    ctx.lineTo(-r * 0.55, r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = SHIP_GLOW;
    ctx.globalAlpha = fade * (0.45 + stretch * 0.55);
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, r * 0.5);
    ctx.lineTo(0, r * 1.2 + stretch * 52);
    ctx.lineTo(r * 0.2, r * 0.5);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}

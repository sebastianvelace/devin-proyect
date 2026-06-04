// Pantalla de victoria — estilo Interstellar, partículas doradas

import type { Scene } from "../../types";
import type { Game } from "../Game";
import { Starfield } from "../systems/Starfield";
import { ParticleSystem } from "../systems/ParticleSystem";
import { MenuScene } from "./MenuScene";
import { GameScene } from "./GameScene";
import { soundManager } from "../../audio/SoundManager";

const AMBER  = "#e8a840";
const GOLD   = "#f8d060";
const DIM    = "#667788";
const WARM_W = "#f0e8d0";

interface Button {
  label: string;
  x: number; y: number; w: number; h: number;
  primary: boolean;
  onClick: () => void;
}

function getRank(score: number): string {
  if (score > 15000) return "S";
  if (score > 10000) return "A";
  if (score > 5000)  return "B";
  return "C";
}

export class VictoryScene implements Scene {
  private readonly starfield = new Starfield(0.5);
  private readonly particles = new ParticleSystem();
  private readonly game: Game;
  private readonly score: number;
  private time = 0;
  private confettiTimer = 0;
  private buttons: Button[] = [];

  constructor(game: Game, score: number) {
    this.game = game;
    this.score = score;
  }

  enter(): void {
    soundManager.init();
    soundManager.play('combo');
    setTimeout(() => soundManager.play('powerup'), 300);
    this.starfield.resize(this.game.width, this.game.height);
    this.buildButtons();
  }

  resize(): void {
    this.starfield.resize(this.game.width, this.game.height);
    this.buildButtons();
  }

  private buildButtons(): void {
    const cx = this.game.width / 2;
    const cy = this.game.height / 2;
    this.buttons = [
      { label: "PLAY AGAIN",  x: cx - 135, y: cy + 88,  w: 270, h: 50, primary: true,  onClick: () => this.again() },
      { label: "MAIN MENU",   x: cx - 100, y: cy + 155, w: 200, h: 40, primary: false, onClick: () => this.menu() },
    ];
  }

  private again(): void {
    soundManager.play('ui_click');
    this.game.changeScene(new GameScene(this.game));
  }

  private menu(): void {
    soundManager.play('ui_click');
    this.game.changeScene(new MenuScene(this.game));
  }

  update(dt: number): void {
    this.time += dt;
    this.starfield.update(dt);
    this.particles.update(dt);

    // Partículas doradas periódicas
    this.confettiTimer -= dt;
    if (this.confettiTimer <= 0) {
      this.confettiTimer = 0.18;
      const x = Math.random() * this.game.width;
      this.particles.explosion(x, Math.random() * this.game.height * 0.6, GOLD, 5, 120);
      this.particles.spark(x, Math.random() * this.game.height * 0.4, AMBER, 4);
    }

    for (const click of this.game.consumeClicks()) {
      for (const b of this.buttons) {
        if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
          b.onClick();
        }
      }
    }
    if (this.game.input.wasPressed("Escape")) this.menu();
    if (this.game.input.wasPressed("KeyR"))   this.again();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    ctx.fillStyle = "#020408";
    ctx.fillRect(0, 0, w, h);
    this.starfield.renderNebula(ctx);
    this.starfield.render(ctx);
    this.particles.render(ctx);

    const cx = w / 2;
    const cy = h / 2;
    const rank = getRank(this.score);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Título brillante
    const titlePulse = 0.85 + Math.sin(this.time * 2) * 0.15;
    ctx.font = "900 62px 'Orbitron', sans-serif";
    ctx.fillStyle = GOLD;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 50 * titlePulse;
    ctx.letterSpacing = "8px";
    ctx.fillText("VOID CLEARED", cx, cy - 105);
    ctx.shadowBlur = 0;

    // Quote Interstellar
    ctx.font = "400 16px 'Exo 2', sans-serif";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "0px";
    ctx.globalAlpha = 0.8;
    ctx.fillText("\"We reach farther than we dare to imagine.\"", cx, cy - 52);
    ctx.globalAlpha = 1;

    // Rango
    ctx.font = "900 80px 'Orbitron', sans-serif";
    ctx.fillStyle = rank === "S" ? GOLD : AMBER;
    ctx.shadowColor = rank === "S" ? GOLD : AMBER;
    ctx.shadowBlur = 36;
    ctx.letterSpacing = "0px";
    ctx.fillText(rank, cx - 140, cy + 8);
    ctx.shadowBlur = 0;

    ctx.font = "400 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "2px";
    ctx.fillText("RANK", cx - 140, cy + 40);
    ctx.letterSpacing = "0px";

    // Score
    ctx.font = "700 34px 'JetBrains Mono', monospace";
    ctx.fillStyle = WARM_W;
    ctx.textAlign = "center";
    ctx.fillText(this.score.toString().padStart(8, "0"), cx + 20, cy + 8);

    ctx.font = "400 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "2px";
    ctx.fillText("FINAL SCORE", cx + 20, cy + 40);
    ctx.letterSpacing = "0px";

    ctx.restore();

    this.renderButtons(ctx);
    this.renderVignette(ctx, w, h);
  }

  private renderButtons(ctx: CanvasRenderingContext2D): void {
    const p = this.game.pointer;
    for (const b of this.buttons) {
      const hover = p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      const color = b.primary ? AMBER : DIM;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = hover ? 28 : 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = hover ? color + "28" : "#00000055";
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = hover ? 12 : 4;
      ctx.fillStyle = hover ? WARM_W : color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = b.primary ? "700 16px 'Orbitron', sans-serif" : "400 14px 'Orbitron', sans-serif";
      ctx.letterSpacing = "3px";
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      ctx.letterSpacing = "0px";
      ctx.restore();
    }
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 2.2, w / 2, h / 2, Math.max(w, h) / 1.05);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.85)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

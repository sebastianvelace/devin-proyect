// Pantalla de derrota — estilo Interstellar

import type { Scene } from "../../types";
import type { Game } from "../Game";
import { Starfield } from "../systems/Starfield";
import { MenuScene } from "./MenuScene";
import { GameScene } from "./GameScene";
import { soundManager } from "../../audio/SoundManager";

const AMBER  = "#e8a840";
const RED    = "#cc2030";
const DIM    = "#667788";
const WARM_W = "#f0e8d0";

interface Button {
  label: string;
  x: number; y: number; w: number; h: number;
  color: string;
  onClick: () => void;
}

export class GameOverScene implements Scene {
  private readonly starfield = new Starfield(0.5);
  private readonly game: Game;
  private readonly score: number;
  private readonly level: number;
  private time = 0;
  private buttons: Button[] = [];

  constructor(game: Game, score: number, level = 1) {
    this.game = game;
    this.score = score;
    this.level = level;
  }

  enter(): void {
    soundManager.init();
    soundManager.play("defeat");
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
      { label: "RETRY MISSION", x: cx - 145, y: cy + 80, w: 290, h: 50, color: AMBER, onClick: () => this.retry() },
      { label: "MAIN MENU",     x: cx - 100, y: cy + 148, w: 200, h: 40, color: DIM,  onClick: () => this.menu() },
    ];
  }

  private retry(): void {
    soundManager.play('ui_click');
    this.game.changeScene(new GameScene(this.game, this.level));
  }

  private menu(): void {
    soundManager.play('ui_click');
    this.game.changeScene(new MenuScene(this.game));
  }

  update(dt: number): void {
    this.time += dt;
    this.starfield.update(dt);
    for (const click of this.game.consumeClicks()) {
      for (const b of this.buttons) {
        if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
          b.onClick();
        }
      }
    }
    if (this.game.input.wasPressed("KeyM")) soundManager.toggleMute();
    if (this.game.input.wasPressed("Escape")) {
      soundManager.play("menu_back");
      this.menu();
    }
    if (this.game.input.wasPressed("KeyR")) this.retry();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    ctx.fillStyle = "#020408";
    ctx.fillRect(0, 0, w, h);
    this.starfield.renderNebula(ctx);
    this.starfield.render(ctx);

    const cx = w / 2;
    const cy = h / 2;

    // Título
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 64px 'Orbitron', sans-serif";
    ctx.fillStyle = RED;
    ctx.shadowColor = RED;
    ctx.shadowBlur = 40;
    ctx.letterSpacing = "6px";
    ctx.fillText("MISSION FAILED", cx, cy - 100);
    ctx.shadowBlur = 0;

    // Quote Interstellar
    ctx.font = "400 17px 'Exo 2', sans-serif";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "0px";
    const pulse = 0.75 + Math.sin(this.time * 1.5) * 0.25;
    ctx.globalAlpha = pulse;
    ctx.fillText("\"Mankind was born on Earth. It was never meant to die here.\"", cx, cy - 46);
    ctx.globalAlpha = 1;

    // Score
    ctx.font = "700 36px 'JetBrains Mono', monospace";
    ctx.fillStyle = WARM_W;
    ctx.fillText(this.score.toString().padStart(8, "0"), cx, cy - 4);

    ctx.font = "400 12px 'JetBrains Mono', monospace";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "3px";
    ctx.fillText("FINAL SCORE", cx, cy + 22);
    ctx.letterSpacing = "0px";
    ctx.restore();

    this.renderButtons(ctx);
    this.renderVignette(ctx, w, h);
  }

  private renderButtons(ctx: CanvasRenderingContext2D): void {
    const p = this.game.pointer;
    for (const b of this.buttons) {
      const hover = p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = hover ? 28 : 8;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = hover ? b.color + "28" : "#00000055";
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill(); ctx.stroke();
      ctx.shadowBlur = hover ? 12 : 4;
      ctx.fillStyle = hover ? WARM_W : b.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = "700 15px 'Orbitron', sans-serif";
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

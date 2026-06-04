// Pantalla de derrota — minimalista, alineada con MenuScene

import type { Scene } from "../../types";
import type { Game } from "../Game";
import { Starfield } from "../systems/Starfield";
import { MenuScene } from "./MenuScene";
import { GameScene } from "./GameScene";
import { soundManager } from "../../audio/SoundManager";

interface Button {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  primary: boolean;
  onClick: () => void;
}

// Paleta Interstellar (consistente con menú)
const AMBER    = "#e8a840";
const ICE      = "#80c8ff";
const WARM_W   = "#f4ead8";
const DIM      = "#8899aa";
const DIM_DARK = "#667788";
const BG_DEEP  = "#020408";
const RED_ACC  = "#cc4455";

const FONT_DISPLAY = "'Syne', sans-serif";
const FONT_UI      = "'IBM Plex Sans', sans-serif";
const FONT_MONO    = "'JetBrains Mono', monospace";

export class GameOverScene implements Scene {
  private readonly starfield = new Starfield(0.5);
  private readonly game: Game;
  private readonly score: number;
  private readonly level: number;
  private buttons: Button[] = [];
  private hoveredButton: Button | null = null;

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
      {
        label: "RETRY MISSION",
        x: cx - 155,
        y: cy + 72,
        w: 310,
        h: 52,
        primary: true,
        onClick: () => this.retry(),
      },
      {
        label: "MAIN MENU",
        x: cx - 100,
        y: cy + 136,
        w: 200,
        h: 40,
        primary: false,
        onClick: () => this.menu(),
      },
    ];
  }

  private retry(): void {
    soundManager.play("ui_click");
    this.game.changeScene(new GameScene(this.game, this.level));
  }

  private menu(): void {
    soundManager.play("ui_click");
    this.game.changeScene(new MenuScene(this.game));
  }

  update(dt: number): void {
    this.starfield.update(dt);

    if (this.game.input.wasPressed("KeyM")) soundManager.toggleMute();

    let hoverTarget: Button | null = null;
    for (const b of this.buttons) {
      const p = this.game.pointer;
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
        hoverTarget = b;
      }
    }
    if (hoverTarget && hoverTarget !== this.hoveredButton) {
      soundManager.playHover();
    }
    this.hoveredButton = hoverTarget;

    for (const click of this.game.consumeClicks()) {
      for (const b of this.buttons) {
        if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
          b.onClick();
        }
      }
    }

    if (this.game.input.wasPressed("Escape")) {
      soundManager.play("menu_back");
      this.menu();
    }
    if (this.game.input.wasPressed("KeyR")) this.retry();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    const bg = ctx.createRadialGradient(w / 2, h * 0.42, 0, w / 2, h * 0.42, Math.max(w, h) * 0.9);
    bg.addColorStop(0, "#0a1018");
    bg.addColorStop(0.55, "#050810");
    bg.addColorStop(1, BG_DEEP);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.renderNebulaAccent(ctx, w, h);
    this.starfield.renderNebula(ctx);
    this.starfield.render(ctx);

    const cx = w / 2;
    const cy = h / 2;

    this.renderTitle(ctx, cx, cy - 108);
    this.renderScore(ctx, cx, cy - 28);
    this.renderButtons(ctx);
    this.renderHint(ctx, cx, h - 40);
    this.renderVignette(ctx, w, h);
  }

  private renderNebulaAccent(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createRadialGradient(w * 0.5, h * 0.35, 0, w * 0.5, h * 0.35, w * 0.45);
    g.addColorStop(0, "rgba(204, 68, 85, 0.06)");
    g.addColorStop(0.5, "rgba(120, 40, 50, 0.03)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private renderTitle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 42px ${FONT_DISPLAY}`;
    ctx.letterSpacing = "6px";
    ctx.fillStyle = RED_ACC;
    ctx.fillText("MISSION FAILED", x, y);

    ctx.font = `400 12px ${FONT_UI}`;
    ctx.letterSpacing = "3px";
    ctx.fillStyle = DIM;
    ctx.fillText("SIGNAL LOST", x, y + 34);
    ctx.restore();
  }

  private renderScore(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = `400 10px ${FONT_MONO}`;
    ctx.letterSpacing = "2px";
    ctx.fillStyle = DIM_DARK;
    ctx.fillText("FINAL SCORE", x, y - 18);

    ctx.font = `400 28px ${FONT_MONO}`;
    ctx.letterSpacing = "2px";
    ctx.fillStyle = WARM_W + "dd";
    ctx.fillText(this.score.toString().padStart(8, "0"), x, y + 12);
    ctx.restore();
  }

  private renderButtons(ctx: CanvasRenderingContext2D): void {
    const p = this.game.pointer;
    for (const b of this.buttons) {
      const hover = p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      const accent = b.primary ? AMBER : ICE;
      const tx = b.x + b.w / 2;
      const ty = b.y + b.h / 2 + 1;

      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.letterSpacing = b.primary ? "3px" : "2px";
      ctx.font = b.primary
        ? `500 15px ${FONT_UI}`
        : `400 13px ${FONT_UI}`;
      ctx.fillStyle = hover ? WARM_W : accent;
      ctx.fillText(b.label, tx, ty);

      if (hover) {
        const underlineW = Math.min(b.w * 0.55, ctx.measureText(b.label).width + 12);
        ctx.strokeStyle = accent + "88";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx - underlineW / 2, ty + 14);
        ctx.lineTo(tx + underlineW / 2, ty + 14);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderHint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `400 11px ${FONT_MONO}`;
    ctx.letterSpacing = "1px";
    ctx.fillStyle = DIM_DARK;
    ctx.fillText("R RETRY · ESC MENU · M MUTE", x, y);
    ctx.restore();
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 2.4, w / 2, h / 2, Math.max(w, h) * 1.02);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

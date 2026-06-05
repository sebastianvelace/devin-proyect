// Pantalla de victoria — estilo Interstellar, celebración animada

import type { Scene } from "../../types";
import type { Game } from "../Game";
import { Starfield } from "../systems/Starfield";
import { ParticleSystem } from "../systems/ParticleSystem";
import { MenuScene } from "./MenuScene";
import { GameScene } from "./GameScene";
import { soundManager } from "../../audio/SoundManager";
import { saveScore } from "../scores/ScoreTable";
import { renderLeaderboard } from "../ui/LeaderboardUI";

const AMBER  = "#e8a840";
const GOLD   = "#f8d060";
const ICE    = "#80c8ff";
const DIM    = "#667788";
const WARM_W = "#f4ead8";
const BG_DEEP = "#020408";

const FONT_DISPLAY = "'Syne', sans-serif";
const FONT_UI      = "'IBM Plex Sans', sans-serif";
const FONT_MONO    = "'JetBrains Mono', monospace";

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

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export class VictoryScene implements Scene {
  private readonly starfield = new Starfield(0.55);
  private readonly particles = new ParticleSystem();
  private readonly game: Game;
  private readonly score: number;
  private time = 0;
  private confettiTimer = 0;
  private buttons: Button[] = [];
  private displayedScore = 0;

  constructor(game: Game, score: number) {
    this.game = game;
    this.score = score;
  }

  enter(): void {
    soundManager.init();
    saveScore(this.score);
    this.starfield.resize(this.game.width, this.game.height);
    this.buildButtons();
    this.spawnInitialBurst();
  }

  resize(): void {
    this.starfield.resize(this.game.width, this.game.height);
    this.buildButtons();
  }

  private spawnInitialBurst(): void {
    const { width: w, height: h } = this.game;
    for (let i = 0; i < 12; i++) {
      const x = w * 0.2 + Math.random() * w * 0.6;
      const y = h * 0.15 + Math.random() * h * 0.45;
      this.particles.explosion(x, y, GOLD, 14, 200);
      this.particles.spark(x, y, ICE, 8);
    }
  }

  private buildButtons(): void {
    const cx = this.game.width / 2;
    const cy = this.game.height / 2;
    this.buttons = [
      { label: "PLAY AGAIN",  x: cx - 135, y: cy + 148, w: 270, h: 50, primary: true,  onClick: () => this.again() },
      { label: "MAIN MENU",   x: cx - 100, y: cy + 214, w: 200, h: 40, primary: false, onClick: () => this.menu() },
    ];
  }

  private again(): void {
    soundManager.play("ui_click");
    this.game.changeScene(new GameScene(this.game));
  }

  private menu(): void {
    soundManager.play("ui_click");
    this.game.changeScene(new MenuScene(this.game));
  }

  update(dt: number): void {
    this.time += dt;
    this.starfield.update(dt);
    this.particles.update(dt);

    const scoreT = Math.max(0, Math.min(1, (this.time - 0.55) / 1.35));
    this.displayedScore = Math.floor(this.score * easeOutCubic(scoreT));

    this.confettiTimer -= dt;
    if (this.confettiTimer <= 0) {
      this.confettiTimer = 0.12;
      const w = this.game.width;
      const h = this.game.height;
      const x = Math.random() * w;
      const colors = [GOLD, AMBER, ICE, "#ffffff"];
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.particles.explosion(x, Math.random() * h * 0.65, c, 5, 110);
      if (Math.random() < 0.35) {
        this.particles.spark(x, Math.random() * h * 0.5, ICE, 3);
      }
    }

    for (const click of this.game.consumeClicks()) {
      if (this.time < 1.2) continue;
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
    if (this.game.input.wasPressed("KeyR") && this.time >= 1.2) this.again();
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    const bg = ctx.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h * 0.38, Math.max(w, h) * 0.95);
    bg.addColorStop(0, "#0c1420");
    bg.addColorStop(0.5, "#060a12");
    bg.addColorStop(1, BG_DEEP);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.renderGoldNebula(ctx, w, h);
    this.starfield.renderNebula(ctx);
    this.starfield.render(ctx);
    this.particles.render(ctx);

    const cx = w / 2;
    const cy = h / 2;
    const rank = getRank(this.score);
    const intro = easeOutCubic(Math.min(1, this.time / 0.9));
    const uiFade = easeOutCubic(Math.max(0, Math.min(1, (this.time - 1.1) / 0.7)));

    this.renderVictoryRing(ctx, cx, cy - 88, intro);

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = intro;

    const titlePulse = 0.9 + Math.sin(this.time * 2.2) * 0.1;
    const titleSize = 58 * (0.72 + intro * 0.28) * titlePulse;
    ctx.font = `700 ${titleSize}px ${FONT_DISPLAY}`;
    ctx.fillStyle = GOLD;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 42 * titlePulse;
    ctx.letterSpacing = "10px";
    ctx.fillText("VICTORY", cx, cy - 118);

    ctx.shadowBlur = 0;
    ctx.font = `500 13px ${FONT_UI}`;
    ctx.fillStyle = ICE;
    ctx.letterSpacing = "5px";
    ctx.fillText("MISSION COMPLETE", cx, cy - 72);

    ctx.font = `400 13px ${FONT_UI}`;
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "0px";
    ctx.globalAlpha = intro * 0.85;
    ctx.fillText("The void is yours, Commander.", cx, cy - 48);
    ctx.globalAlpha = intro;

    ctx.font = `900 72px 'Orbitron', sans-serif`;
    ctx.fillStyle = rank === "S" ? GOLD : AMBER;
    ctx.shadowColor = rank === "S" ? GOLD : AMBER;
    ctx.shadowBlur = 28;
    ctx.letterSpacing = "0px";
    ctx.fillText(rank, cx - 148, cy + 6);
    ctx.shadowBlur = 0;

    ctx.font = `400 10px ${FONT_MONO}`;
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "2px";
    ctx.fillText("RANK", cx - 148, cy + 42);

    ctx.font = `400 28px ${FONT_MONO}`;
    ctx.fillStyle = WARM_W;
    ctx.letterSpacing = "3px";
    ctx.fillText(this.displayedScore.toString().padStart(8, "0"), cx + 24, cy + 8);

    ctx.font = `400 10px ${FONT_MONO}`;
    ctx.fillStyle = DIM;
    ctx.fillText("FINAL SCORE", cx + 24, cy + 40);
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = uiFade;
    renderLeaderboard(ctx, cx, cy + 58, {
      title: "HIGH SCORES",
      maxRows: 5,
      highlightScore: this.score,
      width: Math.min(340, w - 48),
    });
    this.renderButtons(ctx, uiFade);
    this.renderHint(ctx, cx, h - 36, uiFade);
    ctx.restore();

    this.renderVignette(ctx, w, h);
  }

  private renderGoldNebula(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const pulse = 0.85 + Math.sin(this.time * 0.7) * 0.15;
    const g = ctx.createRadialGradient(w * 0.5, h * 0.32, 0, w * 0.5, h * 0.32, w * 0.5);
    g.addColorStop(0, `rgba(232, 168, 64, ${0.09 * pulse})`);
    g.addColorStop(0.45, `rgba(128, 200, 255, ${0.04 * pulse})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  private renderVictoryRing(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    intro: number,
  ): void {
    const r = 88 + Math.sin(this.time * 1.8) * 6;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = intro * 0.55;
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, r * intro, 0, Math.PI * 2);
    ctx.stroke();
    ctx.rotate(this.time * 0.4);
    ctx.globalAlpha = intro * 0.25;
    ctx.setLineDash([8, 14]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private renderButtons(ctx: CanvasRenderingContext2D, alpha: number): void {
    const p = this.game.pointer;
    for (const b of this.buttons) {
      const hover = p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      const color = b.primary ? AMBER : ICE;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = hover ? 28 : 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = hover ? color + "28" : "#00000055";
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = hover ? 12 : 4;
      ctx.fillStyle = hover ? WARM_W : color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = b.primary
        ? `500 15px ${FONT_UI}`
        : `400 13px ${FONT_UI}`;
      ctx.letterSpacing = b.primary ? "3px" : "2px";
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      ctx.restore();
    }
  }

  private renderHint(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    alpha: number,
  ): void {
    ctx.save();
    ctx.globalAlpha = alpha * 0.9;
    ctx.textAlign = "center";
    ctx.font = `400 11px ${FONT_MONO}`;
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "1px";
    ctx.fillText("R PLAY AGAIN · ESC MENU · M MUTE", x, y);
    ctx.restore();
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
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 2.5, w / 2, h / 2, Math.max(w, h) / 1.05);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

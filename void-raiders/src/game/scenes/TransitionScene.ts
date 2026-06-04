// Warp entre niveles — star-warp + stats del sector

import type { Scene } from "../../types";
import type { Game } from "../Game";
import { Starfield } from "../systems/Starfield";
import { GameScene } from "./GameScene";
import { soundManager } from "../../audio/SoundManager";

const AMBER  = "#e8a840";
const ICE    = "#80c8ff";
const DIM    = "#667788";
const WARM_W = "#f0e8d0";

const DURATION = 3;

export class TransitionScene implements Scene {
  private readonly starfield = new Starfield(2.8);
  private readonly game: Game;
  private readonly nextLevel: number;
  private readonly levelName: string;
  private readonly score: number;
  private readonly kills: number;
  private time = 0;

  constructor(game: Game, nextLevel: number, levelName: string, score: number, kills: number) {
    this.game = game;
    this.nextLevel = nextLevel;
    this.levelName = levelName;
    this.score = score;
    this.kills = kills;
  }

  enter(): void {
    soundManager.init();
    soundManager.play("warp");
    this.starfield.resize(this.game.width, this.game.height);
  }

  resize(): void {
    this.starfield.resize(this.game.width, this.game.height);
  }

  update(dt: number): void {
    this.time += dt;
    this.starfield.update(dt * (1 + this.time * 0.8));

    if (this.time >= DURATION) {
      this.game.changeScene(new GameScene(this.game, this.nextLevel));
    }
    if (this.game.input.wasPressed("KeyM")) soundManager.toggleMute();
    if (this.game.input.wasPressed("Escape")) {
      soundManager.play("menu_back");
      this.game.changeScene(new GameScene(this.game, this.nextLevel));
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;
    const cx = w / 2;
    const cy = h / 2;
    const t = Math.min(1, this.time / DURATION);
    const warp = t * t;

    ctx.fillStyle = "#020408";
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + warp * 0.4, 1 + warp * 0.4);
    ctx.translate(-cx, -cy);
    this.starfield.renderNebula(ctx);
    this.starfield.render(ctx);
    ctx.restore();

    // Líneas de warp hacia el centro
    ctx.save();
    ctx.translate(cx, cy);
    const rays = 24;
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + this.time * 0.5;
      const len = 40 + warp * Math.max(w, h) * 0.55;
      ctx.strokeStyle = `rgba(128,200,255,${0.08 + warp * 0.25})`;
      ctx.lineWidth = 1 + warp * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 20, Math.sin(a) * 20);
      ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = Math.min(1, t * 2);

    ctx.font = "700 14px 'JetBrains Mono', monospace";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "4px";
    ctx.fillText("WARPING TO", cx, cy - 72);
    ctx.letterSpacing = "0px";

    ctx.font = "900 42px 'Orbitron', sans-serif";
    ctx.fillStyle = ICE;
    ctx.shadowColor = ICE;
    ctx.shadowBlur = 28;
    ctx.fillText(this.levelName.toUpperCase(), cx, cy - 28);
    ctx.shadowBlur = 0;

    ctx.font = "400 14px 'Exo 2', sans-serif";
    ctx.fillStyle = DIM;
    ctx.fillText(`Sector cleared · ${this.kills} hostiles eliminated`, cx, cy + 18);

    ctx.font = "700 22px 'JetBrains Mono', monospace";
    ctx.fillStyle = WARM_W;
    ctx.fillText(this.score.toString().padStart(8, "0"), cx, cy + 52);

    const remain = Math.ceil(DURATION - this.time);
    ctx.font = "400 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = AMBER + "aa";
    ctx.fillText(`ENGAGING IN ${remain}s`, cx, cy + 88);

    ctx.restore();

    this.renderVignette(ctx, w, h, warp);
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number, warp: number): void {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / (3 - warp), w / 2, h / 2, Math.max(w, h) / 1.02);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, `rgba(0,0,0,${0.5 + warp * 0.35})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

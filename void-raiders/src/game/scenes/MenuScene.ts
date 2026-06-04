// Menu de inicio estilo Interstellar: fondo cósmico, disco de acreción, paleta ámbar

import type { Scene } from "../../types";
import type { Game } from "../Game";
import { Starfield } from "../systems/Starfield";
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

// Paleta Interstellar
const AMBER   = "#e8a840";
const ICE     = "#80c8ff";
const WARM_W  = "#f4ead8";
const DIM     = "#8899aa";

export class MenuScene implements Scene {
  private readonly starfield = new Starfield(0.6);
  private buttons: Button[] = [];
  private time = 0;
  private diskAngle = 0;
  private micState: "off" | "requesting" | "ready" | "denied" = "off";
  private toast = "";
  private toastTimer = 0;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    soundManager.init();
    soundManager.startAmbient();
    this.starfield.resize(this.game.width, this.game.height);
    this.buildButtons();
  }

  exit(): void {
    soundManager.stopAmbient();
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
        label: "LAUNCH MISSION",
        x: cx - 155,
        y: cy + 88,
        w: 310,
        h: 52,
        primary: true,
        onClick: () => this.launch(),
      },
      {
        label: this.micLabel(),
        x: cx - 115,
        y: cy + 160,
        w: 230,
        h: 40,
        primary: false,
        onClick: () => this.enableMic(),
      },
    ];
  }

  private micLabel(): string {
    switch (this.micState) {
      case "ready":     return "MIC READY  ✓";
      case "requesting": return "...";
      case "denied":    return "MIC BLOCKED";
      default:          return "ENABLE MIC";
    }
  }

  private launch(): void {
    soundManager.play('ui_click');
    soundManager.resume();
    this.game.changeScene(new GameScene(this.game));
  }

  private async enableMic(): Promise<void> {
    if (this.micState === "ready" || this.micState === "requesting") return;
    soundManager.play('ui_click');
    this.micState = "requesting";
    this.buildButtons();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      this.micState = "ready";
      this.showToast("MICROPHONE ONLINE");
    } catch {
      this.micState = "denied";
      this.showToast("MICROPHONE ACCESS DENIED");
    }
    this.buildButtons();
  }

  private showToast(msg: string): void {
    this.toast = msg;
    this.toastTimer = 2.5;
  }

  update(dt: number): void {
    this.time += dt;
    this.diskAngle += dt * 0.4;
    if (this.toastTimer > 0) this.toastTimer -= dt;
    this.starfield.update(dt);

    for (const click of this.game.consumeClicks()) {
      for (const b of this.buttons) {
        if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
          b.onClick();
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    // Fondo: negro espacio profundo con gradiente radial muy sutil
    const bg = ctx.createRadialGradient(w / 2, h * 0.4, 0, w / 2, h * 0.4, Math.max(w, h) * 0.9);
    bg.addColorStop(0, "#07090f");
    bg.addColorStop(1, "#020306");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Nebulosas de fondo
    this.starfield.renderNebula(ctx);

    // Estrellas con parallax sutil al mover el puntero
    const px = (this.game.pointer.x / this.game.width - 0.5) * 18;
    const py = (this.game.pointer.y / this.game.height - 0.5) * 14;
    this.starfield.render(ctx, px, py);

    const cx = w / 2;
    const cy = h / 2;
    const shipY = cy - 80 + Math.sin(this.time * 1.2) * 10;

    this.renderAccretionDisk(ctx, cx, shipY);
    this.renderShip(ctx, cx, shipY);
    this.renderTitle(ctx, cx, cy - 195);
    this.renderTagline(ctx, cx, cy - 140);
    this.renderButtons(ctx);
    this.renderHint(ctx, cx, h - 44);
    this.renderToast(ctx, cx, cy + 225);
    this.renderVersionBadge(ctx, w - 20, h - 20);
    this.renderVignette(ctx, w, h);
  }

  // ─── disco de acreción (efecto Interstellar/Gargantua) ─────────────────────

  private renderAccretionDisk(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    const rings = [
      { rx: 70, ry: 16, alpha: 0.22, color: "#e8a840", width: 5 },
      { rx: 85, ry: 19, alpha: 0.12, color: "#d07020", width: 8 },
      { rx: 60, ry: 13, alpha: 0.14, color: "#f8c860", width: 3 },
    ];

    for (const ring of rings) {
      ctx.save();
      ctx.rotate(this.diskAngle * 0.3);
      ctx.globalAlpha = ring.alpha * (0.8 + Math.sin(this.time * 2.2) * 0.2);
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.width;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.ellipse(0, 0, ring.rx, ring.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Anillo interior brillante
    ctx.rotate(-this.diskAngle * 0.5);
    ctx.globalAlpha = 0.3 + Math.sin(this.time * 3) * 0.08;
    ctx.strokeStyle = "#fff8e0";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#ffe080";
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.ellipse(0, 0, 46, 10, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ─── nave flotante ─────────────────────────────────────────────────────────

  private renderShip(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);

    // Motores (resplandor posterior)
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 30;
    ctx.fillStyle = AMBER + "88";
    ctx.beginPath();
    ctx.moveTo(-14, -4);
    ctx.lineTo(-22, 0);
    ctx.lineTo(-14, 4);
    ctx.closePath();
    ctx.fill();

    // Cuerpo de la nave — blanco cálido, estilo spacecraft
    ctx.shadowColor = "#d8c8a0";
    ctx.shadowBlur = 20;
    ctx.fillStyle = WARM_W;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-14, -12);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-14, 12);
    ctx.closePath();
    ctx.fill();

    // Franja de acento ámbar
    ctx.shadowBlur = 8;
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(10, -6);
    ctx.lineTo(-10, -8);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 6);
    ctx.lineTo(-10, 8);
    ctx.stroke();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ─── título y texto ────────────────────────────────────────────────────────

  private renderTitle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Glow suave detrás del título
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 60;
    ctx.font = "900 68px 'Orbitron', sans-serif";
    ctx.letterSpacing = "14px";
    ctx.fillStyle = AMBER + "44";
    ctx.fillText("VOID RAIDERS", x, y);

    // Degradado ámbar → blanco cálido
    const grad = ctx.createLinearGradient(x - 300, y - 40, x + 300, y + 40);
    grad.addColorStop(0, "#d48820");
    grad.addColorStop(0.45, "#f8e880");
    grad.addColorStop(0.55, "#fff4c8");
    grad.addColorStop(1, "#e8a840");
    ctx.shadowBlur = 28;
    ctx.fillStyle = grad;
    ctx.fillText("VOID RAIDERS", x, y);
    ctx.restore();
  }

  private renderTagline(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 0;
    ctx.font = "400 15px 'Exo 2', sans-serif";
    ctx.letterSpacing = "5px";
    ctx.fillStyle = ICE + "cc";
    ctx.fillText("AI-POWERED SPACE COMBAT", x, y);
    ctx.restore();
  }

  // ─── botones ───────────────────────────────────────────────────────────────

  private renderButtons(ctx: CanvasRenderingContext2D): void {
    const p = this.game.pointer;
    for (const b of this.buttons) {
      const hover = p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      const color = b.primary ? AMBER : ICE;

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = hover ? 30 : 10;

      // Fondo semitransparente con borde neon
      ctx.strokeStyle = color;
      ctx.lineWidth = hover ? 1.5 : 1;
      ctx.fillStyle = hover ? color + "28" : "#00000055";
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      ctx.stroke();

      // Texto del botón
      ctx.shadowBlur = hover ? 14 : 4;
      ctx.fillStyle = hover ? WARM_W : color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.letterSpacing = "3px";
      ctx.font = b.primary ? "700 17px 'Orbitron', sans-serif" : "400 14px 'Orbitron', sans-serif";
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      ctx.restore();
    }
  }

  // ─── elementos secundarios ─────────────────────────────────────────────────

  private renderHint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "400 13px 'JetBrains Mono', monospace";
    ctx.letterSpacing = "1px";
    ctx.fillStyle = DIM;
    ctx.fillText("WASD · Mouse aim · Click shoot · Voice: talk to NOVA", x, y);
    ctx.restore();
  }

  private renderToast(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (this.toastTimer <= 0) return;
    const alpha = Math.min(1, this.toastTimer * 2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.font = "400 14px 'JetBrains Mono', monospace";
    ctx.letterSpacing = "2px";
    ctx.fillStyle = AMBER;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 12;
    ctx.fillText(this.toast, x, y);
    ctx.restore();
  }

  private renderVersionBadge(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.font = "400 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = DIM + "77";
    ctx.fillText("VOID RAIDERS v2 · Platzi × Devin 2026", x, y);
    ctx.restore();
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 2.2, w / 2, h / 2, Math.max(w, h) / 1.05);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.82)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // ─── utilidad ──────────────────────────────────────────────────────────────

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

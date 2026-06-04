// Menu de inicio: starfield parallax, título, nave idle y botones

import type { Scene } from "../../types";
import type { Game } from "../Game";

interface Star {
  x: number;
  y: number;
  z: number; // capa de profundidad 0..1 (mayor = más cercana/rápida)
  size: number;
}

interface Button {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  onClick: () => void;
}

const CYAN = "#00ffff";
const STAR_LAYERS = 3;

export class MenuScene implements Scene {
  private stars: Star[] = [];
  private buttons: Button[] = [];
  private time = 0;
  private micState: "off" | "requesting" | "ready" | "denied" = "off";
  private toast = "";
  private toastTimer = 0;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    this.spawnStars();
    this.buildButtons();
  }

  resize(): void {
    this.spawnStars();
    this.buildButtons();
  }

  private spawnStars(): void {
    const count = Math.floor((this.game.width * this.game.height) / 6000);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      const z = (Math.floor(Math.random() * STAR_LAYERS) + 1) / STAR_LAYERS;
      this.stars.push({
        x: Math.random() * this.game.width,
        y: Math.random() * this.game.height,
        z,
        size: z * 1.8,
      });
    }
  }

  private buildButtons(): void {
    const cx = this.game.width / 2;
    const cy = this.game.height / 2;
    this.buttons = [
      {
        label: "[ LAUNCH MISSION ]",
        x: cx - 150,
        y: cy + 80,
        w: 300,
        h: 56,
        color: CYAN,
        onClick: () => this.launch(),
      },
      {
        label: this.micLabel(),
        x: cx - 110,
        y: cy + 156,
        w: 220,
        h: 44,
        color: "#ff00ff",
        onClick: () => this.enableMic(),
      },
    ];
  }

  private micLabel(): string {
    switch (this.micState) {
      case "ready":
        return "[ MIC READY ]";
      case "requesting":
        return "[ ... ]";
      case "denied":
        return "[ MIC BLOCKED ]";
      default:
        return "[ ENABLE MIC ]";
    }
  }

  private launch(): void {
    // GameScene se conecta en la Etapa 2.
    this.showToast("INICIANDO MISIÓN... (gameplay en Etapa 2)");
    console.info("[VOID RAIDERS] LAUNCH MISSION");
  }

  private async enableMic(): Promise<void> {
    if (this.micState === "ready" || this.micState === "requesting") return;
    this.micState = "requesting";
    this.buildButtons();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      this.micState = "ready";
      this.showToast("MICRÓFONO LISTO");
    } catch {
      this.micState = "denied";
      this.showToast("PERMISO DE MICRÓFONO DENEGADO");
    }
    this.buildButtons();
  }

  private showToast(msg: string): void {
    this.toast = msg;
    this.toastTimer = 2.5;
  }

  update(dt: number): void {
    this.time += dt;
    if (this.toastTimer > 0) this.toastTimer -= dt;

    // movimiento del starfield (parallax por capa)
    for (const s of this.stars) {
      s.y += s.z * 14 * dt * 60 * 0.016;
      if (s.y > this.game.height) {
        s.y = 0;
        s.x = Math.random() * this.game.width;
      }
    }

    // clicks sobre botones
    for (const click of this.game.consumeClicks()) {
      for (const b of this.buttons) {
        if (
          click.x >= b.x &&
          click.x <= b.x + b.w &&
          click.y >= b.y &&
          click.y <= b.y + b.h
        ) {
          b.onClick();
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    // fondo con gradiente radial
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.2);
    grad.addColorStop(0, "#0d1326");
    grad.addColorStop(1, "#0a0a0f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    this.renderStars(ctx);
    this.renderShip(ctx, w / 2, h / 2 - 90);
    this.renderTitle(ctx, w / 2, h / 2 - 200);
    this.renderButtons(ctx);
    this.renderHint(ctx, w / 2, h - 48);
    this.renderToast(ctx, w / 2, h / 2 + 230);
    this.renderVignette(ctx, w, h);
  }

  private renderStars(ctx: CanvasRenderingContext2D): void {
    // leve parallax con el puntero
    const px = (this.game.pointer.x / this.game.width - 0.5) * 20;
    const py = (this.game.pointer.y / this.game.height - 0.5) * 20;
    for (const s of this.stars) {
      ctx.globalAlpha = 0.3 + s.z * 0.7;
      ctx.fillStyle = "#cfe8ff";
      ctx.fillRect(s.x + px * s.z, s.y + py * s.z, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }

  private renderShip(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const float = Math.sin(this.time * 1.5) * 8;
    ctx.save();
    ctx.translate(x, y + float);
    ctx.rotate(-Math.PI / 2); // apuntando hacia arriba
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 24;
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.moveTo(22, 0);
    ctx.lineTo(-16, -14);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-16, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private renderTitle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "12px";
    ctx.font = "700 64px Orbitron, sans-serif";
    ctx.shadowColor = CYAN;
    ctx.shadowBlur = 30;
    ctx.fillStyle = CYAN;
    ctx.fillText("VOID RAIDERS", x, y);

    ctx.shadowBlur = 0;
    ctx.letterSpacing = "4px";
    ctx.font = "400 18px 'Exo 2', sans-serif";
    ctx.fillStyle = "#9fd8ff";
    ctx.fillText("AI-POWERED SPACE SHOOTER", x, y + 50);
    ctx.restore();
  }

  private renderButtons(ctx: CanvasRenderingContext2D): void {
    const p = this.game.pointer;
    for (const b of this.buttons) {
      const hover =
        p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
      ctx.save();
      ctx.shadowColor = b.color;
      ctx.shadowBlur = hover ? 26 : 12;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.fillStyle = hover ? `${b.color}22` : "#00000055";
      this.roundRect(ctx, b.x, b.y, b.w, b.h, 6);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = hover ? 12 : 0;
      ctx.fillStyle = b.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.letterSpacing = "2px";
      ctx.font = "700 18px Orbitron, sans-serif";
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
      ctx.restore();
    }
  }

  private renderHint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "400 14px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#5f7a99";
    ctx.fillText("WASD move · Mouse aim · Click shoot · Talk to NOVA", x, y);
    ctx.restore();
  }

  private renderToast(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (this.toastTimer <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, this.toastTimer);
    ctx.textAlign = "center";
    ctx.font = "400 16px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#ffd166";
    ctx.fillText(this.toast, x, y);
    ctx.restore();
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 2.5, w / 2, h / 2, Math.max(w, h) / 1.1);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

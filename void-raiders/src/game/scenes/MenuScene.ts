// Menu de inicio — Interstellar/cinematic: paleta ámbar/hielo, tipografía limpia, sin cajas UI

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

interface MenuParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// Paleta Interstellar
const AMBER    = "#e8a840";
const GOLD     = "#f8d060";
const ICE      = "#80c8ff";
const WARM_W   = "#f4ead8";
const DIM      = "#8899aa";
const DIM_DARK = "#667788";
const BG_DEEP  = "#020408";
const RED_ACC  = "#cc4455";

const FONT_DISPLAY = "'Cormorant Garamond', serif";
const FONT_UI      = "'DM Sans', sans-serif";
const FONT_MONO    = "'JetBrains Mono', monospace";

export class MenuScene implements Scene {
  private readonly starfield = new Starfield(1.35);
  private buttons: Button[] = [];
  private particles: MenuParticle[] = [];
  private time = 0;
  private micState: "off" | "requesting" | "ready" | "denied" = "off";
  private toast = "";
  private toastTimer = 0;
  private hoveredButton: Button | null = null;
  private readonly game: Game;

  constructor(game: Game) {
    this.game = game;
  }

  enter(): void {
    soundManager.init();
    soundManager.startAmbient("menu");
    this.starfield.resize(this.game.width, this.game.height);
    this.seedParticles();
    this.buildButtons();
  }

  exit(): void {
    soundManager.stopAmbient();
  }

  resize(): void {
    this.starfield.resize(this.game.width, this.game.height);
    this.seedParticles();
    this.buildButtons();
  }

  private seedParticles(): void {
    const { width: w, height: h } = this.game;
    this.particles = [];
    const count = Math.floor((w * h) / 48000);
    for (let i = 0; i < count; i++) {
      this.particles.push(this.makeParticle(w, h, true));
    }
  }

  private makeParticle(w: number, h: number, randomY = false): MenuParticle {
    const colors = [AMBER + "99", ICE + "88", GOLD + "66", WARM_W + "44"];
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : h + 8,
      vx: (Math.random() - 0.5) * 18,
      vy: -(8 + Math.random() * 28),
      life: 2 + Math.random() * 4,
      maxLife: 2 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 0.5 + Math.random() * 1.5,
    };
  }

  private buildButtons(): void {
    const cx = this.game.width / 2;
    const cy = this.game.height / 2;
    this.buttons = [
      {
        label: "LAUNCH MISSION",
        x: cx - 155,
        y: cy + 72,
        w: 310,
        h: 52,
        primary: true,
        onClick: () => this.launch(),
      },
      {
        label: this.micLabel(),
        x: cx - 115,
        y: cy + 144,
        w: 230,
        h: 40,
        primary: false,
        onClick: () => this.enableMic(),
      },
    ];
  }

  private micLabel(): string {
    switch (this.micState) {
      case "ready":      return "MIC READY  ✓";
      case "requesting": return "…";
      case "denied":     return "MIC BLOCKED";
      default:           return "ENABLE MIC";
    }
  }

  private launch(): void {
    soundManager.play("ui_click");
    soundManager.resume();
    this.game.changeScene(new GameScene(this.game));
  }

  private async enableMic(): Promise<void> {
    if (this.micState === "ready" || this.micState === "requesting") return;
    soundManager.play("ui_click");
    this.micState = "requesting";
    this.buildButtons();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      this.micState = "ready";
      this.showToast("MICROPHONE ONLINE");
      soundManager.play("powerup");
    } catch {
      this.micState = "denied";
      this.showToast("MICROPHONE ACCESS DENIED");
      soundManager.play("player_hit");
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
    this.starfield.update(dt);
    this.updateParticles(dt);

    if (this.game.input.wasPressed("KeyM")) {
      soundManager.toggleMute();
    }

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
      if (this.hitMuteToggle(click.x, click.y)) {
        soundManager.toggleMute();
        continue;
      }
      for (const b of this.buttons) {
        if (click.x >= b.x && click.x <= b.x + b.w && click.y >= b.y && click.y <= b.y + b.h) {
          b.onClick();
        }
      }
    }
  }

  private updateParticles(dt: number): void {
    const { width: w, height: h } = this.game;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y < -12) {
        Object.assign(p, this.makeParticle(w, h));
      }
    }
  }

  private muteToggleRect(): { x: number; y: number; w: number; h: number } {
    return { x: 20, y: 20, w: 120, h: 28 };
  }

  private hitMuteToggle(x: number, y: number): boolean {
    const r = this.muteToggleRect();
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    const bg = ctx.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h * 0.38, Math.max(w, h) * 0.92);
    bg.addColorStop(0, "#0a1018");
    bg.addColorStop(0.55, "#050810");
    bg.addColorStop(1, BG_DEEP);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    this.starfield.renderNebula(ctx);

    const px = (this.game.pointer.x / this.game.width - 0.5) * 12;
    const py = (this.game.pointer.y / this.game.height - 0.5) * 8;
    this.starfield.render(ctx, px, py);

    this.renderParticles(ctx);

    const cx = w / 2;
    const cy = h / 2;

    this.renderTitle(ctx, cx, cy - 210);
    this.renderTagline(ctx, cx, cy - 168);
    this.renderHowToPlay(ctx, cx, cy - 32);

    this.renderButtons(ctx);
    this.renderAudioToggle(ctx);
    this.renderHint(ctx, cx, h - 40);
    this.renderToast(ctx, cx, cy + 218);
    this.renderVignette(ctx, w, h);
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.35;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size * 0.4);
      ctx.restore();
    }
  }

  private renderTitle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `500 64px ${FONT_DISPLAY}`;
    ctx.letterSpacing = "6px";
    ctx.fillStyle = WARM_W;
    ctx.fillText("VOID RAIDERS", x, y);
    ctx.restore();
  }

  private renderTagline(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `300 12px ${FONT_UI}`;
    ctx.letterSpacing = "5px";
    ctx.fillStyle = DIM;
    ctx.fillText("DEEP SPACE COMBAT", x, y);
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
      ctx.letterSpacing = b.primary ? "4px" : "2px";
      ctx.font = b.primary
        ? `400 14px ${FONT_UI}`
        : `300 12px ${FONT_UI}`;
      ctx.fillStyle = hover ? WARM_W : (b.primary ? WARM_W : DIM);
      ctx.fillText(b.label, tx, ty);

      if (hover && b.primary) {
        const underlineW = Math.min(b.w * 0.5, ctx.measureText(b.label).width + 8);
        ctx.strokeStyle = AMBER + "99";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(tx - underlineW / 2, ty + 12);
        ctx.lineTo(tx + underlineW / 2, ty + 12);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private renderAudioToggle(ctx: CanvasRenderingContext2D): void {
    const r = this.muteToggleRect();
    const p = this.game.pointer;
    const hover = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    const label = soundManager.isMuted ? "AUDIO OFF" : "AUDIO ON";

    ctx.save();
    ctx.font = `400 10px ${FONT_MONO}`;
    ctx.fillStyle = hover ? WARM_W : DIM;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = "2px";
    if (hover) {
      ctx.shadowColor = ICE;
      ctx.shadowBlur = 6;
    }
    ctx.fillText(`${label} · M`, r.x, r.y + r.h / 2);
    ctx.restore();
  }

  private renderHowToPlay(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const lines = [
      "WASD o flechas para mover · ratón para apuntar y clic para disparar",
      "Teclas 1–6 cambian el arma · espacio lanza bomba",
      "Destruye oleadas y derrota al jefe de cada nivel",
    ];

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const ruleW = 48;
    ctx.strokeStyle = DIM_DARK + "88";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - ruleW, y - 58);
    ctx.lineTo(x + ruleW, y - 58);
    ctx.stroke();

    ctx.font = `400 11px ${FONT_UI}`;
    ctx.letterSpacing = "2px";
    ctx.fillStyle = DIM;
    ctx.fillText("cómo jugar", x, y - 42);

    ctx.font = `300 13px ${FONT_UI}`;
    ctx.letterSpacing = "0.2px";
    let lineY = y - 14;
    for (const line of lines) {
      ctx.fillStyle = DIM + "dd";
      ctx.fillText(line, x, lineY);
      lineY += 22;
    }
    ctx.restore();
  }

  private renderHint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `300 11px ${FONT_UI}`;
    ctx.letterSpacing = "0.5px";
    ctx.fillStyle = DIM_DARK;
    ctx.fillText("LAUNCH MISSION para empezar  ·  M silencia audio", x, y);
    ctx.restore();
  }

  private renderToast(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    if (this.toastTimer <= 0) return;
    const alpha = Math.min(1, this.toastTimer * 2);
    const isError = this.toast.includes("DENIED");
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.font = `400 13px ${FONT_MONO}`;
    ctx.letterSpacing = "2px";
    ctx.fillStyle = isError ? RED_ACC : AMBER;
    ctx.shadowColor = isError ? RED_ACC : AMBER;
    ctx.shadowBlur = 10;
    ctx.fillText(this.toast, x, y);
    ctx.restore();
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 2.4, w / 2, h / 2, Math.max(w, h) * 1.02);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

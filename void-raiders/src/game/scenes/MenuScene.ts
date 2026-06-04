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

const FONT_DISPLAY = "'Syne', sans-serif";
const FONT_UI      = "'IBM Plex Sans', sans-serif";
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
    const count = Math.floor((w * h) / 22000);
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

    this.renderMenuNebulaBoost(ctx, w, h);
    this.starfield.renderNebula(ctx);

    const px = (this.game.pointer.x / this.game.width - 0.5) * 22;
    const py = (this.game.pointer.y / this.game.height - 0.5) * 16;
    this.starfield.render(ctx, px, py);

    this.renderParticles(ctx);

    const cx = w / 2;
    const cy = h / 2;
    const diskY = cy - 72;

    this.renderAccretionDisk(ctx, cx, diskY);
    this.renderHorizonGlow(ctx, cx, diskY + 28);

    this.renderTitle(ctx, cx, cy - 198);
    this.renderTagline(ctx, cx, cy - 138);

    this.renderButtons(ctx);
    this.renderAudioToggle(ctx);
    this.renderHint(ctx, cx, h - 40);
    this.renderToast(ctx, cx, cy + 218);
    this.renderVignette(ctx, w, h);
  }

  /** Capa extra de nebulosa solo en menú */
  private renderMenuNebulaBoost(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const drift = Math.sin(this.time * 0.12) * 0.02;

    const g1 = ctx.createRadialGradient(w * (0.82 + drift), h * 0.18, 0, w * 0.82, h * 0.18, w * 0.55);
    g1.addColorStop(0, "rgba(232, 168, 64, 0.09)");
    g1.addColorStop(0.45, "rgba(200, 120, 30, 0.04)");
    g1.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(w * (0.12 - drift), h * 0.78, 0, w * 0.12, h * 0.78, w * 0.48);
    g2.addColorStop(0, "rgba(128, 200, 255, 0.1)");
    g2.addColorStop(0.5, "rgba(40, 90, 180, 0.04)");
    g2.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);
  }

  private renderParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.save();
      ctx.globalAlpha = t * 0.7;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4;
      ctx.fillRect(p.x, p.y, p.size, p.size * 0.4);
      ctx.restore();
    }
  }

  /** Disco de acreción estático y muy sutil */
  private renderAccretionDisk(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);

    const rings = [
      { rx: 78, ry: 18, alpha: 0.14, color: AMBER, width: 4 },
      { rx: 94, ry: 21, alpha: 0.08, color: "#d07020", width: 6 },
      { rx: 64, ry: 14, alpha: 0.1, color: GOLD, width: 2 },
    ];

    for (const ring of rings) {
      ctx.save();
      ctx.globalAlpha = ring.alpha;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = ring.width;
      ctx.shadowColor = ring.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.ellipse(0, 0, ring.rx, ring.ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.globalAlpha = 0.2;
    ctx.strokeStyle = WARM_W + "99";
    ctx.lineWidth = 1.5;
    ctx.shadowColor = GOLD;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 11, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.75;
    const core = ctx.createRadialGradient(0, 0, 0, 0, 0, 22);
    core.addColorStop(0, "rgba(0,0,0,0.95)");
    core.addColorStop(0.7, "rgba(2,4,8,0.6)");
    core.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.globalAlpha = 1;
  }

  private renderHorizonGlow(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = 0.14;
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 280);
    glow.addColorStop(0, AMBER + "44");
    glow.addColorStop(0.4, "rgba(200, 120, 40, 0.08)");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, 260, 38, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = GOLD + "66";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 0, 160, 12, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private renderTitle(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `600 58px ${FONT_DISPLAY}`;
    ctx.letterSpacing = "8px";

    const grad = ctx.createLinearGradient(x - 280, y, x + 280, y);
    grad.addColorStop(0, AMBER);
    grad.addColorStop(0.45, GOLD);
    grad.addColorStop(0.55, WARM_W);
    grad.addColorStop(1, AMBER);

    ctx.fillStyle = grad;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 28;
    ctx.fillText("VOID RAIDERS", x, y);
    ctx.restore();
  }

  private renderTagline(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `400 13px ${FONT_UI}`;
    ctx.letterSpacing = "4px";
    ctx.fillStyle = ICE + "bb";
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
      ctx.letterSpacing = b.primary ? "3px" : "2px";
      ctx.font = b.primary
        ? `500 15px ${FONT_UI}`
        : `400 13px ${FONT_UI}`;
      ctx.fillStyle = hover ? WARM_W : accent;
      if (hover) {
        ctx.shadowColor = accent;
        ctx.shadowBlur = 10;
      }
      ctx.fillText(b.label, tx, ty);

      if (hover) {
        const underlineW = Math.min(b.w * 0.55, ctx.measureText(b.label).width + 12);
        ctx.shadowBlur = 0;
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

  private renderHint(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `400 11px ${FONT_MONO}`;
    ctx.letterSpacing = "1px";
    ctx.fillStyle = DIM_DARK;
    ctx.fillText("WASD · AIM · SHOOT · 1–6 · SPACE · M MUTE", x, y);
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
    g.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
}

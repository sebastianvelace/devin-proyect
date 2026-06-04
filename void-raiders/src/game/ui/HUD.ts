// HUD cinematográfico estilo Interstellar — ámbar + azul hielo

import type { WeaponType } from "../../types";
import { WEAPON_LABEL } from "../systems/WeaponSystem";

export interface HudState {
  score: number;
  level: number;
  levelName: string;
  wave: number;
  totalWaves: number;
  lives: number;
  weapon: WeaponType;
  weaponColor: string;
  multiplier: number;
  // munición
  ammo: number;
  maxAmmo: number;
  isReloading: boolean;
  reloadProgress: number; // 0..1
  bombs?: number;
  buffLabel?: string;
  buffTimer?: number;
  // boss (opcionales)
  bossHp?: number;
  bossMaxHp?: number;
  bossPhase?: number;
  bossColor?: string;
  bossName?: string;
}

const AMBER  = "#e8a840";
const ICE    = "#80c8ff";
const DIM    = "#667788";
const WARM_W = "#f0e8d0";

export interface HudButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class HUD {
  restartButtonRect(_w: number, h: number, hasBoss: boolean): HudButtonRect {
    return { x: 18, y: hasBoss ? h - 78 : h - 34, w: 130, h: 26 };
  }

  hitRestartButton(px: number, py: number, w: number, h: number, hasBoss: boolean): boolean {
    const r = this.restartButtonRect(w, h, hasBoss);
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  render(ctx: CanvasRenderingContext2D, w: number, h: number, state: HudState, restartHover = false): void {
    ctx.save();

    this.renderTopBar(ctx, w, state);
    this.renderLives(ctx, state.lives);
    this.renderWeapon(ctx, state.weapon, state.weaponColor);
    this.renderAmmo(ctx, state);
    this.renderLevelInfo(ctx, w, state);

    if (state.buffLabel && state.buffTimer !== undefined && state.buffTimer > 0) {
      this.renderBuff(ctx, w, state.buffLabel, state.buffTimer);
    }
    if (state.bombs !== undefined && state.bombs > 0) {
      this.renderBombs(ctx, w, state.bombs);
    }

    if (state.bossHp !== undefined && state.bossMaxHp !== undefined) {
      this.renderBossBar(ctx, w, h, state);
    }

    this.renderRestartButton(ctx, w, h, !!state.bossHp, restartHover);

    ctx.restore();
  }

  private renderRestartButton(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    hasBoss: boolean,
    hover: boolean,
  ): void {
    const r = this.restartButtonRect(w, h, hasBoss);
    const label = "↻  REINICIAR NIVEL";

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = hover
      ? "600 11px 'JetBrains Mono', monospace"
      : "500 11px 'JetBrains Mono', monospace";
    ctx.letterSpacing = "1px";
    ctx.fillStyle = hover ? WARM_W : DIM;
    if (hover) {
      ctx.shadowColor = AMBER;
      ctx.shadowBlur = 6;
    }
    ctx.fillText(label, r.x, r.y + r.h / 2);
    ctx.shadowBlur = 0;

    if (hover) {
      const tw = ctx.measureText(label).width;
      ctx.strokeStyle = AMBER + "99";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + r.h - 2);
      ctx.lineTo(r.x + tw, r.y + r.h - 2);
      ctx.stroke();
    }
  }

  private renderBuff(ctx: CanvasRenderingContext2D, w: number, label: string, timer: number): void {
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.font = "600 11px 'JetBrains Mono', monospace";
    ctx.fillStyle = AMBER;
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 6;
    ctx.fillText(`${label}  ${timer.toFixed(1)}s`, w - 18, 58);
    ctx.shadowBlur = 0;
  }

  private renderBombs(ctx: CanvasRenderingContext2D, w: number, count: number): void {
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.font = "700 12px 'Orbitron', sans-serif";
    ctx.fillStyle = "#f0f0f0";
    ctx.shadowColor = "#ffffff";
    ctx.shadowBlur = 8;
    ctx.fillText(`BOMB ×${count}  [SPACE]`, w - 18, 76);
    ctx.shadowBlur = 0;
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, w: number, state: HudState): void {
    ctx.fillStyle = "rgba(2,3,8,0.65)";
    ctx.fillRect(0, 0, w, 58);

    ctx.fillStyle = AMBER + "44";
    ctx.fillRect(0, 57, w, 1);

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "700 30px 'JetBrains Mono', monospace";
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 14;
    ctx.fillStyle = WARM_W;
    ctx.fillText(state.score.toString().padStart(8, "0"), w / 2, 12);
    ctx.shadowBlur = 0;

    if (state.multiplier > 1) {
      ctx.font = "700 14px 'JetBrains Mono', monospace";
      ctx.fillStyle = AMBER;
      ctx.shadowColor = AMBER;
      ctx.shadowBlur = 8;
      ctx.fillText(`× ${state.multiplier}  COMBO`, w / 2, 44);
      ctx.shadowBlur = 0;
    }
  }

  private renderLives(ctx: CanvasRenderingContext2D, lives: number): void {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "2px";
    ctx.fillText("CREW", 18, 10);
    ctx.letterSpacing = "0px";

    const count = Math.max(0, lives);
    for (let i = 0; i < 3; i++) {
      const x = 18 + i * 20;
      const y = 22;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-Math.PI / 2);
      if (i < count) {
        ctx.fillStyle = AMBER;
        ctx.shadowColor = AMBER;
        ctx.shadowBlur = 8;
      } else {
        ctx.fillStyle = DIM + "55";
        ctx.shadowBlur = 0;
      }
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, -4);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-5, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  private renderWeapon(ctx: CanvasRenderingContext2D, weapon: WeaponType, color: string): void {
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "2px";
    ctx.fillText("WEAPON", 18, 40);
    ctx.letterSpacing = "0px";

    ctx.font = "700 13px 'Orbitron', sans-serif";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(WEAPON_LABEL[weapon], 75, 38);
    ctx.shadowBlur = 0;
  }

  private renderAmmo(ctx: CanvasRenderingContext2D, state: HudState): void {
    const x = 18;
    const y = 64; // justo debajo del top bar
    const barW = 140;
    const barH = 5;

    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    if (state.isReloading) {
      // Parpadeo cada 250ms
      const blink = Math.floor(Date.now() / 250) % 2 === 0;
      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = blink ? "#ffcc00" : "#886600";
      ctx.fillText("RELOAD", x, y);

      const barX = x + 64;
      const fillW = barW - 64;
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(barX, y + 2, fillW, barH);
      ctx.fillStyle = blink ? "#ffcc00" : "#886600";
      ctx.shadowColor = "#ffcc00";
      ctx.shadowBlur = blink ? 6 : 0;
      ctx.fillRect(barX, y + 2, fillW * state.reloadProgress, barH);
      ctx.shadowBlur = 0;
    } else {
      const ratio = state.maxAmmo > 0 ? state.ammo / state.maxAmmo : 0;
      const barColor = ratio < 0.25 ? "#ff5030" : state.weaponColor;

      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(x, y + 2, barW, barH);
      ctx.fillStyle = barColor;
      ctx.shadowColor = barColor;
      ctx.shadowBlur = 4;
      ctx.fillRect(x, y + 2, barW * ratio, barH);
      ctx.shadowBlur = 0;

      ctx.font = "600 11px 'JetBrains Mono', monospace";
      ctx.fillStyle = ratio < 0.25 ? "#ff5030" : DIM;
      ctx.fillText(`${state.ammo}/${state.maxAmmo}`, barW + x + 6, y);
    }
  }

  private renderLevelInfo(ctx: CanvasRenderingContext2D, w: number, state: HudState): void {
    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    ctx.font = "700 13px 'Orbitron', sans-serif";
    ctx.fillStyle = ICE;
    ctx.shadowColor = ICE;
    ctx.shadowBlur = 6;
    ctx.fillText(`LVL ${state.level}  ${state.levelName.toUpperCase()}`, w - 18, 10);
    ctx.shadowBlur = 0;

    const barW = 160;
    const barH = 3;
    const bx = w - 18 - barW;
    const by = 30;
    const prog = state.totalWaves > 0 ? state.wave / state.totalWaves : 0;

    ctx.fillStyle = ICE + "22";
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = ICE;
    ctx.shadowColor = ICE;
    ctx.shadowBlur = 4;
    ctx.fillRect(bx, by, barW * prog, barH);
    ctx.shadowBlur = 0;

    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "1px";
    ctx.fillText(`WAVE ${state.wave}/${state.totalWaves}`, w - 18, 38);
    ctx.letterSpacing = "0px";
  }

  private renderBossBar(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    state: HudState,
  ): void {
    const color = state.bossColor ?? "#cc00ff";
    const name = state.bossName ?? "BOSS";
    const phase = state.bossPhase ?? 1;
    const barW = Math.min(w * 0.58, 520);
    const bx = (w - barW) / 2;
    const by = h - 44;

    // Fondo semitransparente
    ctx.fillStyle = "rgba(2,3,8,0.7)";
    ctx.fillRect(bx - 10, by - 20, barW + 20, 34);

    // Nombre + fase
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "700 11px 'Orbitron', sans-serif";
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(`── ${name}  ◆  PHASE ${phase} ──`, w / 2, by - 16);
    ctx.shadowBlur = 0;

    // Barra de HP
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(bx, by, barW, 8);

    const ratio = (state.bossMaxHp ?? 1) > 0 ? (state.bossHp ?? 0) / state.bossMaxHp! : 0;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fillRect(bx, by, barW * ratio, 8);
    ctx.shadowBlur = 0;

    // Marcadores de fase (67% y 33%)
    for (const pct of [0.67, 0.33]) {
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(bx + barW * pct - 1, by - 2, 2, 12);
    }
  }
}

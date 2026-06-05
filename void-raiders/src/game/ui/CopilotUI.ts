// Panel NOVA — esquina inferior izquierda (canvas)

import type { WeaponType } from "../../types";
import { WEAPON_LABEL } from "../systems/WeaponSystem";

const ICE = "#80c8ff";
const AMBER = "#e8a840";
const WARM = "#f4ead8";
const DIM = "#8899aa";
const PANEL_W = 268;
const PANEL_H = 88;
const MSG_FADE = 4;

const WEAPON_TOAST_SEC = 1.6;

export class CopilotUI {
  private message = "NOVA en línea. Háblame, piloto.";
  private messageTimer = MSG_FADE;
  private listening = false;
  private listenPhase = 0;
  private interim = "";
  private weapon: WeaponType = "laser";
  private weaponToast = "";
  private weaponToastTimer = 0;

  showMessage(text: string): void {
    this.message = text;
    this.messageTimer = MSG_FADE;
  }

  showWeaponToast(label: string): void {
    this.weaponToast = label;
    this.weaponToastTimer = WEAPON_TOAST_SEC;
  }

  setListening(on: boolean): void {
    this.listening = on;
  }

  setInterim(text: string): void {
    this.interim = text;
  }

  setWeapon(w: WeaponType): void {
    this.weapon = w;
  }

  update(dt: number): void {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    if (this.weaponToastTimer > 0) this.weaponToastTimer -= dt;
    if (this.listening) this.listenPhase += dt * 5;
  }

  render(ctx: CanvasRenderingContext2D, _w: number, h: number): void {
    const x = 14;
    const y = h - PANEL_H - 14;
    const alpha = this.messageTimer > 0 ? 1 : Math.max(0.35, 0.35 + this.messageTimer * 0.2);

    ctx.save();

    ctx.fillStyle = "rgba(2, 8, 16, 0.72)";
    ctx.strokeStyle = ICE + "44";
    ctx.lineWidth = 1;
    this.roundRect(ctx, x, y, PANEL_W, PANEL_H, 6);
    ctx.fill();
    ctx.stroke();

    this.drawNovaIcon(ctx, x + 18, y + PANEL_H / 2);
    if (this.listening) this.drawListenPulse(ctx, x + 18, y + PANEL_H / 2);

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.font = "600 11px 'IBM Plex Sans', sans-serif";
    ctx.fillStyle = ICE;
    ctx.fillText("NOVA", x + 38, y + 12);

    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = AMBER;
    const weaponLine =
      this.weaponToastTimer > 0 && this.weaponToast
        ? `▸ ${this.weaponToast}`
        : WEAPON_LABEL[this.weapon];
    ctx.fillText(weaponLine, x + 38, y + 26);

    ctx.font = "400 12px 'IBM Plex Sans', sans-serif";
    ctx.globalAlpha = alpha;
    ctx.fillStyle = WARM;
    const display = this.interim || this.message;
    this.wrapText(ctx, display, x + 38, y + 42, PANEL_W - 48, 14, 2);

    if (this.listening) {
      ctx.globalAlpha = 0.5 + Math.sin(this.listenPhase) * 0.25;
      ctx.font = "400 9px 'IBM Plex Sans', sans-serif";
      ctx.fillStyle = DIM;
      ctx.fillText("escuchando…", x + 38, y + PANEL_H - 16);
    }

    ctx.restore();
  }

  private drawNovaIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const s = 10;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = ICE + "cc";
    ctx.shadowColor = ICE;
    ctx.shadowBlur = 8;
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawListenPulse(ctx: CanvasRenderingContext2D, cx: number, cy: number): void {
    const r = 14 + Math.sin(this.listenPhase) * 3;
    ctx.save();
    ctx.strokeStyle = ICE + "55";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  private wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxW: number,
    lineH: number,
    maxLines: number,
  ): void {
    const words = text.split(/\s+/);
    let line = "";
    let ly = y;
    let lines = 0;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, ly);
        line = word;
        ly += lineH;
        lines += 1;
        if (lines >= maxLines) return;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, ly);
  }
}

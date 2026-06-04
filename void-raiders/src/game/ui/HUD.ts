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
}

const AMBER  = "#e8a840";
const ICE    = "#80c8ff";
const DIM    = "#667788";
const WARM_W = "#f0e8d0";

export class HUD {
  render(ctx: CanvasRenderingContext2D, w: number, state: HudState): void {
    ctx.save();

    this.renderTopBar(ctx, w, state);
    this.renderLives(ctx, state.lives);
    this.renderWeapon(ctx, state.weapon, state.weaponColor);
    this.renderLevelInfo(ctx, w, state);

    ctx.restore();
  }

  private renderTopBar(ctx: CanvasRenderingContext2D, w: number, state: HudState): void {
    // Barra translúcida superior
    ctx.fillStyle = "rgba(2,3,8,0.65)";
    ctx.fillRect(0, 0, w, 58);

    // Separador ámbar
    ctx.fillStyle = AMBER + "44";
    ctx.fillRect(0, 57, w, 1);

    // Score centralizado
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.font = "700 30px 'JetBrains Mono', monospace";
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 14;
    ctx.fillStyle = WARM_W;
    ctx.fillText(state.score.toString().padStart(8, "0"), w / 2, 12);
    ctx.shadowBlur = 0;

    // Multiplicador de combo
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

    // Label
    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = DIM;
    ctx.letterSpacing = "2px";
    ctx.fillText("CREW", 18, 10);
    ctx.letterSpacing = "0px";

    // Triángulos de vida (iconos nave)
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

  private renderLevelInfo(ctx: CanvasRenderingContext2D, w: number, state: HudState): void {
    ctx.textAlign = "right";
    ctx.textBaseline = "top";

    // Nombre del nivel
    ctx.font = "700 13px 'Orbitron', sans-serif";
    ctx.fillStyle = ICE;
    ctx.shadowColor = ICE;
    ctx.shadowBlur = 6;
    ctx.fillText(`LVL ${state.level}  ${state.levelName.toUpperCase()}`, w - 18, 10);
    ctx.shadowBlur = 0;

    // Barra de progreso de oleadas
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
}

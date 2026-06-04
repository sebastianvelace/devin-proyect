// HUD: score, vidas, arma, nivel/oleada y multiplicador de combo

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

export class HUD {
  render(ctx: CanvasRenderingContext2D, w: number, state: HudState): void {
    ctx.save();
    ctx.textBaseline = "top";

    // --- vidas y arma (arriba izquierda) ---
    ctx.font = "700 16px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#9fd8ff";
    ctx.fillText(`LIVES  ${"▲".repeat(Math.max(0, state.lives))}`, 20, 18);

    ctx.fillStyle = state.weaponColor;
    ctx.fillText(`WEAPON  ${WEAPON_LABEL[state.weapon]}`, 20, 42);

    // --- score (centro) ---
    ctx.textAlign = "center";
    ctx.font = "700 28px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "#00ffff";
    ctx.shadowBlur = 10;
    ctx.fillText(state.score.toString().padStart(7, "0"), w / 2, 14);
    ctx.shadowBlur = 0;

    if (state.multiplier > 1) {
      ctx.font = "700 18px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#ffff00";
      ctx.fillText(`x${state.multiplier}`, w / 2, 48);
    }

    // --- nivel / oleada (arriba derecha) ---
    ctx.textAlign = "right";
    ctx.font = "700 15px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#ff66cc";
    ctx.fillText(`LEVEL ${state.level} · ${state.levelName}`, w - 20, 18);
    ctx.fillStyle = "#9fd8ff";
    ctx.fillText(`WAVE ${state.wave}/${state.totalWaves}`, w - 20, 40);

    ctx.restore();
  }
}

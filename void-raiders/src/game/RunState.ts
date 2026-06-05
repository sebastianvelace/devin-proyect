import type { WeaponType } from "../types";

/** Estado de partida que persiste entre sectores / cinemática. */
export interface RunState {
  score: number;
  lives: number;
  storedBombs: number;
  weapon: WeaponType;
}

export const DEFAULT_RUN: RunState = {
  score: 0,
  lives: 3,
  storedBombs: 0,
  weapon: "laser",
};

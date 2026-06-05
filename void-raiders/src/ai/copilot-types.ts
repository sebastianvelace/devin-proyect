import type { WeaponType } from "../types";

export type CopilotAction =
  | "change_weapon"
  | "activate_shield"
  | "deploy_bomb"
  | "tactical_info"
  | "tactical_message"
  | "none";

export interface CopilotResponse {
  action: CopilotAction;
  params: Record<string, unknown>;
  message: string;
}

export interface GameStateSnapshot {
  player_health: number;
  player_position_quadrant: "TL" | "TR" | "BL" | "BR" | "C";
  enemy_count: number;
  enemy_types_on_screen: string[];
  current_weapon: WeaponType;
  boss_phase: number | null;
  score: number;
  bombs_available: number;
  shield_active: boolean;
  level: number;
  combat_status: "waves" | "boss";
}

export interface CopilotGameActions {
  changeWeapon(weapon: WeaponType): void;
  activateShield(): void;
  deployBomb(): boolean;
  getGameState(): GameStateSnapshot;
}

// Todos los tipos e interfaces del juego

export interface Vec2 {
  x: number;
  y: number;
}

export type WeaponType = "laser" | "missiles" | "plasma" | "burst" | "railgun" | "flak";
export type EnemyType = "basic" | "fast" | "elite" | "hunter" | "tank" | "sniper" | "bomber";
export type PowerUpType = "multishot" | "shield" | "speed" | "damage" | "bomb";

/** Una escena del juego (menu, gameplay, transición, etc.). */
export interface Scene {
  /** Avanza la lógica. `dt` en segundos. */
  update(dt: number): void;
  /** Dibuja la escena. */
  render(ctx: CanvasRenderingContext2D): void;
  /** Se llama al entrar en la escena. */
  enter?(): void;
  /** Se llama al salir de la escena. */
  exit?(): void;
  /** Se llama cuando cambia el tamaño lógico del canvas. */
  resize?(width: number, height: number): void;
}

/** Estado de un puntero/click capturado durante el frame. */
export interface ClickEvent {
  x: number;
  y: number;
}

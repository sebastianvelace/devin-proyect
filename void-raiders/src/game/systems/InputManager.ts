// Estado de teclado: teclas mantenidas y "recién presionadas" por frame

/**
 * Captura el teclado a nivel de `window`. Distingue entre teclas mantenidas
 * (`isDown`) y teclas recién presionadas en este frame (`wasPressed`).
 * La escena debe llamar a `endFrame()` al final de cada update.
 */
export class InputManager {
  private readonly down = new Set<string>();
  private readonly pressed = new Set<string>();

  constructor() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.down.has(e.code)) this.pressed.add(e.code);
    this.down.add(e.code);
    // evita el scroll de la página con Espacio/flechas
    if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.down.delete(e.code);
  };

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  /** True solo en el frame en que la tecla pasó a estar presionada. */
  wasPressed(code: string): boolean {
    return this.pressed.has(code);
  }

  /** Limpia las teclas "recién presionadas". Llamar al final del update. */
  endFrame(): void {
    this.pressed.clear();
  }

  dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.down.clear();
    this.pressed.clear();
  }
}

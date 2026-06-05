// Game loop principal (requestAnimationFrame, delta time, scene manager)

import type { ClickEvent, Scene, Vec2 } from "../types";
import { InputManager } from "./systems/InputManager";

const STEP = 1 / 60; // paso fijo de simulación (s) → movimiento consistente
const MAX_STEPS = 5; // tope de sub-pasos por frame (evita "espiral de la muerte")
const MAX_FRAME = 0.25; // descarta saltos enormes (pestaña inactiva)

/**
 * Núcleo del juego: configura el canvas (con devicePixelRatio), corre el game
 * loop con delta time, gestiona el cambio de escenas y captura input básico de
 * puntero. El input de teclado completo se añade vía InputManager.
 */
export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Tamaño lógico (CSS px), ya independiente del devicePixelRatio. */
  width = 0;
  height = 0;
  dpr = 1;

  /** Posición del puntero en coordenadas lógicas. */
  readonly pointer: Vec2 = { x: 0, y: 0 };
  pointerDown = false;

  readonly input = new InputManager();

  private scene: Scene | null = null;
  private clicks: ClickEvent[] = [];
  private rafId = 0;
  private lastTime = 0;
  private accumulator = 0;
  private running = false;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement("canvas");
    this.canvas.id = "game-canvas";
    container.appendChild(this.canvas);

    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("No se pudo obtener el contexto 2D del canvas");
    this.ctx = ctx;

    this.resize();
    this.bindEvents();
  }

  // --- Escenas ---------------------------------------------------------------

  changeScene(scene: Scene): void {
    this.scene?.exit?.();
    this.scene = scene;
    scene.resize?.(this.width, this.height);
    scene.enter?.();
  }

  get currentScene(): Scene | null {
    return this.scene;
  }

  // --- Loop ------------------------------------------------------------------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    let frame = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (frame > MAX_FRAME) frame = MAX_FRAME;

    const { ctx } = this;
    if (this.scene) {
      // Simulación a paso fijo: el movimiento es idéntico sea cual sea el FPS
      // y los frames lentos "se ponen al día" en vez de ralentizar el juego.
      this.accumulator += frame;
      let steps = 0;
      while (this.accumulator >= STEP && steps < MAX_STEPS) {
        this.scene.update(STEP);
        this.accumulator -= STEP;
        steps += 1;
        this.input.endFrame();
        this.clicks.length = 0; // los clicks se consumen por paso
      }
      if (steps === MAX_STEPS) this.accumulator = 0; // descarta acumulado excesivo
      // Siempre la escena activa tras update (changeScene puede ocurrir dentro de update).
      this.scene.render(ctx);
    }
    this.rafId = requestAnimationFrame(this.tick);
  };

  // --- Input de puntero ------------------------------------------------------

  /** Devuelve (y limpia) los clicks ocurridos en este frame. */
  consumeClicks(): ClickEvent[] {
    if (this.clicks.length === 0) return [];
    return this.clicks.splice(0, this.clicks.length);
  }

  private bindEvents(): void {
    window.addEventListener("resize", this.resize);

    this.canvas.addEventListener("pointermove", (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
    });
    this.canvas.addEventListener("pointerdown", (e) => {
      this.pointer.x = e.clientX;
      this.pointer.y = e.clientY;
      this.pointerDown = true;
    });
    window.addEventListener("pointerup", () => {
      this.pointerDown = false;
    });
    this.canvas.addEventListener("click", (e) => {
      this.clicks.push({ x: e.clientX, y: e.clientY });
    });
    // evitar menú contextual al hacer click derecho durante el juego
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  // --- Resize ----------------------------------------------------------------

  private resize = (): void => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    // todas las operaciones de dibujo en coordenadas lógicas
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.scene?.resize?.(this.width, this.height);
  };
}

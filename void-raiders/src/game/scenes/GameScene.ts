// Escena de gameplay: nave, disparo y balas (enemigos llegan en la Etapa 3)

import type { Scene, WeaponType } from "../../types";
import type { Game } from "../Game";
import { Bullet } from "../entities/Bullet";
import { Player } from "../entities/Player";
import { Camera } from "../systems/Camera";
import { Starfield } from "../systems/Starfield";
import { WeaponSystem, WEAPON_LABEL } from "../systems/WeaponSystem";
import { Pool } from "../../utils/pool";
// ciclo MenuScene <-> GameScene: ok porque el uso es diferido (los imports se elevan)
import { MenuScene } from "./MenuScene";

const WEAPON_KEYS: Record<string, WeaponType> = {
  Digit1: "laser",
  Digit2: "missiles",
  Digit3: "plasma",
  Digit4: "burst",
};

export class GameScene implements Scene {
  private readonly game: Game;
  private readonly starfield = new Starfield(1.6);
  private readonly camera = new Camera();
  private readonly weapons = new WeaponSystem();
  private readonly bullets = new Pool<Bullet>(() => new Bullet(), 64);
  private player: Player;

  constructor(game: Game) {
    this.game = game;
    this.player = new Player(game.width / 2, game.height / 2);
  }

  enter(): void {
    this.starfield.resize(this.game.width, this.game.height);
  }

  resize(width: number, height: number): void {
    this.starfield.resize(width, height);
  }

  update(dt: number): void {
    const { input, pointer, width, height } = this.game;

    // volver al menú
    if (input.wasPressed("Escape")) {
      this.game.changeScene(new MenuScene(this.game));
      return;
    }

    // cambio de arma (provisional con teclas; por voz en la Etapa 5)
    for (const code in WEAPON_KEYS) {
      if (input.wasPressed(code)) this.weapons.setWeapon(WEAPON_KEYS[code]);
    }

    this.starfield.update(dt);
    this.player.update(dt, input, pointer, width, height);
    this.weapons.update(dt);

    // disparo manteniendo click izquierdo
    if (this.game.pointerDown) {
      const nose = this.player.nose();
      const fired = this.weapons.tryFire(nose.x, nose.y, this.player.angle, this.bullets);
      if (fired && this.weapons.current === "plasma") this.camera.shake(3, 0.12);
    }

    // balas: mover y descartar fuera de pantalla
    const margin = 30;
    for (const b of this.bullets.active) {
      b.update(dt);
      if (b.x < -margin || b.x > width + margin || b.y < -margin || b.y > height + margin) {
        b.alive = false;
      }
    }
    this.bullets.sweep((b) => !b.alive);

    this.camera.update(dt);
  }

  render(ctx: CanvasRenderingContext2D): void {
    const { width: w, height: h } = this.game;

    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.2);
    grad.addColorStop(0, "#0d1326");
    grad.addColorStop(1, "#0a0a0f");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    this.starfield.render(ctx);

    this.camera.begin(ctx);
    for (const b of this.bullets.active) b.render(ctx);
    this.player.render(ctx, this.weapons.color);
    this.camera.end(ctx);

    this.renderHud(ctx);
    this.renderVignette(ctx, w, h);
  }

  private renderHud(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = "700 16px 'JetBrains Mono', monospace";
    ctx.textBaseline = "top";

    ctx.fillStyle = "#9fd8ff";
    ctx.fillText(`LIVES  ${"▲".repeat(Math.max(0, this.player.lives))}`, 20, 20);

    ctx.fillStyle = this.weapons.color;
    ctx.fillText(`WEAPON  ${WEAPON_LABEL[this.weapons.current]}`, 20, 44);

    ctx.fillStyle = "#5f7a99";
    ctx.font = "400 13px 'JetBrains Mono', monospace";
    ctx.fillText("1-4 cambiar arma · click disparar · ESC menú", 20, 72);
    ctx.restore();
  }

  private renderVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const grad = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) / 2.5, w / 2, h / 2, Math.max(w, h) / 1.1);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,0.7)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

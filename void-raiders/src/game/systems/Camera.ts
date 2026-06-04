// Screen shake: spring físico que decae y oscila naturalmente

import { TAU } from "../../utils/math";

/**
 * Cámara con spring-based shake. En lugar de ruido aleatorio por frame,
 * aplica un impulso al spring y deja que oscile con amortiguación — esto da
 * una sacudida suave y cinematográfica en lugar de estática de TV.
 */
export class Camera {
  offsetX = 0;
  offsetY = 0;
  private vx = 0;
  private vy = 0;

  /** Aplica un impulso al spring. Llamadas acumulativas se suman. */
  shake(mag: number, _duration: number): void {
    const ang = Math.random() * TAU;
    const impulse = mag * 52;
    this.vx += Math.cos(ang) * impulse;
    this.vy += Math.sin(ang) * impulse;
  }

  update(dt: number): void {
    const stiffness = 310;
    const damping = 26;
    this.vx += (-stiffness * this.offsetX - damping * this.vx) * dt;
    this.vy += (-stiffness * this.offsetY - damping * this.vy) * dt;
    this.offsetX += this.vx * dt;
    this.offsetY += this.vy * dt;
  }

  begin(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
  }

  end(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}

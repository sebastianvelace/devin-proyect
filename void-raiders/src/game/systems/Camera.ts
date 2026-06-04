// Screen shake: desplazamiento aleatorio que decae con el tiempo

import { randRange } from "../../utils/math";

/**
 * Cámara simple que solo aplica screen-shake. `begin`/`end` envuelven el
 * dibujo del mundo para trasladarlo por el offset del temblor.
 */
export class Camera {
  offsetX = 0;
  offsetY = 0;
  private mag = 0;
  private time = 0;
  private duration = 0;

  /** Dispara un temblor de magnitud `mag` (px) durante `duration` segundos. */
  shake(mag: number, duration: number): void {
    // no pisar un temblor más fuerte en curso
    if (mag >= this.mag || this.time <= 0) {
      this.mag = mag;
      this.duration = duration;
      this.time = duration;
    }
  }

  update(dt: number): void {
    if (this.time <= 0) {
      this.offsetX = 0;
      this.offsetY = 0;
      return;
    }
    this.time -= dt;
    const falloff = Math.max(0, this.time / this.duration);
    const amp = this.mag * falloff;
    this.offsetX = randRange(-amp, amp);
    this.offsetY = randRange(-amp, amp);
  }

  begin(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
  }

  end(ctx: CanvasRenderingContext2D): void {
    ctx.restore();
  }
}

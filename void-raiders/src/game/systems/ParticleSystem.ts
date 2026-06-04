// Pool de partículas: explosiones, chispas y polvo

import { Particle } from "../entities/Particle";
import { Pool } from "../../utils/pool";
import { TAU, randRange } from "../../utils/math";

export class ParticleSystem {
  private readonly pool = new Pool<Particle>(() => new Particle(), 128);

  /** Explosión radial de `count` partículas. */
  explosion(x: number, y: number, color: string, count = 18, speed = 220): void {
    for (let i = 0; i < count; i++) {
      const ang = randRange(0, TAU);
      const sp = randRange(speed * 0.3, speed);
      this.pool.obtain().init(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, {
        size: randRange(2, 4),
        color,
        life: randRange(0.4, 0.9),
      });
    }
  }

  /** Pequeño chorro de chispas (impactos). */
  spark(x: number, y: number, color: string, count = 6): void {
    for (let i = 0; i < count; i++) {
      const ang = randRange(0, TAU);
      const sp = randRange(40, 160);
      this.pool.obtain().init(x, y, Math.cos(ang) * sp, Math.sin(ang) * sp, {
        size: randRange(1.5, 3),
        color,
        life: randRange(0.2, 0.5),
      });
    }
  }

  update(dt: number): void {
    for (const p of this.pool.active) p.update(dt);
    this.pool.sweep((p) => !p.alive);
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    for (const p of this.pool.active) p.render(ctx);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  clear(): void {
    this.pool.releaseAll();
  }

  get count(): number {
    return this.pool.activeCount;
  }
}

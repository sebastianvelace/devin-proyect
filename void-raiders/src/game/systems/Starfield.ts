// Starfield parallax reutilizable (menú y gameplay)

interface Star {
  x: number;
  y: number;
  z: number; // capa 0..1 (mayor = más cercana/rápida)
  size: number;
}

const LAYERS = 3;
const BASE_SPEED = 30; // px/s para la capa más cercana

export class Starfield {
  private stars: Star[] = [];
  private w = 0;
  private h = 0;
  private readonly speed: number;

  constructor(speed = 1) {
    this.speed = speed;
  }

  resize(width: number, height: number): void {
    this.w = width;
    this.h = height;
    const count = Math.floor((width * height) / 6000);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      const z = (Math.floor(Math.random() * LAYERS) + 1) / LAYERS;
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        size: z * 1.8,
      });
    }
  }

  update(dt: number): void {
    for (const s of this.stars) {
      s.y += s.z * BASE_SPEED * this.speed * dt;
      if (s.y > this.h) {
        s.y = 0;
        s.x = Math.random() * this.w;
      }
    }
  }

  /** Dibuja las estrellas. `parallaxX/Y` desplazan según la capa (opcional). */
  render(ctx: CanvasRenderingContext2D, parallaxX = 0, parallaxY = 0): void {
    ctx.fillStyle = "#cfe8ff";
    for (const s of this.stars) {
      ctx.globalAlpha = 0.3 + s.z * 0.7;
      ctx.fillRect(s.x + parallaxX * s.z, s.y + parallaxY * s.z, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }
}

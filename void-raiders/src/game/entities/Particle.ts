// Partícula reciclable para explosiones, trails y polvo ambiental

export interface ParticleOptions {
  size?: number;
  color?: string;
  life?: number;
  drag?: number;
}

export class Particle {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  size = 2;
  color = "#ffffff";
  life = 0;
  maxLife = 1;
  drag = 0.92;
  alive = false;

  init(x: number, y: number, vx: number, vy: number, opts: ParticleOptions = {}): void {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.size = opts.size ?? 2;
    this.color = opts.color ?? "#ffffff";
    this.maxLife = opts.life ?? 0.6;
    this.life = this.maxLife;
    this.drag = opts.drag ?? 0.92;
    this.alive = true;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    // Math.pow hace el drag independiente del framerate (equivale a drag^(1/60) por frame)
    const d = Math.pow(this.drag, dt * 60);
    this.vx *= d;
    this.vy *= d;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const a = Math.max(0, this.life / this.maxLife);
    ctx.globalAlpha = a;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
  }
}

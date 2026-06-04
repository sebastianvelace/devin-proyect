// Proyectil reciclable (jugador y enemigos)

export interface BulletOptions {
  radius?: number;
  damage?: number;
  color?: string;
  piercing?: boolean;
  homing?: boolean;
  friendly?: boolean;
  life?: number; // segundos de vida máxima
}

/**
 * Bala simple movida por velocidad. Se recicla con `Pool`. La lógica de homing
 * y colisión vive en sus sistemas; aquí solo se integra el movimiento.
 */
export class Bullet {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  radius = 3;
  damage = 1;
  color = "#00ffff";
  piercing = false;
  homing = false;
  friendly = true;
  alive = false;
  life = 0;

  init(x: number, y: number, vx: number, vy: number, opts: BulletOptions = {}): void {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = opts.radius ?? 3;
    this.damage = opts.damage ?? 1;
    this.color = opts.color ?? "#00ffff";
    this.piercing = opts.piercing ?? false;
    this.homing = opts.homing ?? false;
    this.friendly = opts.friendly ?? true;
    this.life = opts.life ?? 3;
    this.alive = true;
  }

  update(dt: number): void {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const spd = Math.hypot(this.vx, this.vy);
    const stretch = Math.min(4.5, 1 + spd / 260);
    const ang = Math.atan2(this.vy, this.vx);

    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate(ang);
    ctx.scale(stretch, 1);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

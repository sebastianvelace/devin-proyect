// Starfield Interstellar: estrellas con color y parpadeo + nebulosas de fondo

interface Star {
  x: number;
  y: number;
  z: number;       // capa 0..1 (mayor = más cercana/rápida)
  size: number;
  color: string;
  twinkle: number; // fase de parpadeo
  twinkleSpd: number;
  bright: boolean; // estrella "brillante" con espiga de difracción
}

const LAYERS = 3;
const BASE_SPEED = 28;

// Paleta de colores estelares: mayoría blancas, algunas azul-frío, pocas ámbar cálidas
const STAR_COLORS = [
  '#ffffff', '#ffffff', '#ffffff', '#ffffff',
  '#d8ecff', '#d8ecff',  // azul-blancas (estrellas calientes)
  '#ffe8b0',             // ámbar cálida (estrella vieja)
  '#ffd0c8',             // rojo-cálida (gigante roja)
];

export class Starfield {
  private stars: Star[] = [];
  private w = 0;
  private h = 0;
  private readonly speed: number;
  /** Offsets de nebulosa que cambian muy lentamente para dar vida al fondo. */
  private nebulaPhase = 0;

  constructor(speed = 1) {
    this.speed = speed;
  }

  resize(width: number, height: number): void {
    this.w = width;
    this.h = height;
    const count = Math.floor((width * height) / 5500);
    this.stars = [];
    for (let i = 0; i < count; i++) {
      const z = (Math.floor(Math.random() * LAYERS) + 1) / LAYERS;
      const bright = Math.random() < 0.04; // 4 % de estrellas brillantes
      this.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z,
        size: bright ? z * 3.5 : z * 1.6,
        color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        twinkle: Math.random() * Math.PI * 2,
        twinkleSpd: 0.4 + Math.random() * 1.2,
        bright,
      });
    }
  }

  update(dt: number): void {
    this.nebulaPhase += dt * 0.05;
    for (const s of this.stars) {
      s.y += s.z * BASE_SPEED * this.speed * dt;
      s.twinkle += s.twinkleSpd * dt;
      if (s.y > this.h) {
        s.y = 0;
        s.x = Math.random() * this.w;
      }
    }
  }

  /** Dibuja las nebulosas de fondo (llamar ANTES de render). */
  renderNebula(ctx: CanvasRenderingContext2D): void {
    const { w, h } = this;
    const drift = Math.sin(this.nebulaPhase) * 0.015;

    // Nebulosa ámbar (acreción — esquina superior derecha)
    const ox = w * (0.75 + drift);
    const oy = h * (0.22 - drift);
    const g1 = ctx.createRadialGradient(ox, oy, 0, ox, oy, w * 0.48);
    g1.addColorStop(0, 'rgba(200, 95, 15, 0.07)');
    g1.addColorStop(0.5, 'rgba(160, 70, 10, 0.03)');
    g1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    // Nebulosa azul hielo (tipo agujero de gusano — esquina inferior izquierda)
    const bx = w * (0.18 - drift);
    const by = h * (0.72 + drift);
    const g2 = ctx.createRadialGradient(bx, by, 0, bx, by, w * 0.4);
    g2.addColorStop(0, 'rgba(20, 65, 190, 0.08)');
    g2.addColorStop(0.5, 'rgba(15, 50, 140, 0.04)');
    g2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    // Nebulosa morada difusa (centro-derecha)
    const px = w * (0.6 + drift * 0.5);
    const py = h * (0.5 + drift * 0.3);
    const g3 = ctx.createRadialGradient(px, py, 0, px, py, w * 0.32);
    g3.addColorStop(0, 'rgba(60, 20, 100, 0.04)');
    g3.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g3;
    ctx.fillRect(0, 0, w, h);
  }

  /** Dibuja las estrellas. `parallaxX/Y` desplazan según la capa (menú). */
  render(ctx: CanvasRenderingContext2D, parallaxX = 0, parallaxY = 0): void {
    for (const s of this.stars) {
      const twinkAlpha = 0.55 + Math.sin(s.twinkle) * 0.45;
      const alpha = (0.3 + s.z * 0.7) * twinkAlpha;
      const sx = s.x + parallaxX * s.z;
      const sy = s.y + parallaxY * s.z;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.color;

      if (s.bright) {
        // Glow halo
        const glowR = s.size * 2.5;
        const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, glowR);
        gr.addColorStop(0, s.color + 'aa');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr;
        ctx.fillRect(sx - glowR, sy - glowR, glowR * 2, glowR * 2);
        ctx.fillStyle = s.color;

        // Cruz de difracción (picos de luz)
        const spike = s.size * 4 * twinkAlpha;
        ctx.globalAlpha = alpha * 0.5;
        ctx.fillRect(sx - spike / 2, sy - 0.5, spike, 1);
        ctx.fillRect(sx - 0.5, sy - spike / 2, 1, spike);
        ctx.globalAlpha = alpha;
      }

      ctx.fillRect(sx - s.size / 2, sy - s.size / 2, s.size, s.size);
    }
    ctx.globalAlpha = 1;
  }
}

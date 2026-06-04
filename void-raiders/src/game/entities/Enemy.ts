// Enemigos geométricos: factory + comportamiento por tipo

import type { EnemyType } from "../../types";
import type { Bullet } from "./Bullet";
import type { Player } from "./Player";
import type { Pool } from "../../utils/pool";
import { TAU, vecFromAngle } from "../../utils/math";

interface EnemyStats {
  hp: number;
  speed: number; // px/s
  radius: number;
  color: string;
  points: number;
  fireRate: number; // segundos entre disparos (0 = no dispara)
  aoe: boolean; // explota en área al morir (bomber)
}

const NORMAL = 110;

export const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  basic: { hp: 1, speed: NORMAL, radius: 14, color: "#ff0040", points: 100, fireRate: 2, aoe: false },
  fast: { hp: 1, speed: NORMAL * 2, radius: 11, color: "#ffff00", points: 150, fireRate: 0, aoe: false },
  tank: { hp: 3, speed: NORMAL * 0.5, radius: 22, color: "#ff00ff", points: 300, fireRate: 2.5, aoe: false },
  sniper: { hp: 2, speed: 60, radius: 15, color: "#00ff40", points: 250, fireRate: 3, aoe: false },
  bomber: { hp: 2, speed: NORMAL, radius: 15, color: "#ff8800", points: 200, fireRate: 0, aoe: true },
};

const ENEMY_BULLET = "#ff5050";
const SNIPER_BULLET = "#7dff7d";

export class Enemy {
  type: EnemyType = "basic";
  x = 0;
  y = 0;
  hp = 1;
  maxHp = 1;
  radius = 14;
  color = "#ff0040";
  points = 100;
  alive = true;
  /** true si murió por proximidad/explosión propia (bomber). */
  detonated = false;
  /** true cuando la escena ya contabilizó su muerte (score/partículas). */
  scored = false;

  private speed = NORMAL;
  private fireRate = 0;
  private fireTimer = 0;
  private phase = 0; // para zigzag/sine
  private anchorY = 0; // objetivo vertical del sniper

  spawn(type: EnemyType, x: number, y: number, anchorY: number): void {
    const s = ENEMY_STATS[type];
    this.type = type;
    this.x = x;
    this.y = y;
    this.hp = s.hp;
    this.maxHp = s.hp;
    this.radius = s.radius;
    this.color = s.color;
    this.points = s.points;
    this.speed = s.speed;
    this.fireRate = s.fireRate;
    this.fireTimer = s.fireRate * (0.5 + Math.random() * 0.5);
    this.phase = Math.random() * TAU;
    this.anchorY = anchorY;
    this.alive = true;
    this.detonated = false;
    this.scored = false;
  }

  get isAoe(): boolean {
    return ENEMY_STATS[this.type].aoe;
  }

  /** Aplica daño. Devuelve true si murió. */
  takeDamage(dmg: number): boolean {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.alive = false;
      return true;
    }
    return false;
  }

  update(dt: number, player: Player, bullets: Pool<Bullet>): void {
    this.phase += dt;
    const ang = Math.atan2(player.y - this.y, player.x - this.x);

    switch (this.type) {
      case "basic":
        this.x += Math.cos(ang) * this.speed * dt;
        this.y += Math.sin(ang) * this.speed * dt;
        break;
      case "fast": {
        // avanza hacia el jugador con oscilación lateral (zigzag)
        const perp = ang + Math.PI / 2;
        const wobble = Math.sin(this.phase * 6) * 90;
        this.x += (Math.cos(ang) * this.speed + Math.cos(perp) * wobble) * dt;
        this.y += (Math.sin(ang) * this.speed + Math.sin(perp) * wobble) * dt;
        break;
      }
      case "tank":
        this.x += Math.cos(ang) * this.speed * dt;
        this.y += Math.sin(ang) * this.speed * dt;
        break;
      case "sniper":
        // baja hasta su ancla y luego se queda estático
        if (this.y < this.anchorY) {
          this.y += this.speed * dt;
        }
        break;
      case "bomber": {
        this.x += Math.cos(ang) * this.speed * dt;
        this.y += Math.sin(ang) * this.speed * dt;
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < this.radius + player.radius + 6) {
          this.alive = false;
          this.detonated = true;
        }
        break;
      }
    }

    // disparo
    if (this.fireRate > 0) {
      this.fireTimer -= dt;
      if (this.fireTimer <= 0) {
        this.fireTimer = this.fireRate;
        this.shoot(ang, bullets);
      }
    }
  }

  private shoot(ang: number, bullets: Pool<Bullet>): void {
    const fire = (a: number, speed: number, color: string, radius: number): void => {
      const v = vecFromAngle(a, speed);
      bullets.obtain().init(this.x, this.y, v.x, v.y, {
        radius,
        damage: 1,
        color,
        friendly: false,
        life: 5,
      });
    };

    switch (this.type) {
      case "basic":
        fire(ang, 240, ENEMY_BULLET, 4);
        break;
      case "tank":
        for (let i = -1; i <= 1; i++) fire(ang + i * 0.18, 220, ENEMY_BULLET, 4);
        break;
      case "sniper":
        fire(ang, 460, SNIPER_BULLET, 3);
        break;
      default:
        break;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = this.color;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 2;
    const r = this.radius;

    switch (this.type) {
      case "basic": // rombo
        ctx.beginPath();
        ctx.moveTo(0, -r);
        ctx.lineTo(r, 0);
        ctx.lineTo(0, r);
        ctx.lineTo(-r, 0);
        ctx.closePath();
        ctx.fill();
        break;
      case "fast": // triángulo pequeño
        ctx.beginPath();
        ctx.moveTo(0, r);
        ctx.lineTo(r, -r);
        ctx.lineTo(-r, -r);
        ctx.closePath();
        ctx.fill();
        break;
      case "tank": // hexágono
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        break;
      case "sniper": // línea delgada
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-r, 0);
        ctx.lineTo(r, 0);
        ctx.stroke();
        break;
      case "bomber": // círculo
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, TAU);
        ctx.fill();
        break;
    }

    // indicador de daño (anillo de vida para enemigos con hp>1)
    if (this.maxHp > 1 && this.hp < this.maxHp) {
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, -Math.PI / 2, -Math.PI / 2 + TAU * (this.hp / this.maxHp));
      ctx.stroke();
    }
    ctx.restore();
  }
}

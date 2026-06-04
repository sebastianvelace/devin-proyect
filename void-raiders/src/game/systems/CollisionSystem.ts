// Colisiones circulares entre balas, enemigos y jugador

import type { Bullet } from "../entities/Bullet";
import type { Enemy } from "../entities/Enemy";
import type { Player } from "../entities/Player";
import type { PowerUp } from "../entities/PowerUp";
import type { Pool } from "../../utils/pool";
import { distanceSq } from "../../utils/math";

function overlap(ax: number, ay: number, ar: number, bx: number, by: number, br: number): boolean {
  const rr = ar + br;
  return distanceSq(ax, ay, bx, by) <= rr * rr;
}

export class CollisionSystem {
  /** Balas amigas vs enemigos. `onHit` recibe (enemigo, bala). */
  bulletsVsEnemies(
    bullets: Pool<Bullet>,
    enemies: readonly Enemy[],
    onHit: (enemy: Enemy, bullet: Bullet) => void,
  ): void {
    for (const b of bullets.active) {
      if (!b.alive || !b.friendly) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        if (overlap(b.x, b.y, b.radius, e.x, e.y, e.radius)) {
          onHit(e, b);
          if (!b.piercing) {
            b.alive = false;
            break;
          }
        }
      }
    }
  }

  /** Balas enemigas vs jugador. La bala se consume al impactar. */
  enemyBulletsVsPlayer(
    bullets: Pool<Bullet>,
    player: Player,
    onHit: (bullet: Bullet) => void,
  ): void {
    if (!player.alive) return;
    for (const b of bullets.active) {
      if (!b.alive || b.friendly) continue;
      if (overlap(b.x, b.y, b.radius, player.x, player.y, player.radius)) {
        onHit(b);
        b.alive = false;
      }
    }
  }

  /** Balas amigas vs un círculo genérico (boss, etc.). */
  bulletsVsCircle(
    bullets: Pool<Bullet>,
    cx: number,
    cy: number,
    cr: number,
    onHit: (bullet: Bullet) => void,
  ): void {
    for (const b of bullets.active) {
      if (!b.alive || !b.friendly) continue;
      if (overlap(b.x, b.y, b.radius, cx, cy, cr)) {
        onHit(b);
        if (!b.piercing) b.alive = false;
      }
    }
  }

  /** Power-up vs jugador. */
  powerUpsVsPlayer(
    powerUps: readonly PowerUp[],
    player: Player,
    onCollect: (pu: PowerUp) => void,
  ): void {
    if (!player.alive) return;
    for (const pu of powerUps) {
      if (!pu.alive) continue;
      if (overlap(pu.x, pu.y, pu.radius, player.x, player.y, player.radius)) {
        onCollect(pu);
        pu.alive = false;
      }
    }
  }

  /** Contacto enemigo-jugador. */
  enemiesVsPlayer(
    enemies: readonly Enemy[],
    player: Player,
    onHit: (enemy: Enemy) => void,
  ): void {
    if (!player.alive) return;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (overlap(e.x, e.y, e.radius, player.x, player.y, player.radius)) {
        onHit(e);
      }
    }
  }
}

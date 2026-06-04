// Cadencia y patrones de disparo de las 4 armas

import type { WeaponType } from "../../types";
import type { Bullet } from "../entities/Bullet";
import type { Pool } from "../../utils/pool";
import { vecFromAngle } from "../../utils/math";

interface WeaponDef {
  color: string;
  cooldown: number; // segundos entre disparos
  damage: number;
  speed: number; // px/s
  radius: number;
}

export const WEAPONS: Record<WeaponType, WeaponDef> = {
  laser: { color: "#00ffff", cooldown: 0.15, damage: 1, speed: 720, radius: 3 },
  missiles: { color: "#ff8800", cooldown: 0.4, damage: 2, speed: 520, radius: 4 },
  plasma: { color: "#ff00ff", cooldown: 0.5, damage: 3, speed: 340, radius: 9 },
  burst: { color: "#ffff00", cooldown: 0.6, damage: 1, speed: 640, radius: 3 },
};

export const WEAPON_LABEL: Record<WeaponType, string> = {
  laser: "LASER",
  missiles: "MISSILES",
  plasma: "PLASMA",
  burst: "BURST",
};

/** Opciones aplicadas por power-ups al disparar. */
export interface FireMods {
  damageMult?: number;
  multishot?: boolean; // añade abanico extra
}

export class WeaponSystem {
  current: WeaponType = "laser";
  private cooldown = 0;

  setWeapon(weapon: WeaponType): void {
    this.current = weapon;
  }

  get color(): string {
    return WEAPONS[this.current].color;
  }

  get ready(): boolean {
    return this.cooldown <= 0;
  }

  update(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
  }

  /**
   * Intenta disparar desde (x, y) hacia `angle`. Si está en cooldown no hace
   * nada. Spawnea balas en `pool`.
   */
  tryFire(
    x: number,
    y: number,
    angle: number,
    pool: Pool<Bullet>,
    mods: FireMods = {},
  ): boolean {
    if (this.cooldown > 0) return false;
    const def = WEAPONS[this.current];
    this.cooldown = def.cooldown;

    const damage = def.damage * (mods.damageMult ?? 1);
    const spawn = (a: number): void => {
      const v = vecFromAngle(a, def.speed);
      pool.obtain().init(x, y, v.x, v.y, {
        radius: def.radius,
        damage,
        color: def.color,
        piercing: this.current === "plasma",
        homing: this.current === "missiles",
        friendly: true,
        life: 2.5,
      });
    };

    switch (this.current) {
      case "laser":
        spawn(angle);
        break;
      case "missiles": {
        const off = 0.12;
        spawn(angle - off);
        spawn(angle + off);
        break;
      }
      case "plasma":
        spawn(angle);
        break;
      case "burst": {
        const spread = 0.5;
        for (let i = -2; i <= 2; i++) spawn(angle + (spread / 4) * i);
        break;
      }
    }

    if (mods.multishot) {
      // abanico extra del power-up multi-shot
      spawn(angle - 0.3);
      spawn(angle + 0.3);
    }
    return true;
  }
}

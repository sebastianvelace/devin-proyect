// Cadencia y patrones de disparo + sistema de munición con recarga automática

import type { WeaponType } from "../../types";
import type { Bullet } from "../entities/Bullet";
import type { Pool } from "../../utils/pool";
import { vecFromAngle } from "../../utils/math";

interface WeaponDef {
  color: string;
  cooldown: number; // segundos entre disparos
  damage: number;
  speed: number;    // px/s
  radius: number;
  maxAmmo: number;  // munición máxima por cargador
}

const RELOAD_TIME = 5; // segundos de recarga automática

// Paleta Interstellar: azul hielo, ámbar, violeta, oro
export const WEAPONS: Record<WeaponType, WeaponDef> = {
  laser:    { color: "#60c8ff", cooldown: 0.15, damage: 1, speed: 720, radius: 3, maxAmmo: 30 },
  missiles: { color: "#e08030", cooldown: 0.4,  damage: 2, speed: 520, radius: 4, maxAmmo: 10 },
  plasma:   { color: "#c030cc", cooldown: 0.5,  damage: 3, speed: 340, radius: 9, maxAmmo: 8  },
  burst:    { color: "#f0c030", cooldown: 0.6,  damage: 1, speed: 640, radius: 3, maxAmmo: 16 },
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
  multishot?: boolean;
}

export class WeaponSystem {
  current: WeaponType = "laser";
  private cooldown = 0;
  private _ammo = WEAPONS["laser"].maxAmmo;
  private _reloading = false;
  private _reloadTimer = 0;

  get ammo(): number         { return this._ammo; }
  get maxAmmo(): number      { return WEAPONS[this.current].maxAmmo; }
  get isReloading(): boolean { return this._reloading; }
  /** 0 = recarga iniciada, 1 = recarga completa. */
  get reloadProgress(): number {
    if (!this._reloading) return 1;
    return 1 - this._reloadTimer / RELOAD_TIME;
  }

  get color(): string {
    return WEAPONS[this.current].color;
  }

  get ready(): boolean {
    return this.cooldown <= 0 && !this._reloading;
  }

  /** Cambia de arma; cancela la recarga y restaura el cargador del arma nueva. */
  setWeapon(weapon: WeaponType): void {
    if (this.current === weapon) return;
    this.current = weapon;
    this._ammo = WEAPONS[weapon].maxAmmo;
    this._reloading = false;
    this._reloadTimer = 0;
    this.cooldown = 0;
  }

  update(dt: number): void {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this._reloading) {
      this._reloadTimer -= dt;
      if (this._reloadTimer <= 0) {
        this._reloading = false;
        this._ammo = WEAPONS[this.current].maxAmmo;
      }
    }
  }

  tryFire(
    x: number,
    y: number,
    angle: number,
    pool: Pool<Bullet>,
    mods: FireMods = {},
  ): boolean {
    if (this.cooldown > 0 || this._reloading || this._ammo <= 0) return false;
    const def = WEAPONS[this.current];
    this.cooldown = def.cooldown;

    // Consume munición
    this._ammo--;
    if (this._ammo <= 0) {
      this._reloading = true;
      this._reloadTimer = RELOAD_TIME;
    }

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
      spawn(angle - 0.3);
      spawn(angle + 0.3);
    }
    return true;
  }
}

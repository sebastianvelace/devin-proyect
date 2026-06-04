// Cadencia y patrones de disparo — 6 armas con munición y recarga automática

import type { WeaponType } from "../../types";
import type { Bullet } from "../entities/Bullet";
import type { Pool } from "../../utils/pool";
import { vecFromAngle } from "../../utils/math";

interface WeaponDef {
  color: string;
  cooldown: number;  // segundos entre disparos
  damage: number;
  speed: number;     // px/s del proyectil
  radius: number;    // radio visual de la bala
  maxAmmo: number;   // capacidad del cargador
  reloadTime: number; // segundos de recarga
}

// Paleta Interstellar: cada arma tiene identidad cromática propia
export const WEAPONS: Record<WeaponType, WeaponDef> = {
  // ── 1 · LASER ─────────────────────────────────────────────────────────────
  // Preciso, rápido, bajo daño. Bala azul hielo. Arma de inicio.
  laser: {
    color: "#60c8ff", cooldown: 0.15, damage: 1,
    speed: 740, radius: 3, maxAmmo: 30, reloadTime: 2.5,
  },
  // ── 2 · MISSILES ──────────────────────────────────────────────────────────
  // Doble disparo guiado (homing). Ámbar. Daño medio-alto.
  missiles: {
    color: "#e08030", cooldown: 0.42, damage: 2,
    speed: 500, radius: 4, maxAmmo: 12, reloadTime: 4,
  },
  // ── 3 · PLASMA ────────────────────────────────────────────────────────────
  // Bola lenta y grande, atraviesa enemigos (piercing). Violeta.
  plasma: {
    color: "#c030cc", cooldown: 0.5, damage: 3,
    speed: 320, radius: 10, maxAmmo: 8, reloadTime: 4.5,
  },
  // ── 4 · BURST ─────────────────────────────────────────────────────────────
  // Abanico de 5 balas simultáneas. Dorado. Bueno en zonas cerradas.
  burst: {
    color: "#f0c030", cooldown: 0.6, damage: 1,
    speed: 620, radius: 3, maxAmmo: 18, reloadTime: 3.5,
  },
  // ── 5 · RAILGUN ───────────────────────────────────────────────────────────
  // Disparo único ultra-rápido y penetrante. Blanco. Alto daño, pocos tiros.
  railgun: {
    color: "#f0f8ff", cooldown: 1.4, damage: 6,
    speed: 1400, radius: 2, maxAmmo: 5, reloadTime: 6,
  },
  // ── 6 · FLAK ──────────────────────────────────────────────────────────────
  // Escopeta: 8 proyectiles en amplio abanico. Naranja-coral. CQC.
  flak: {
    color: "#ff5530", cooldown: 0.35, damage: 1,
    speed: 480, radius: 3, maxAmmo: 20, reloadTime: 3,
  },
};

export const WEAPON_LABEL: Record<WeaponType, string> = {
  laser:   "LASER",
  missiles: "MISSILES",
  plasma:  "PLASMA",
  burst:   "BURST",
  railgun: "RAILGUN",
  flak:    "FLAK",
};

/** Opciones adicionales aplicadas por power-ups. */
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

  get ammo(): number          { return this._ammo; }
  get maxAmmo(): number       { return WEAPONS[this.current].maxAmmo; }
  get isReloading(): boolean  { return this._reloading; }
  get reloadProgress(): number {
    if (!this._reloading) return 1;
    return 1 - this._reloadTimer / WEAPONS[this.current].reloadTime;
  }
  get color(): string         { return WEAPONS[this.current].color; }
  get ready(): boolean        { return this.cooldown <= 0 && !this._reloading; }

  /** Cambia de arma y restaura el cargador inmediatamente. */
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

  tryFire(x: number, y: number, angle: number, pool: Pool<Bullet>, mods: FireMods = {}): boolean {
    if (this.cooldown > 0 || this._reloading || this._ammo <= 0) return false;
    const def = WEAPONS[this.current];
    this.cooldown = def.cooldown;

    this._ammo--;
    if (this._ammo <= 0) {
      this._reloading = true;
      this._reloadTimer = def.reloadTime;
    }

    const damage = def.damage * (mods.damageMult ?? 1);
    const spawn = (a: number, speedMult = 1, damageMult = 1): void => {
      const v = vecFromAngle(a, def.speed * speedMult);
      pool.obtain().init(x, y, v.x, v.y, {
        radius: def.radius,
        damage: damage * damageMult,
        color: def.color,
        piercing: this.current === "plasma" || this.current === "railgun",
        homing: this.current === "missiles",
        friendly: true,
        life: this.current === "flak" ? 0.55 : 2.5,
      });
    };

    switch (this.current) {
      case "laser":
        spawn(angle);
        break;

      case "missiles": {
        const off = 0.1;
        spawn(angle - off);
        spawn(angle + off);
        break;
      }

      case "plasma":
        spawn(angle);
        break;

      case "burst": {
        const spread = 0.44;
        for (let i = -2; i <= 2; i++) spawn(angle + (spread / 4) * i);
        break;
      }

      case "railgun":
        // Proyectil único que traspasa — radio extra para efecto visual
        spawn(angle);
        // Segundo proyectil fantasma (menor daño) para el efecto de haz
        spawn(angle, 0.95, 0.15);
        break;

      case "flak": {
        // 8 pellets en amplio abanico (shotgun)
        const spread = 0.7;
        for (let i = 0; i < 8; i++) {
          const a = angle - spread / 2 + (spread / 7) * i;
          spawn(a + (Math.random() - 0.5) * 0.05, 0.85 + Math.random() * 0.3);
        }
        break;
      }
    }

    if (mods.multishot) {
      spawn(angle - 0.28);
      spawn(angle + 0.28);
    }
    return true;
  }
}

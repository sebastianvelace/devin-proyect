// Oleadas y formaciones por nivel

import type { EnemyType } from "../../types";
import { Enemy } from "../entities/Enemy";
import { TAU, randRange } from "../../utils/math";

export type Formation = "line" | "random" | "v" | "circle" | "spiral";

interface WaveGroup {
  type: EnemyType;
  count: number;
}

interface WaveDef {
  groups: WaveGroup[];
  formation: Formation;
}

export interface LevelDef {
  name: string;
  waves: WaveDef[];
  boss?: boolean;
}

export const LEVELS: LevelDef[] = [
  {
    name: "OUTER RIM",
    waves: [
      { groups: [{ type: "basic", count: 4 }, { type: "fast", count: 2 }], formation: "line" },
      { groups: [{ type: "basic", count: 3 }, { type: "elite", count: 2 }, { type: "fast", count: 3 }], formation: "random" },
      { groups: [{ type: "basic", count: 4 }, { type: "hunter", count: 2 }, { type: "elite", count: 1 }, { type: "fast", count: 2 }], formation: "v" },
      { groups: [{ type: "elite", count: 2 }, { type: "hunter", count: 3 }, { type: "basic", count: 3 }], formation: "circle" },
    ],
    boss: true,
  },
  {
    name: "ASTEROID BELT",
    waves: [
      { groups: [{ type: "fast", count: 5 }, { type: "basic", count: 3 }, { type: "hunter", count: 2 }], formation: "v" },
      { groups: [{ type: "tank", count: 1 }, { type: "elite", count: 2 }, { type: "basic", count: 4 }], formation: "line" },
      { groups: [{ type: "sniper", count: 2 }, { type: "hunter", count: 3 }, { type: "fast", count: 4 }], formation: "random" },
      { groups: [{ type: "tank", count: 2 }, { type: "bomber", count: 2 }, { type: "elite", count: 2 }], formation: "circle" },
      { groups: [{ type: "sniper", count: 3 }, { type: "elite", count: 2 }, { type: "hunter", count: 2 }], formation: "spiral" },
    ],
    boss: true,
  },
  {
    name: "VOID CORE",
    waves: [
      { groups: [{ type: "bomber", count: 3 }, { type: "fast", count: 4 }, { type: "hunter", count: 2 }], formation: "circle" },
      { groups: [{ type: "sniper", count: 3 }, { type: "tank", count: 2 }, { type: "elite", count: 2 }], formation: "line" },
      { groups: [{ type: "basic", count: 5 }, { type: "elite", count: 3 }, { type: "hunter", count: 3 }, { type: "fast", count: 4 }], formation: "spiral" },
      { groups: [{ type: "tank", count: 2 }, { type: "bomber", count: 3 }, { type: "sniper", count: 2 }, { type: "elite", count: 2 }], formation: "v" },
    ],
    boss: true,
  },
];

const SPAWN_DELAY = 1.4; // segundos entre oleadas

export class WaveManager {
  private waves: WaveDef[] = [];
  private index = 0;
  private delay = 0;

  loadLevel(def: LevelDef): void {
    this.waves = def.waves;
    this.index = 0;
    this.delay = 1; // pausa inicial antes de la primera oleada
  }

  get waveNumber(): number {
    // `index` ya avanza al spawnear; la oleada en combate es `index` (mín. 1).
    return Math.min(this.waves.length, Math.max(1, this.index));
  }

  get totalWaves(): number {
    return this.waves.length;
  }

  get isComplete(): boolean {
    return this.index >= this.waves.length;
  }

  /**
   * Llamar cada frame. Si no quedan enemigos vivos y se cumplió la pausa,
   * devuelve los enemigos de la siguiente oleada (si no, `[]`).
   */
  update(dt: number, aliveCount: number, w: number, h: number): Enemy[] {
    if (this.isComplete || aliveCount > 0) return [];
    this.delay -= dt;
    if (this.delay > 0) return [];
    const wave = this.waves[this.index];
    this.index += 1;
    this.delay = SPAWN_DELAY;
    return this.build(wave, w, h);
  }

  private build(wave: WaveDef, w: number, h: number): Enemy[] {
    const types: EnemyType[] = [];
    for (const g of wave.groups) {
      for (let i = 0; i < g.count; i++) types.push(g.type);
    }
    const positions = this.formationPositions(wave.formation, types.length, w, h);

    return types.map((type, i) => {
      const e = new Enemy();
      const p = positions[i];
      e.spawn(type, p.x, p.y, randRange(80, 220));
      return e;
    });
  }

  private formationPositions(
    formation: Formation,
    n: number,
    w: number,
    h: number,
  ): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    const cx = w / 2;

    switch (formation) {
      case "line":
        for (let i = 0; i < n; i++) {
          out.push({ x: ((i + 1) / (n + 1)) * w, y: -40 });
        }
        break;
      case "random":
        for (let i = 0; i < n; i++) {
          out.push({ x: randRange(60, w - 60), y: randRange(-200, -30) });
        }
        break;
      case "v": {
        const mid = (n - 1) / 2;
        const spacing = Math.min(80, (w - 120) / Math.max(1, n));
        for (let i = 0; i < n; i++) {
          out.push({ x: cx + (i - mid) * spacing, y: -40 - Math.abs(i - mid) * 28 });
        }
        break;
      }
      case "circle": {
        const r = 110;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          out.push({ x: cx + Math.cos(a) * r, y: -80 + Math.sin(a) * r });
        }
        break;
      }
      case "spiral":
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU * 2;
          const r = 30 + (i / n) * 130;
          out.push({ x: cx + Math.cos(a) * r, y: -60 + Math.sin(a) * r });
        }
        break;
    }
    void h;
    return out;
  }
}

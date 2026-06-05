// Constantes y escalado por sector (9 sectores, acto 2 desde el 4)

export const TOTAL_SECTORS = 9;
export const ACT1_FINAL_SECTOR = 3;
export const ACT2_FIRST_SECTOR = 4;

export const BOSS_NAMES = [
  "VOID HERALD",
  "GRAVITY LEVIATHAN",
  "VOID CORE",
  "EVENT HORIZON WARDEN",
  "TIDAL TYRANT",
  "ACCRETION BEAST",
  "LENS BREAKER",
  "ERGOSPHERE GUARDIAN",
  "THE SINGULARITY",
];

/** Multiplicadores por sector (HP, velocidad, cadencia, balas, +enemigos por oleada). */
export function sectorEnemyScale(level: number): {
  hpMult: number;
  speedMult: number;
  fireRateMult: number;
  bulletSpeedMult: number;
  extraPerGroup: number;
} {
  const t = Math.max(0, level - 1);
  return {
    hpMult: 1 + t * 0.048,
    speedMult: 1 + t * 0.028,
    fireRateMult: 1 / (1 + t * 0.032),
    bulletSpeedMult: 1 + t * 0.024,
    extraPerGroup: level >= 8 ? 2 : level >= 5 ? 1 : 0,
  };
}

/** Bonus suave al avanzar oleadas dentro del mismo sector. */
export function waveWithinSectorScale(waveIndex: number, totalWaves: number): {
  hpMult: number;
  speedMult: number;
  fireRateMult: number;
  bulletSpeedMult: number;
} {
  const waveT =
    totalWaves <= 1 ? 0 : Math.max(0, Math.min(1, (waveIndex - 1) / (totalWaves - 1)));
  return {
    hpMult: 1 + waveT * 0.07,
    speedMult: 1 + waveT * 0.05,
    fireRateMult: 1 / (1 + waveT * 0.04),
    bulletSpeedMult: 1 + waveT * 0.035,
  };
}

/** Combina escalado de sector + oleada para un spawn concreto. */
export function combinedEnemyScale(
  level: number,
  waveIndex: number,
  totalWaves: number,
): ReturnType<typeof sectorEnemyScale> {
  const sector = sectorEnemyScale(level);
  const wave = waveWithinSectorScale(waveIndex, totalWaves);
  return {
    hpMult: sector.hpMult * wave.hpMult,
    speedMult: sector.speedMult * wave.speedMult,
    fireRateMult: sector.fireRateMult * wave.fireRateMult,
    bulletSpeedMult: sector.bulletSpeedMult * wave.bulletSpeedMult,
    extraPerGroup: sector.extraPerGroup,
  };
}

/** HP del jefe — curva más suave a partir del acto 2. */
export function sectorBossMaxHp(level: number): number {
  if (level <= 3) return 80 + (level - 1) * 60;
  return 200 + (level - ACT1_FINAL_SECTOR) * 32;
}

export function sectorBossPoints(level: number): number {
  return 2000 * level;
}

export function isAct2(level: number): boolean {
  return level >= ACT2_FIRST_SECTOR;
}

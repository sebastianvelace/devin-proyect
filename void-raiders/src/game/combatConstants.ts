/** Ajuste global de dificultad (+10 % sobre la curva previa). */
export const GLOBAL_DIFFICULTY_MULT = 1.1;

/** Velocidad base de proyectiles hostiles antes del escalado por sector/oleada. */
export const ENEMY_BULLET_SPEED_BASE = 1.25 * GLOBAL_DIFFICULTY_MULT;

/** @deprecated Usar ENEMY_BULLET_SPEED_BASE; se mantiene por compatibilidad. */
export const ENEMY_BULLET_SPEED_MULT = ENEMY_BULLET_SPEED_BASE;

/** Movimiento enemigo (+10 % px/s en spawn, además del escalado por sector). */
export const ENEMY_MOVE_SPEED_MULT = GLOBAL_DIFFICULTY_MULT;

/**
 * Cadencia de disparo: multiplicador del intervalo entre disparos.
 * 0.909… ≈ −10 % de tiempo entre disparos (+10 % de fuego).
 */
export const ENEMY_FIRE_RATE_MULT = 1 / GLOBAL_DIFFICULTY_MULT;

/** Dispersión máxima del aim (rad); −10 % = disparos más precisos. */
export const ENEMY_AIM_JITTER_MAX = 0.22 / GLOBAL_DIFFICULTY_MULT;

/**
 * Escalado de dificultad — fórmulas (ver sectorConfig.ts):
 *
 * sectorT = max(0, level − 1)
 * sectorHp      = 1 + sectorT × 0.048
 * sectorSpeed   = 1 + sectorT × 0.028
 * sectorFire    = 1 / (1 + sectorT × 0.032)   → intervalo más corto
 * sectorBullet  = 1 + sectorT × 0.024
 *
 * waveT = (waveIndex − 1) / max(1, totalWaves − 1)   // 0…1 dentro del sector
 * waveHp      = 1 + waveT × 0.07
 * waveSpeed   = 1 + waveT × 0.05
 * waveFire    = 1 / (1 + waveT × 0.04)
 * waveBullet  = 1 + waveT × 0.035
 *
 * Valor final = base × sector × wave × GLOBAL_DIFFICULTY_MULT (donde aplique).
 */

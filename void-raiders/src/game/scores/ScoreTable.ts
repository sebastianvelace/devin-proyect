// Tabla de puntajes persistida en localStorage

export const SCORES_STORAGE_KEY = "void-raiders-scores";
export const MAX_SCORE_ENTRIES = 10;

export interface ScoreEntry {
  score: number;
  date: string;
  name?: string;
}

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is ScoreEntry =>
          typeof e === "object" &&
          e !== null &&
          typeof (e as ScoreEntry).score === "number" &&
          typeof (e as ScoreEntry).date === "string",
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORE_ENTRIES);
  } catch {
    return [];
  }
}

/** Mejor puntaje guardado en partidas anteriores (0 si no hay entradas). */
export function getHistoricalRecord(): number {
  const scores = loadScores();
  if (scores.length === 0) return 0;
  return scores[0].score;
}

export function saveScore(score: number, name?: string): void {
  if (!Number.isFinite(score) || score < 0) return;
  const entries = loadScores();
  entries.push({
    score: Math.floor(score),
    date: new Date().toISOString(),
    ...(name ? { name } : {}),
  });
  entries.sort((a, b) => b.score - a.score);
  const top = entries.slice(0, MAX_SCORE_ENTRIES);
  try {
    localStorage.setItem(SCORES_STORAGE_KEY, JSON.stringify(top));
  } catch {
    /* quota / private mode */
  }
}

export function formatScoreDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Mensaje HUD: distancia al récord histórico (partidas previas). */
export function getRecordHudMessage(currentScore: number, historicalRecord: number): string {
  const score = Math.floor(currentScore);
  if (historicalRecord <= 0) {
    if (score <= 0) return "Establece el récord";
    return "¡Superando récord!";
  }
  if (score >= historicalRecord) return "¡Superando récord!";
  const gap = historicalRecord - score;
  return `Faltan ${gap.toLocaleString()} pts para el récord`;
}

// Tabla de mejores puntajes — estilo Interstellar (canvas)

import {
  formatScoreDate,
  loadScores,
  type ScoreEntry,
} from "../scores/ScoreTable";

const AMBER = "#e8a840";
const ICE = "#80c8ff";
const WARM_W = "#f4ead8";
const DIM = "#667788";
const DIM_ROW = "#8899aa";
const FONT_MONO = "'JetBrains Mono', monospace";
const FONT_UI = "'IBM Plex Sans', sans-serif";

export interface LeaderboardLayout {
  x: number;
  y: number;
  width: number;
  rowHeight: number;
  headerHeight: number;
  totalHeight: number;
}

export function measureLeaderboard(
  entryCount: number,
  width = 320,
): LeaderboardLayout {
  const rows = Math.max(1, Math.min(entryCount, 10));
  const headerHeight = 28;
  const rowHeight = 22;
  return {
    x: 0,
    y: 0,
    width,
    rowHeight,
    headerHeight,
    totalHeight: headerHeight + rows * rowHeight + 8,
  };
}

export function renderLeaderboard(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  topY: number,
  options?: {
    title?: string;
    entries?: ScoreEntry[];
    maxRows?: number;
    width?: number;
    highlightScore?: number;
  },
): LeaderboardLayout {
  const title = options?.title ?? "HIGH SCORES";
  const entries = options?.entries ?? loadScores();
  const maxRows = options?.maxRows ?? 10;
  const width = options?.width ?? Math.min(360, 320);
  const rows = entries.slice(0, maxRows);
  const layout = measureLeaderboard(rows.length || 1, width);
  const left = centerX - width / 2;
  let y = topY;

  ctx.save();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  ctx.font = `500 11px ${FONT_UI}`;
  ctx.letterSpacing = "3px";
  ctx.fillStyle = AMBER;
  ctx.fillText(title, left, y + 10);
  y += layout.headerHeight;

  ctx.font = `400 9px ${FONT_MONO}`;
  ctx.letterSpacing = "1px";
  ctx.fillStyle = DIM;
  ctx.fillText("#", left, y + 10);
  ctx.fillText("SCORE", left + 28, y + 10);
  ctx.textAlign = "right";
  ctx.fillText("DATE", left + width, y + 10);
  ctx.textAlign = "left";
  y += 6;

  ctx.strokeStyle = ICE + "44";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(left + width, y);
  ctx.stroke();
  y += 10;

  if (rows.length === 0) {
    ctx.font = `400 11px ${FONT_UI}`;
    ctx.fillStyle = DIM_ROW;
    ctx.textAlign = "center";
    ctx.fillText("Sin partidas registradas", centerX, y + 14);
    ctx.restore();
    layout.y = topY;
    layout.x = left;
    return layout;
  }

  const highlight = options?.highlightScore;
  for (let i = 0; i < rows.length; i++) {
    const e = rows[i];
    const rowY = y + i * layout.rowHeight + layout.rowHeight / 2;
    const isHighlight =
      highlight !== undefined && Math.floor(highlight) === e.score;

    ctx.textAlign = "left";
    ctx.font = `600 11px ${FONT_MONO}`;
    ctx.fillStyle = isHighlight ? AMBER : i === 0 ? WARM_W : DIM_ROW;
    ctx.fillText(String(i + 1).padStart(2, " "), left, rowY);

    ctx.font = `500 12px ${FONT_MONO}`;
    ctx.fillStyle = isHighlight ? AMBER : i === 0 ? WARM_W + "ee" : WARM_W + "99";
    ctx.fillText(e.score.toLocaleString().padStart(8, " "), left + 28, rowY);

    ctx.textAlign = "right";
    ctx.font = `400 10px ${FONT_MONO}`;
    ctx.fillStyle = DIM;
    ctx.fillText(formatScoreDate(e.date), left + width, rowY);
  }

  ctx.restore();
  layout.x = left;
  layout.y = topY;
  return layout;
}

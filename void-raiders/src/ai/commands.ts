// Parser local de comandos de voz (fallback sin API, latencia ~0)

import type { CopilotResponse } from "./copilot-types";
import type { WeaponType } from "../types";

/** Tokens por arma — ordenados de más específico a más corto dentro de cada lista. */
const WEAPON_TOKENS: { weapon: WeaponType; tokens: string[]; priority: number }[] = [
  {
    weapon: "missiles",
    priority: 60,
    tokens: [
      "misil es",
      "misiles",
      "misile",
      "misilas",
      "misil",
      "mísiles",
      "mísil",
      "cohetes",
      "cohete",
      "missiles",
      "missile",
      "rockets",
      "rocket",
    ],
  },
  {
    weapon: "railgun",
    priority: 55,
    tokens: [
      "railgun",
      "rail gun",
      "riel",
      "canon rail",
      "cañon rail",
      "francotirador",
    ],
  },
  {
    weapon: "plasma",
    priority: 50,
    tokens: ["plasma", "plazma", "plama", "bola plasma"],
  },
  {
    weapon: "burst",
    priority: 48,
    tokens: [
      "rafaga",
      "ráfaga",
      "rafagas",
      "ráfagas",
      "ametralladora",
      "metralleta",
      "burst",
      "rapid fire",
    ],
  },
  {
    weapon: "flak",
    priority: 45,
    tokens: [
      "antiaerea",
      "antiaérea",
      "escopeta",
      "flack",
      "flak",
      "metralla",
    ],
  },
  {
    weapon: "laser",
    priority: 40,
    tokens: ["laser", "lazer", "láser", "la ser", "lase", "lasser"],
  },
];

const SHIELD_TOKENS = ["escudo", "defensa", "proteccion", "protección", "shield"];
const BOMB_TOKENS = ["bomba", "boom", "explotar", "limpiar", "limpia"];
const STATUS_TOKENS = [
  "estado",
  "reporte",
  "como vamos",
  "cómo vamos",
  "situacion",
  "situación",
  "tactica",
  "táctica",
];

const FALLBACK_MESSAGES: Record<string, string[]> = {
  laser: ["Láser activo, piloto.", "¡Láser listo!"],
  missiles: ["Misiles cargados.", "¡A darles con cohetes!"],
  plasma: ["Plasma en línea.", "Bolas de plasma listas."],
  burst: ["Ráfaga seleccionada.", "Modo ráfaga activo."],
  railgun: ["Railgun calibrado.", "Disparo penetrante listo."],
  flak: ["Flak listo, corto alcance.", "Escopeta antiaérea activa."],
  shield: ["Escudo arriba.", "Defensas activadas, aguanta."],
  bomb: ["Bomba desplegada.", "¡Boom! Pantalla limpia."],
  bomb_fail: ["Sin bombas en reserva.", "No hay bomba cargada."],
  status: ["Reporte táctico enviado.", "Estado en pantalla, piloto."],
};

/** Palabras cortas que solo cuentan con límite de palabra (evita falsos positivos). */
const SHORT_TOKEN_MAX = 4;

/** Tokens que pueden coincidir como prefijo (p. ej. "misil" → "misiles"). */
const STEM_PREFIX_TOKENS = new Set(["misil", "misile", "lase"]);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[''`]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Coincidencia segura: frase completa, palabra (\b) o subcadena larga en contexto de comando. */
export function includesKeyword(text: string, keyword: string): boolean {
  const k = normalize(keyword);
  if (!k || k.length < 2) return false;
  if (k.includes(" ")) return text.includes(k);

  if (STEM_PREFIX_TOKENS.has(k)) {
    const stemRe = new RegExp(`\\b${escapeRegex(k)}`, "iu");
    if (stemRe.test(text)) return true;
  } else {
    const wordRe = new RegExp(`(?<![\\p{L}])${escapeRegex(k)}(?![\\p{L}])`, "iu");
    if (wordRe.test(text)) return true;
  }

  if (k.length >= SHORT_TOKEN_MAX + 1 && text.includes(k)) {
    const idx = text.indexOf(k);
    const before = idx === 0 ? " " : text[idx - 1] ?? " ";
    const after = text[idx + k.length] ?? " ";
    const boundaryBefore = !/\p{L}/u.test(before);
    const boundaryAfter = !/\p{L}/u.test(after);
    if (boundaryBefore && boundaryAfter) return true;
  }

  return false;
}

function scoreTokens(text: string, tokens: string[]): number {
  let best = 0;
  for (const token of tokens) {
    if (!includesKeyword(text, token)) continue;
    const len = normalize(token).replace(/\s/g, "").length;
    const phraseBonus = token.includes(" ") ? 4 : 0;
    best = Math.max(best, len * 2 + phraseBonus);
  }
  return best;
}

function pickMessage(key: string): string {
  const list = FALLBACK_MESSAGES[key];
  if (!list?.length) return "Entendido, piloto.";
  return list[Math.floor(Math.random() * list.length)]!;
}

function matchWeapon(text: string): WeaponType | null {
  let bestWeapon: WeaponType | null = null;
  let bestScore = 0;
  let bestPriority = -1;

  for (const { weapon, tokens, priority } of WEAPON_TOKENS) {
    const score = scoreTokens(text, tokens);
    if (score === 0) continue;
    if (
      score > bestScore ||
      (score === bestScore && priority > bestPriority)
    ) {
      bestScore = score;
      bestPriority = priority;
      bestWeapon = weapon;
    }
  }

  return bestWeapon;
}

/** Intenta interpretar el texto sin API. Devuelve null si no hay match. */
export function matchLocalCommand(
  raw: string,
  context?: { bombs_available: number },
): CopilotResponse | null {
  const text = normalize(raw);
  if (text.length < 2) return null;

  const weapon = matchWeapon(text);
  if (weapon) {
    return {
      action: "change_weapon",
      params: { weapon },
      message: pickMessage(weapon),
    };
  }

  if (SHIELD_TOKENS.some((t) => includesKeyword(text, t))) {
    return {
      action: "activate_shield",
      params: {},
      message: pickMessage("shield"),
    };
  }

  if (BOMB_TOKENS.some((t) => includesKeyword(text, t))) {
    const hasBomb = (context?.bombs_available ?? 0) > 0;
    return {
      action: "deploy_bomb",
      params: {},
      message: hasBomb ? pickMessage("bomb") : pickMessage("bomb_fail"),
    };
  }

  if (STATUS_TOKENS.some((t) => includesKeyword(text, t))) {
    return buildTacticalInfoMessage(context);
  }

  return null;
}

export function buildTacticalInfoMessage(context?: {
  bombs_available?: number;
  shield_active?: boolean;
  player_health?: number;
  enemy_count?: number;
  current_weapon?: string;
  score?: number;
}): CopilotResponse {
  const lives = context?.player_health ?? 3;
  const enemies = context?.enemy_count ?? 0;
  const weapon = (context?.current_weapon ?? "laser").toUpperCase();
  const bombs = context?.bombs_available ?? 0;
  const shield = context?.shield_active ? "escudo ON" : "sin escudo";
  const msg = `${lives} vidas · ${enemies} hostiles · ${weapon} · ${bombs} bombas · ${shield}`;
  return {
    action: "tactical_info",
    params: {},
    message: msg.length > 48 ? msg.slice(0, 45) + "…" : msg,
  };
}

// Anthropic Messages API — proxy en Vercel o cliente directo (hackathon local)

import type { CopilotResponse, GameStateSnapshot } from "./copilot-types";
import type { WeaponType } from "../types";

const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 150;
const API_VERSION = "2023-06-01";

const SYSTEM_PROMPT = `Eres NOVA, la IA copiloto de una nave espacial de combate. El piloto te habla por voz durante el combate. Interpreta comandos y responde SOLO con JSON válido (sin markdown): {"action":"string","params":{},"message":"string"}.

Acciones:
- change_weapon: params.weapon = "laser"|"missiles"|"plasma"|"burst"|"railgun"|"flak"
- activate_shield: {}
- deploy_bomb: {}
- tactical_info: {} — reporte de batalla
- tactical_message: {} — advertencia táctica breve (sin cambiar armas)
- none: {} — si no es comando

Mensaje: máximo 8 palabras, español, tono militar con humor sutil. Ejemplos: "¡Misiles cargados!", "Escudo arriba piloto", "¡Tanque a la izquierda!".

Con game_state puedes advertir proactivamente (tactical_message).`;

export type ClaudeCallKind = "command" | "tactical";

export interface ClaudeServiceOptions {
  timeoutMs?: number;
}

function preferProxy(): boolean {
  if (import.meta.env.VITE_USE_ANTHROPIC_PROXY === "true") return true;
  if (import.meta.env.PROD) return true;
  return false;
}

function clientApiKey(): string | undefined {
  const key = import.meta.env.VITE_ANTHROPIC_API_KEY?.trim();
  return key || undefined;
}

function isApiAvailable(): boolean {
  return preferProxy() || !!clientApiKey();
}

function buildUserContent(
  kind: ClaudeCallKind,
  transcript: string | null,
  state: GameStateSnapshot,
): string {
  const payload = { game_state: state };
  if (kind === "tactical") {
    return `Modo táctica proactiva. Analiza el estado y responde con tactical_message si hay amenaza relevante, o none si no hay nada urgente.\n${JSON.stringify(payload)}`;
  }
  const phrase = transcript?.trim() || "";
  return `Comando de voz del piloto: "${phrase}"\n${JSON.stringify(payload)}`;
}

async function postMessages(body: object, signal?: AbortSignal): Promise<Response> {
  const json = JSON.stringify(body);

  if (preferProxy()) {
    const res = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
      signal,
    });
    if (res.ok || res.status !== 404) return res;
  }

  const key = clientApiKey();
  if (!key) {
    throw new Error("No API key: set VITE_ANTHROPIC_API_KEY or deploy with ANTHROPIC_API_KEY proxy");
  }

  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: json,
    signal,
  });
}

function extractTextFromResponse(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const content = (data as { content?: { type: string; text?: string }[] }).content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("");
}

export function parseCopilotJson(raw: string): CopilotResponse | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const action = String(parsed.action ?? "none") as CopilotResponse["action"];
    const params = (parsed.params && typeof parsed.params === "object"
      ? parsed.params
      : {}) as Record<string, unknown>;
    const message = String(parsed.message ?? parsed.copilot_message ?? "").trim();
    return { action, params, message: message || "Entendido, piloto." };
  } catch {
    return null;
  }
}

const VALID_WEAPONS = new Set<WeaponType>([
  "laser", "missiles", "plasma", "burst", "railgun", "flak",
]);

export function sanitizeCopilotResponse(res: CopilotResponse): CopilotResponse {
  if (res.action === "change_weapon") {
    const w = String(res.params.weapon ?? "").toLowerCase() as WeaponType;
    if (!VALID_WEAPONS.has(w)) {
      return { action: "none", params: {}, message: res.message || "Arma no reconocida." };
    }
    return { action: "change_weapon", params: { weapon: w }, message: res.message };
  }
  return res;
}

async function callClaude(
  kind: ClaudeCallKind,
  transcript: string | null,
  state: GameStateSnapshot,
  options?: ClaudeServiceOptions,
): Promise<CopilotResponse | null> {
  if (!isApiAvailable()) return null;

  const controller = new AbortController();
  const timeout = options?.timeoutMs ?? 2800;
  const timer = window.setTimeout(() => controller.abort(), timeout);

  try {
    const body = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserContent(kind, transcript, state),
        },
      ],
    };

    const res = await postMessages(body, controller.signal);
    if (!res.ok) return null;

    const data = await res.json();
    const text = extractTextFromResponse(data);
    const parsed = parseCopilotJson(text);
    return parsed ? sanitizeCopilotResponse(parsed) : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function interpretVoiceCommand(
  transcript: string,
  state: GameStateSnapshot,
  options?: ClaudeServiceOptions,
): Promise<CopilotResponse | null> {
  return callClaude("command", transcript, state, options);
}

export async function fetchProactiveTactic(
  state: GameStateSnapshot,
  options?: ClaudeServiceOptions,
): Promise<CopilotResponse | null> {
  return callClaude("tactical", null, state, { ...options, timeoutMs: options?.timeoutMs ?? 3500 });
}

export function claudeApiConfigured(): boolean {
  return isApiAvailable();
}

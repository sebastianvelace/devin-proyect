// Orquesta voz/texto → fallback local + Claude async → acciones en GameScene

import { matchLocalCommand, buildTacticalInfoMessage } from "./commands";
import { claudeApiConfigured, fetchProactiveTactic, interpretVoiceCommand } from "./ClaudeService";
import type { CopilotGameActions, CopilotResponse, GameStateSnapshot } from "./copilot-types";
import type { WeaponType } from "../types";
import { VoiceListener } from "./VoiceListener";
import { ensureMicPermission } from "./micPermission";
import { CopilotUI } from "../game/ui/CopilotUI";
import { WEAPON_LABEL } from "../game/systems/WeaponSystem";

const PROACTIVE_INTERVAL = 10;
const VOICE_DEBOUNCE_MS = 450;
const CLAUDE_TIMEOUT_MS = 2800;

export class CopilotBrain {
  private readonly actions: CopilotGameActions;
  readonly ui: CopilotUI;
  private readonly voice = new VoiceListener();

  private proactiveTimer = PROACTIVE_INTERVAL;
  private lastFinalTranscript = "";
  private lastProcessedAt = 0;
  private claudeBusy = false;
  private enabled = false;
  /** Si el último comando local ya cambió arma, Claude no debe sobrescribirla. */
  private localWeaponLocked: WeaponType | null = null;

  constructor(actions: CopilotGameActions) {
    this.actions = actions;
    this.ui = new CopilotUI();
    this.voice.onTranscript((text, isFinal) => this.onTranscript(text, isFinal));
  }

  start(): void {
    this.enabled = true;
    this.proactiveTimer = PROACTIVE_INTERVAL;
    if (this.voice.supported) {
      void ensureMicPermission().then((ok) => {
        if (!ok && this.enabled) {
          this.ui.showMessage("Activa el mic en el menú (ENABLE MIC)");
        }
        if (this.enabled) {
          this.voice.start();
          this.ui.setListening(true);
        }
      });
    } else {
      this.ui.setListening(false);
      this.ui.showMessage("Voz no disponible — usa ` o consola novaSay()");
    }
  }

  stop(): void {
    this.enabled = false;
    this.voice.stop();
    this.ui.setListening(false);
    this.localWeaponLocked = null;
  }

  update(dt: number): void {
    this.ui.update(dt);
    if (!this.enabled) return;

    this.ui.setListening(this.voice.listening);
    this.ui.setWeapon(this.actions.getGameState().current_weapon);

    if (!claudeApiConfigured()) return;

    this.proactiveTimer -= dt;
    if (this.proactiveTimer <= 0) {
      this.proactiveTimer = PROACTIVE_INTERVAL;
      void this.runProactiveTactic();
    }
  }

  /** Entrada manual para debug (consola / tecla `) */
  handleTextInput(text: string): void {
    if (!text.trim()) return;
    this.processPhrase(text.trim(), true);
  }

  private onTranscript(text: string, isFinal: boolean): void {
    if (!this.enabled) return;
    if (!isFinal) {
      this.ui.setInterim(text);
      return;
    }
    this.ui.setInterim("");
    const now = performance.now();
    if (text === this.lastFinalTranscript && now - this.lastProcessedAt < VOICE_DEBOUNCE_MS * 3) {
      return;
    }
    this.lastFinalTranscript = text;
    this.lastProcessedAt = now;
    this.processPhrase(text, false);
  }

  private processPhrase(phrase: string, fromDebug: boolean): void {
    const state = this.actions.getGameState();
    const local = matchLocalCommand(phrase, { bombs_available: state.bombs_available });

    if (local) {
      if (local.action === "change_weapon") {
        const w = String(local.params.weapon ?? "") as WeaponType;
        this.localWeaponLocked = w;
      }
      this.execute(local, true);
      if (!fromDebug) void this.enrichWithClaude(phrase, state, local);
      return;
    }

    this.localWeaponLocked = null;

    if (claudeApiConfigured() && !this.claudeBusy) {
      this.claudeBusy = true;
      this.ui.showMessage("Procesando…");
      void interpretVoiceCommand(phrase, state, { timeoutMs: CLAUDE_TIMEOUT_MS }).then((claude) => {
        this.claudeBusy = false;
        if (!this.enabled) return;
        if (claude && claude.action !== "none") {
          this.execute(claude, false);
          return;
        }
        if (claude?.message) {
          this.ui.showMessage(claude.message);
          return;
        }
        this.ui.showMessage("¿Qué dijiste? Hay mucho ruido aquí.");
      });
      return;
    }

    if (!claudeApiConfigured()) {
      this.ui.showMessage("¿Qué dijiste? Prueba: misiles, láser, plasma…");
    }
  }

  private async enrichWithClaude(
    phrase: string,
    state: GameStateSnapshot,
    local: CopilotResponse,
  ): Promise<void> {
    if (!claudeApiConfigured()) return;
    const claude = await interpretVoiceCommand(phrase, state, { timeoutMs: CLAUDE_TIMEOUT_MS });
    if (!claude) return;

    if (local.action === "change_weapon" && claude.action === "change_weapon") {
      if (claude.message && claude.message !== local.message) {
        this.ui.showMessage(claude.message);
      }
      return;
    }

    if (claude.message) this.ui.showMessage(claude.message);
  }

  private async runProactiveTactic(): Promise<void> {
    if (this.claudeBusy) return;
    const state = this.actions.getGameState();
    if (state.enemy_count === 0 && state.combat_status !== "boss") return;

    this.claudeBusy = true;
    const res = await fetchProactiveTactic(state, { timeoutMs: 3500 });
    this.claudeBusy = false;

    if (!res) return;
    if (res.action === "tactical_message" || res.action === "tactical_info") {
      if (res.message) this.ui.showMessage(res.message);
      return;
    }
    if (res.action === "change_weapon" && this.localWeaponLocked) {
      if (res.message) this.ui.showMessage(res.message);
      return;
    }
    if (res.action !== "none") {
      this.execute(res, false);
    } else if (res.message) {
      this.ui.showMessage(res.message);
    }
  }

  private execute(res: CopilotResponse, fromLocal: boolean): void {
    switch (res.action) {
      case "change_weapon": {
        const w = String(res.params.weapon ?? "") as WeaponType;
        const locked = this.localWeaponLocked;
        const mayChange = fromLocal || !locked || w === locked;
        if (mayChange) {
          this.actions.changeWeapon(w);
          this.ui.setWeapon(w);
          this.ui.showWeaponToast(WEAPON_LABEL[w]);
          if (fromLocal) this.localWeaponLocked = w;
        }
        if (res.message) this.ui.showMessage(res.message);
        return;
      }
      case "activate_shield":
        this.actions.activateShield();
        break;
      case "deploy_bomb":
        if (!this.actions.deployBomb()) {
          this.ui.showMessage(res.message || "Sin bombas en reserva.");
          return;
        }
        break;
      case "tactical_info": {
        const info = buildTacticalInfoMessage(this.actions.getGameState());
        this.ui.showMessage(res.message || info.message);
        return;
      }
      case "tactical_message":
        break;
      case "none":
      default:
        break;
    }
    if (res.message) this.ui.showMessage(res.message);
  }
}

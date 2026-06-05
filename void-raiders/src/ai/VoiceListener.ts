// Web Speech API — escucha continua en español (Colombia / España fallback)

export type TranscriptHandler = (text: string, isFinal: boolean) => void;

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [i: number]: { isFinal: boolean; [j: number]: { transcript: string } } };
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const LANG_PRIMARY = "es-CO";
const LANG_FALLBACK = "es-ES";
const RESTART_DELAY_MS = 280;
/** Evita doble disparo del mismo final del motor de voz, pero permite repetir el comando después. */
const FINAL_DEDUP_MS = 2500;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function devLog(...args: unknown[]): void {
  if (import.meta.env.DEV) console.debug("[NOVA voice]", ...args);
}

export class VoiceListener {
  private recognition: SpeechRecognitionLike | null = null;
  private running = false;
  private handler: TranscriptHandler | null = null;
  private _listening = false;
  private _supported = false;
  private _lastError = "";
  private langIndex = 0;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private lastEmittedFinal = "";
  private lastEmittedFinalAt = 0;
  private lastEmittedInterim = "";

  constructor() {
    const Ctor = getRecognitionCtor();
    this._supported = !!Ctor;
    if (Ctor) {
      this.recognition = new Ctor();
      this.applyLang();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.bindEvents();
    }
  }

  get supported(): boolean {
    return this._supported;
  }

  get listening(): boolean {
    return this._listening;
  }

  get lastError(): string {
    return this._lastError;
  }

  onTranscript(handler: TranscriptHandler): void {
    this.handler = handler;
  }

  start(): boolean {
    if (!this.recognition || this.running) return false;
    try {
      this.recognition.start();
      this.running = true;
      return true;
    } catch (e) {
      devLog("start failed", e);
      return false;
    }
  }

  stop(): void {
    this.running = false;
    this._listening = false;
    this.clearRestartTimer();
    this.recognition?.stop();
  }

  private applyLang(): void {
    if (!this.recognition) return;
    this.recognition.lang = this.langIndex === 0 ? LANG_PRIMARY : LANG_FALLBACK;
  }

  private clearRestartTimer(): void {
    if (this.restartTimer !== null) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  private scheduleRestart(reason: string): void {
    if (!this.running) return;
    this.clearRestartTimer();
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.running || !this.recognition) return;
      try {
        this.recognition.start();
        devLog("restarted", reason, this.recognition.lang);
      } catch {
        devLog("restart failed", reason);
      }
    }, RESTART_DELAY_MS);
  }

  private tryLangFallback(error: string): boolean {
    if (this.langIndex >= 1) return false;
    this.langIndex = 1;
    this.applyLang();
    devLog("lang fallback →", LANG_FALLBACK, "after", error);
    return true;
  }

  private bindEvents(): void {
    const rec = this.recognition!;
    rec.onstart = () => {
      this._listening = true;
      this._lastError = "";
      devLog("listening", rec.lang);
    };
    rec.onend = () => {
      this._listening = false;
      if (this.running) this.scheduleRestart("onend");
    };
    rec.onerror = (ev) => {
      this._lastError = ev.error;
      devLog("error", ev.error);

      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        this.running = false;
        return;
      }

      if (ev.error === "language-not-supported" && this.tryLangFallback(ev.error)) {
        this.scheduleRestart("lang-fallback");
        return;
      }

      if (
        ev.error === "network" ||
        ev.error === "no-speech" ||
        ev.error === "aborted" ||
        ev.error === "audio-capture"
      ) {
        this.scheduleRestart(ev.error);
      }
    };
    rec.onresult = (ev) => {
      let interim = "";
      let final = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const result = ev.results[i]!;
        const chunk = (result[0]?.transcript ?? "").trim();
        if (!chunk) continue;
        if (result.isFinal) final += (final ? " " : "") + chunk;
        else interim += (interim ? " " : "") + chunk;
      }

      final = final.trim();
      interim = interim.trim();

      if (final && this.handler) {
        const now = performance.now();
        if (
          final === this.lastEmittedFinal &&
          now - this.lastEmittedFinalAt < FINAL_DEDUP_MS
        ) {
          devLog("skip duplicate final", final);
          return;
        }
        this.lastEmittedFinal = final;
        this.lastEmittedFinalAt = now;
        this.lastEmittedInterim = "";
        devLog("final", final);
        this.handler(final, true);
        return;
      }

      if (interim && this.handler && interim !== this.lastEmittedInterim) {
        this.lastEmittedInterim = interim;
        devLog("interim", interim);
        this.handler(interim, false);
      }
    };
  }
}

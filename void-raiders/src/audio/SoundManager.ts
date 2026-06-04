// Motor de audio procedural — Web Audio API, sin archivos externos.
// Preferencias en localStorage (`void-raiders-audio`). Para samples MP3/OGG,
// colócalos en `public/sounds/<id>.mp3` y usa registerSample() desde main.
// Música custom: `public/sounds/music_game.mp3` → registerMusic(url).

const STORAGE_KEY = "void-raiders-audio";

/** Intensidad de la música épica (0–1). Ajustable en runtime vía setMusicVolume(). */
export const DEFAULT_MUSIC_VOLUME = 0.42;

export type SoundId =
  | "shoot_laser"
  | "shoot_missiles"
  | "shoot_plasma"
  | "shoot_burst"
  | "shoot_railgun"
  | "shoot_flak"
  | "explosion_small"
  | "explosion_large"
  | "enemy_hit"
  | "player_hit"
  | "shield_block"
  | "powerup"
  | "ui_click"
  | "ui_hover"
  | "combo"
  | "boss_phase"
  | "reload"
  | "wave_alert"
  | "level_start"
  | "warp"
  | "defeat"
  | "victory"
  | "menu_back";

type MusicVariant = "menu" | "game";

// Progresión épica i–VI–III–VII (Am → F → C → G) en La menor
const CHORD_ROOTS = [55, 43.65, 65.41, 49]; // A1, F1, C2, G1
const CHORD_TONES = [
  [55, 65.41, 82.41],   // Am
  [43.65, 55, 65.41],   // F
  [65.41, 82.41, 98],   // C
  [49, 58.27, 73.42],   // G
];
const ARP_SCALE = [220, 261.63, 293.66, 329.63, 392, 440]; // Am pentatónica

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicNodes: (AudioNode & { stop?: () => void })[] = [];
  private musicTimeout: ReturnType<typeof setTimeout> | null = null;
  private musicNextLoop = 0;
  private musicVariant: MusicVariant | null = null;
  private customMusicBuf: AudioBuffer | null = null;
  private ready = false;
  private muted = false;
  private volume = 0.6;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private samples = new Map<SoundId, AudioBuffer>();
  private lastHoverAt = 0;

  init(): void {
    if (this.ready) return;
    this.ready = true;
    this.loadPrefs();
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.applyMasterGain();
    this.applyMusicGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(this.ctx.destination);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  get masterVolume(): number {
    return this.volume;
  }

  get musicLevel(): number {
    return this.musicVolume;
  }

  setMasterVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyMasterGain();
    this.savePrefs();
  }

  setMusicVolume(v: number): void {
    this.musicVolume = Math.max(0, Math.min(1, v));
    this.applyMusicGain();
    this.savePrefs();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyMasterGain();
    if (this.muted) this.stopMusicNodes();
    else {
      this.resume();
      if (this.musicVariant) this.beginMusicLoop();
    }
    this.savePrefs();
    return this.muted;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.applyMasterGain();
    if (this.muted) this.stopMusicNodes();
    else if (this.musicVariant) this.beginMusicLoop();
    this.savePrefs();
  }

  /** Carga un sample desde URL (p. ej. `/sounds/ui_click.mp3`). */
  async registerSample(id: SoundId, url: string): Promise<void> {
    if (!this.ctx) this.init();
    const res = await fetch(url);
    if (!res.ok) return;
    const buf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
    this.samples.set(id, buf);
  }

  /** Loop de música custom (p. ej. `/sounds/music_game.mp3`). */
  async registerMusic(url: string): Promise<void> {
    if (!this.ctx) this.init();
    const res = await fetch(url);
    if (!res.ok) return;
    this.customMusicBuf = await this.ctx!.decodeAudioData(await res.arrayBuffer());
  }

  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  play(id: SoundId): void {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    this.resume();
    const sample = this.samples.get(id);
    if (sample) {
      const src = this.ctx.createBufferSource();
      src.buffer = sample;
      src.connect(this.sfxBus);
      src.start();
      return;
    }
    switch (id) {
      case "shoot_laser":     this.laser(); break;
      case "shoot_missiles":  this.missile(); break;
      case "shoot_plasma":    this.plasma(); break;
      case "shoot_burst":     this.burst(); break;
      case "shoot_railgun":   this.railgunShot(); break;
      case "shoot_flak":      this.flakShot(); break;
      case "explosion_small": this.boom(0.38); break;
      case "explosion_large": this.boom(0.78); break;
      case "enemy_hit":       this.hit(); break;
      case "player_hit":      this.playerHit(); break;
      case "shield_block":    this.shieldBlock(); break;
      case "powerup":         this.powerup(); break;
      case "ui_click":        this.click(); break;
      case "ui_hover":        this.hover(); break;
      case "combo":           this.combo(); break;
      case "boss_phase":      this.bossPhase(); break;
      case "reload":          this.reloadDone(); break;
      case "wave_alert":      this.waveAlert(); break;
      case "level_start":     this.levelStart(); break;
      case "warp":            this.warp(); break;
      case "defeat":          this.defeat(); break;
      case "victory":         this.victory(); break;
      case "menu_back":       this.menuBack(); break;
    }
  }

  playHover(): void {
    const now = performance.now();
    if (now - this.lastHoverAt < 120) return;
    this.lastHoverAt = now;
    this.play("ui_hover");
  }

  /** Música de fondo épica. `menu` = variante suave; `game` = combate completo. */
  startAmbient(variant: MusicVariant = "game"): void {
    if (!this.ctx || !this.musicBus) return;
    this.musicVariant = variant;
    if (this.muted) return;
    this.stopMusicNodes();
    this.resume();
    this.beginMusicLoop();
  }

  stopAmbient(): void {
    this.musicVariant = null;
    this.stopMusicNodes();
  }

  private beginMusicLoop(): void {
    if (!this.ctx || !this.musicBus || !this.musicVariant) return;
    if (this.customMusicBuf) {
      this.startCustomMusicLoop();
      return;
    }
    const ctx = this.ctx;
    this.musicNextLoop = Math.max(ctx.currentTime + 0.08, this.musicNextLoop);
    this.queueProceduralLoop();
  }

  private startCustomMusicLoop(): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.customMusicBuf!;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = this.variantMusicGain();
    src.connect(g);
    g.connect(this.musicBus!);
    src.start();
    this.musicNodes.push(src as unknown as AudioNode & { stop?: () => void }, g);
  }

  private queueProceduralLoop(): void {
    if (!this.ctx || !this.musicVariant) return;
    const variant = this.musicVariant;
    const loopLen = this.loopDuration(variant);
    const start = this.musicNextLoop;
    this.scheduleMusicLoop(start, variant);
    this.musicNextLoop = start + loopLen;
    const ms = Math.max(50, (loopLen - 1.2) * 1000);
    if (this.musicTimeout) clearTimeout(this.musicTimeout);
    this.musicTimeout = setTimeout(() => this.queueProceduralLoop(), ms);
  }

  private stopMusicNodes(): void {
    if (this.musicTimeout) {
      clearTimeout(this.musicTimeout);
      this.musicTimeout = null;
    }
    for (const n of this.musicNodes) {
      try { n.stop?.(); } catch { /* already stopped */ }
      try { n.disconnect(); } catch { /* already disconnected */ }
    }
    this.musicNodes = [];
  }

  private loopDuration(variant: MusicVariant): number {
    const bpm = variant === "menu" ? 76 : 94;
    const bars = variant === "menu" ? 4 : 8;
    return bars * 4 * (60 / bpm);
  }

  private variantMusicGain(): number {
    const base = this.musicVariant === "menu" ? 0.55 : 1;
    return this.musicVolume * base;
  }

  private scheduleMusicLoop(start: number, variant: MusicVariant): void {
    const ctx = this.ctx!;
    const bus = this.musicBus!;
    const bpm = variant === "menu" ? 76 : 94;
    const beat = 60 / bpm;
    const bar = 4 * beat;
    const bars = variant === "menu" ? 4 : 8;
    const vol = this.variantMusicGain();

    const loopFilter = ctx.createBiquadFilter();
    loopFilter.type = "lowpass";
    loopFilter.frequency.value = variant === "menu" ? 2200 : 4800;
    const loopGain = ctx.createGain();
    loopGain.gain.value = vol;
    loopFilter.connect(loopGain);
    loopGain.connect(bus);
    this.musicNodes.push(loopFilter, loopGain);

    for (let barIdx = 0; barIdx < bars; barIdx++) {
      const barStart = start + barIdx * bar;
      const chord = barIdx % 4;
      const roots = CHORD_ROOTS[chord];
      const tones = CHORD_TONES[chord];

      // Pad épico
      for (const freq of tones) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "sawtooth";
        o.frequency.value = freq;
        o.detune.value = (Math.random() - 0.5) * 14;
        g.gain.setValueAtTime(0, barStart);
        g.gain.linearRampToValueAtTime(0.045 * vol, barStart + 0.35);
        g.gain.setValueAtTime(0.038 * vol, barStart + bar - 0.2);
        g.gain.linearRampToValueAtTime(0, barStart + bar);
        o.connect(g);
        g.connect(loopFilter);
        o.start(barStart);
        o.stop(barStart + bar + 0.02);
      }

      // Bajo pulsante
      const bass = ctx.createOscillator();
      const bassG = ctx.createGain();
      bass.type = variant === "menu" ? "sine" : "square";
      bass.frequency.value = roots;
      bassG.gain.setValueAtTime(0, barStart);
      bassG.gain.linearRampToValueAtTime(0.12 * vol, barStart + 0.04);
      bassG.gain.exponentialRampToValueAtTime(0.04 * vol, barStart + beat * 0.9);
      bassG.gain.exponentialRampToValueAtTime(0.0001, barStart + beat * 1.8);
      bass.connect(bassG);
      bassG.connect(loopFilter);
      bass.start(barStart);
      bass.stop(barStart + beat * 2);

      if (variant === "game") {
        // Bombo 1 y 3
        for (const beatOff of [0, 2]) {
          this.scheduleKick(barStart + beatOff * beat, vol * 0.9, loopFilter);
        }
        // Caja 2 y 4
        this.scheduleSnare(barStart + beat, vol * 0.55, loopFilter);
        this.scheduleSnare(barStart + 3 * beat, vol * 0.5, loopFilter);
        // Hi-hats
        for (let h = 0; h < 8; h++) {
          this.scheduleHat(barStart + h * beat * 0.5, vol * 0.14, loopFilter);
        }
        // Arpegio heroico (16 avos)
        for (let s = 0; s < 16; s++) {
          const t = barStart + s * (beat / 4);
          const note = ARP_SCALE[(barIdx * 5 + s) % ARP_SCALE.length];
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          o.frequency.value = note;
          g.gain.setValueAtTime(0.055 * vol, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 0.22);
          o.connect(g);
          g.connect(loopFilter);
          o.start(t);
          o.stop(t + beat * 0.25);
        }
      } else {
        this.scheduleKick(barStart, vol * 0.35, loopFilter);
      }
    }

    // Drone espacial (continuo entre loops — solo un par de osciladores globales)
    if (this.musicNodes.length <= 2) {
      const droneG = ctx.createGain();
      droneG.gain.value = 0.022 * vol;
      droneG.connect(bus);
      for (const freq of [55, 57.4]) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = freq;
        o.connect(droneG);
        o.start();
        this.musicNodes.push(o as unknown as AudioNode & { stop?: () => void });
      }
      this.musicNodes.push(droneG);
    }
  }

  private scheduleKick(t: number, vol: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.1);
    g.gain.setValueAtTime(0.5 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + 0.15);
    this.noiseBurstAt(t, 0.04, 0.18 * vol, 900, dest);
  }

  private scheduleSnare(t: number, vol: number, dest: AudioNode): void {
    this.noiseBurstAt(t, 0.09, vol, 2400, dest);
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.07);
    g.gain.setValueAtTime(0.25 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + 0.11);
  }

  private scheduleHat(t: number, vol: number, dest: AudioNode): void {
    this.noiseBurstAt(t, 0.025, vol, 8000, dest, "highpass");
  }

  private loadPrefs(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { muted?: boolean; volume?: number; musicVolume?: number };
      if (typeof p.muted === "boolean") this.muted = p.muted;
      if (typeof p.volume === "number") this.volume = Math.max(0, Math.min(1, p.volume));
      if (typeof p.musicVolume === "number") this.musicVolume = Math.max(0, Math.min(1, p.musicVolume));
    } catch { /* ignore */ }
  }

  private savePrefs(): void {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ muted: this.muted, volume: this.volume, musicVolume: this.musicVolume }),
      );
    } catch { /* ignore */ }
  }

  private applyMasterGain(): void {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : this.volume;
  }

  private applyMusicGain(): void {
    if (!this.musicBus) return;
    this.musicBus.gain.value = this.muted ? 0 : 1;
  }

  // ─── helpers SFX ─────────────────────────────────────────────────────────────

  private get sfx(): GainNode {
    return this.sfxBus!;
  }

  private ramp(o: OscillatorNode, g: GainNode, dur: number): void {
    const ctx = this.ctx!;
    o.connect(g);
    g.connect(this.sfx);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + dur + 0.02);
  }

  private noiseBurstAt(
    t: number,
    dur: number,
    peak: number,
    filtFreq: number,
    dest: AudioNode,
    filtType: BiquadFilterType = "lowpass",
  ): void {
    const ctx = this.ctx!;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.22));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = filtType;
    filt.frequency.value = filtFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(dest);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  private noiseBurst(dur: number, peak: number, filtFreq: number, filtType: BiquadFilterType = "lowpass"): void {
    this.noiseBurstAt(this.ctx!.currentTime, dur, peak, filtFreq, this.sfx, filtType);
  }

  private transientClick(freq: number, peak: number, dur = 0.025): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * 0.4, t + dur);
    g.gain.setValueAtTime(peak, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + dur + 0.01);
    this.noiseBurst(dur * 0.8, peak * 0.45, freq * 2.2, "highpass");
  }

  // ─── sintetizadores (SFX más llamativos) ─────────────────────────────────────

  private laser(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.transientClick(2400, 0.12, 0.02);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(2100, t);
    o.frequency.exponentialRampToValueAtTime(280, t + 0.1);
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    this.ramp(o, g, 0.1);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "square";
    o2.detune.value = -18;
    o2.frequency.setValueAtTime(2100, t);
    o2.frequency.exponentialRampToValueAtTime(400, t + 0.08);
    g2.gain.setValueAtTime(0.06, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    this.ramp(o2, g2, 0.08);
  }

  private missile(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.noiseBurst(0.05, 0.2, 600);
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.32);
    f.type = "lowpass";
    f.frequency.setValueAtTime(900, t);
    f.frequency.exponentialRampToValueAtTime(180, t + 0.32);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(f);
    f.connect(g);
    g.connect(this.sfx);
    o.start(t);
    o.stop(t + 0.34);
  }

  private plasma(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.noiseBurst(0.08, 0.15, 1200, "bandpass");
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.58);
    g.gain.setValueAtTime(0.34, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.58);
    this.ramp(o, g, 0.58);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "triangle";
    o2.frequency.setValueAtTime(280, t);
    o2.frequency.exponentialRampToValueAtTime(70, t + 0.4);
    g2.gain.setValueAtTime(0.1, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    this.ramp(o2, g2, 0.4);
  }

  private burst(): void {
    const ctx = this.ctx!;
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.042;
      this.transientClick(1100 + Math.random() * 300, 0.09, 0.03);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(950 + Math.random() * 280, t);
      o.frequency.exponentialRampToValueAtTime(320, t + 0.075);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.08);
    }
  }

  private railgunShot(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.noiseBurst(0.06, 0.35, 4000, "highpass");
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(2800, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.26);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    this.ramp(o, g, 0.26);
  }

  private flakShot(): void {
    const ctx = this.ctx!;
    for (let i = 0; i < 4; i++) {
      const t = ctx.currentTime + i * 0.018;
      this.noiseBurstAt(t, 0.04, 0.14, 2000 + Math.random() * 800, this.sfx, "bandpass");
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(480 + Math.random() * 120, t);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.06);
    }
  }

  private boom(intensity: number): void {
    const ctx = this.ctx!;
    const dur = 0.28 + intensity * 0.6;
    const t = ctx.currentTime;

    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.2));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.setValueAtTime(220 + intensity * 900, t);
    filt.frequency.exponentialRampToValueAtTime(80, t + dur);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(intensity * 1.05, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filt);
    filt.connect(ng);
    ng.connect(this.sfx);
    src.start(t);

    this.noiseBurstAt(t, 0.06, 0.5 * intensity, 6000, this.sfx, "highpass");

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(110 * intensity, t);
    o.frequency.exponentialRampToValueAtTime(14, t + dur);
    g.gain.setValueAtTime(intensity * 0.72, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    this.ramp(o, g, dur);

    const crack = ctx.createOscillator();
    const cg = ctx.createGain();
    crack.type = "square";
    crack.frequency.setValueAtTime(70 + intensity * 40, t);
    crack.frequency.exponentialRampToValueAtTime(22, t + dur * 0.5);
    cg.gain.setValueAtTime(intensity * 0.22, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.5);
    this.ramp(crack, cg, dur * 0.5);
  }

  private hit(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.noiseBurst(0.04, 0.2, 3500, "highpass");
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(680, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.08);
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    this.ramp(o, g, 0.08);
  }

  private playerHit(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.noiseBurst(0.12, 0.35, 500);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(200, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.52);
    g.gain.setValueAtTime(0.52, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
    this.ramp(o, g, 0.52);
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "square";
    o2.detune.value = 25;
    o2.frequency.setValueAtTime(90, t);
    g2.gain.setValueAtTime(0.18, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    this.ramp(o2, g2, 0.35);
  }

  private shieldBlock(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.transientClick(1200, 0.14, 0.04);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(1040, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.18);
    g.gain.setValueAtTime(0.26, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    this.ramp(o, g, 0.18);
  }

  private powerup(): void {
    const ctx = this.ctx!;
    for (const [i, freq] of [440, 554, 659, 880, 1108].entries()) {
      const t = ctx.currentTime + i * 0.07;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.18, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.15);
      if (i === 4) this.noiseBurstAt(t, 0.08, 0.12, 6000, this.sfx, "highpass");
    }
  }

  private click(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.transientClick(1100, 0.11, 0.05);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(980, t);
    o.frequency.exponentialRampToValueAtTime(420, t + 0.07);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    this.ramp(o, g, 0.07);
  }

  private hover(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 720;
    g.gain.setValueAtTime(0.045, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    this.ramp(o, g, 0.035);
  }

  private combo(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const det of [-12, 0, 12]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.detune.value = det;
      o.frequency.setValueAtTime(660, t);
      o.frequency.exponentialRampToValueAtTime(1580, t + 0.24);
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.27);
    }
    this.noiseBurst(0.05, 0.1, 5000, "highpass");
  }

  private bossPhase(): void {
    const ctx = this.ctx!;
    for (const [i, freq] of [80, 120, 170, 220].entries()) {
      const t = ctx.currentTime + i * 0.14;
      this.noiseBurstAt(t, 0.08, 0.2, 400, this.sfx);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.38, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.46);
    }
  }

  private reloadDone(): void {
    const ctx = this.ctx!;
    for (const [i, freq] of [330, 440, 554].entries()) {
      const t = ctx.currentTime + i * 0.075;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "triangle";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.12);
    }
  }

  private waveAlert(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const st = t + i * 0.2;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(240, st);
      o.frequency.exponentialRampToValueAtTime(620, st + 0.32);
      g.gain.setValueAtTime(0.16, st);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.32);
      o.connect(g);
      g.connect(this.sfx);
      o.start(st);
      o.stop(st + 0.33);
    }
    this.noiseBurst(0.1, 0.12, 800);
  }

  private levelStart(): void {
    const ctx = this.ctx!;
    const notes = [220, 330, 440, 554, 659];
    for (const [i, freq] of notes.entries()) {
      const t = ctx.currentTime + i * 0.1;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.2, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.23);
    }
  }

  private warp(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    this.noiseBurst(0.4, 0.15, 2000, "bandpass");
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.95);
    g.gain.setValueAtTime(0.1, t);
    g.gain.linearRampToValueAtTime(0.28, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    this.ramp(o, g, 1);
  }

  private defeat(): void {
    const ctx = this.ctx!;
    for (const [i, freq] of [220, 165, 110, 82].entries()) {
      const t = ctx.currentTime + i * 0.2;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.56);
    }
  }

  private victory(): void {
    const ctx = this.ctx!;
    const notes = [523, 659, 784, 1047, 1318];
    for (const [i, freq] of notes.entries()) {
      const t = ctx.currentTime + i * 0.12;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.22, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      o.connect(g);
      g.connect(this.sfx);
      o.start(t);
      o.stop(t + 0.39);
    }
  }

  private menuBack(): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(560, t);
    o.frequency.exponentialRampToValueAtTime(240, t + 0.14);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    this.ramp(o, g, 0.14);
  }
}

export const soundManager = new SoundManager();

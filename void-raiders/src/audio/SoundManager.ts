// Motor de audio procedural — Web Audio API, sin archivos externos

export type SoundId =
  | 'shoot_laser'
  | 'shoot_missiles'
  | 'shoot_plasma'
  | 'shoot_burst'
  | 'explosion_small'
  | 'explosion_large'
  | 'enemy_hit'
  | 'player_hit'
  | 'powerup'
  | 'ui_click'
  | 'combo'
  | 'boss_phase';

export class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambientNodes: (AudioNode & { stop?: () => void })[] = [];
  private ready = false;

  init(): void {
    if (this.ready) return;
    this.ready = true;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  play(id: SoundId): void {
    if (!this.ctx || !this.master) return;
    this.resume();
    switch (id) {
      case 'shoot_laser':     this.laser(); break;
      case 'shoot_missiles':  this.missile(); break;
      case 'shoot_plasma':    this.plasma(); break;
      case 'shoot_burst':     this.burst(); break;
      case 'explosion_small': this.boom(0.38); break;
      case 'explosion_large': this.boom(0.78); break;
      case 'enemy_hit':       this.hit(); break;
      case 'player_hit':      this.playerHit(); break;
      case 'powerup':         this.powerup(); break;
      case 'ui_click':        this.click(); break;
      case 'combo':           this.combo(); break;
      case 'boss_phase':      this.bossPhase(); break;
    }
  }

  startAmbient(): void {
    if (!this.ctx || !this.master || this.ambientNodes.length > 0) return;
    this.resume();

    const g = this.ctx.createGain();
    g.gain.value = 0.05;
    g.connect(this.master);

    // Deep space drone: dos sinuosoides levemente desafinadas (efecto batido)
    for (const freq of [55, 57.4]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(g);
      o.start();
      this.ambientNodes.push(o as unknown as AudioNode & { stop?: () => void });
    }

    // LFO muy lento que pulsa el volumen como respiración cósmica
    const lfo = this.ctx.createOscillator();
    const lg = this.ctx.createGain();
    lfo.frequency.value = 0.065;
    lg.gain.value = 0.03;
    lfo.connect(lg);
    lg.connect(g.gain);
    lfo.start();
    this.ambientNodes.push(lfo as unknown as AudioNode & { stop?: () => void }, g, lg);
  }

  stopAmbient(): void {
    for (const n of this.ambientNodes) {
      try { n.stop?.(); } catch { /* already stopped */ }
      try { n.disconnect(); } catch { /* already disconnected */ }
    }
    this.ambientNodes = [];
  }

  // ─── sintetizadores ──────────────────────────────────────────────────────────

  private ramp(o: OscillatorNode, g: GainNode, dur: number): void {
    const ctx = this.ctx!;
    o.connect(g);
    g.connect(this.master!);
    o.start(ctx.currentTime);
    o.stop(ctx.currentTime + dur + 0.02);
  }

  private laser(): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(1700, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(350, ctx.currentTime + 0.09);
    g.gain.setValueAtTime(0.16, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    this.ramp(o, g, 0.09);
  }

  private missile(): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(260, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(65, ctx.currentTime + 0.28);
    f.type = 'lowpass';
    f.frequency.value = 480;
    g.gain.setValueAtTime(0.19, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    o.connect(f); f.connect(g); g.connect(this.master!);
    o.start(); o.stop(ctx.currentTime + 0.3);
  }

  private plasma(): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(110, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.55);
    g.gain.setValueAtTime(0.26, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.55);
    this.ramp(o, g, 0.55);
  }

  private burst(): void {
    const ctx = this.ctx!;
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 0.048;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(850 + Math.random() * 220, t);
      o.frequency.exponentialRampToValueAtTime(380, t + 0.07);
      g.gain.setValueAtTime(0.08, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g); g.connect(this.master!);
      o.start(t); o.stop(t + 0.08);
    }
  }

  private boom(intensity: number): void {
    const ctx = this.ctx!;
    const dur = 0.25 + intensity * 0.55;

    // ruido percusivo con sobre-envolvente
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.25));
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 180 + intensity * 650;
    const ng = ctx.createGain();
    ng.gain.value = intensity * 0.85;
    src.connect(filt); filt.connect(ng); ng.connect(this.master!);
    src.start();

    // golpe de bajo
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(85 * intensity, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(16, ctx.currentTime + dur);
    g.gain.setValueAtTime(intensity * 0.55, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    this.ramp(o, g, dur);
  }

  private hit(): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(520, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(210, ctx.currentTime + 0.07);
    g.gain.setValueAtTime(0.07, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.07);
    this.ramp(o, g, 0.07);
  }

  private playerHit(): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(160, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.48);
    g.gain.setValueAtTime(0.42, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.48);
    this.ramp(o, g, 0.48);
  }

  private powerup(): void {
    const ctx = this.ctx!;
    for (const [i, freq] of [440, 554, 659, 880].entries()) {
      const t = ctx.currentTime + i * 0.075;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.13, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g); g.connect(this.master!);
      o.start(t); o.stop(t + 0.14);
    }
  }

  private click(): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(900, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(450, ctx.currentTime + 0.06);
    g.gain.setValueAtTime(0.09, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.06);
    this.ramp(o, g, 0.06);
  }

  private combo(): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(660, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.2);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    this.ramp(o, g, 0.22);
  }

  private bossPhase(): void {
    const ctx = this.ctx!;
    for (const [i, freq] of [80, 120, 170].entries()) {
      const t = ctx.currentTime + i * 0.16;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.28, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
      o.connect(g); g.connect(this.master!);
      o.start(t); o.stop(t + 0.43);
    }
  }
}

export const soundManager = new SoundManager();

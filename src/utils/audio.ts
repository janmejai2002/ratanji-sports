/**
 * WebAudio Tactile Micro-Haptics & Sound FX Synthesizer
 * Pure browser audio synthesis with ZERO external assets.
 * Ultra-low latency, sunlight/stadium volume-boosted, and physically haptic.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private initCtx() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /**
   * Crisp micro-click for buttons and tabs
   */
  public playClick(freq = 900) {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.03);

      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.03);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.03);
    } catch {}

    this.haptic([10]);
  }

  /**
   * Referee Whistle Burst (Dual-tone oscillating trill)
   */
  public playWhistle() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'triangle';
      osc2.type = 'sine';

      // Trill modulation
      osc1.frequency.setValueAtTime(2600, t);
      osc1.frequency.linearRampToValueAtTime(2850, t + 0.08);
      osc1.frequency.linearRampToValueAtTime(2600, t + 0.16);
      osc1.frequency.linearRampToValueAtTime(2850, t + 0.24);

      osc2.frequency.setValueAtTime(2900, t);
      osc2.frequency.linearRampToValueAtTime(3100, t + 0.1);
      osc2.frequency.linearRampToValueAtTime(2900, t + 0.22);

      gain.gain.setValueAtTime(0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.35);
      osc2.stop(t + 0.35);
    } catch {}

    this.haptic([25, 40, 25]);
  }

  /**
   * Stadium Goal Horn (Deep brass harmonic blast)
   */
  public playGoalHorn() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(140, t);
      osc1.frequency.exponentialRampToValueAtTime(120, t + 0.6);

      osc2.frequency.setValueAtTime(210, t);
      osc2.frequency.exponentialRampToValueAtTime(180, t + 0.6);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.7);
      osc2.stop(t + 0.7);
    } catch {}

    this.haptic([50, 60, 80]);
  }

  /**
   * Crowd Roar / Batch Hype burst (Synthesized filtered noise)
   */
  public playCheer() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const bufferSize = this.ctx.sampleRate * 0.5;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      filter.Q.setValueAtTime(1.5, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.3, this.ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start();
      noise.stop(this.ctx.currentTime + 0.5);
    } catch {}

    this.haptic([15, 30, 45]);
  }

  /**
   * Referee Match End Buzzer
   */
  public playBuzzer() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(180, t);

      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    } catch {}

    this.haptic([60, 40]);
  }

  /**
   * Mario Kart / Arcade Coin Chime (Ascending dual-tone sine pair)
   */
  public playArcadeCoin() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(987.77, t); // B5

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1318.51, t + 0.06); // E6

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(t);
      osc1.stop(t + 0.08);
      osc2.start(t + 0.06);
      osc2.stop(t + 0.3);
    } catch {}

    this.haptic([15, 20]);
  }

  /**
   * Mario Kart 3-2-1-GO Countdown chime
   */
  public playCountdownGo() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      // 3 short beeps followed by high GO chord
      [0, 0.4, 0.8].forEach((offset) => {
        const osc = this.ctx!.createOscillator();
        const g = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, t + offset);
        g.gain.setValueAtTime(0.2, t + offset);
        g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.12);
        osc.connect(g);
        g.connect(this.ctx!.destination);
        osc.start(t + offset);
        osc.stop(t + offset + 0.12);
      });

      // Big GO tone at 1.2s
      const goOsc = this.ctx.createOscillator();
      const goG = this.ctx.createGain();
      goOsc.type = 'triangle';
      goOsc.frequency.setValueAtTime(880, t + 1.2);
      goG.gain.setValueAtTime(0.35, t + 1.2);
      goG.gain.exponentialRampToValueAtTime(0.001, t + 1.6);
      goOsc.connect(goG);
      goG.connect(this.ctx.destination);
      goOsc.start(t + 1.2);
      goOsc.stop(t + 1.6);
    } catch {}

    this.haptic([30, 30, 30, 100]);
  }

  /**
   * Turbo Whoosh (High kinetic speed burst)
   */
  public playTurboBoost() {
    if (!this.enabled) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, t);
      osc.frequency.exponentialRampToValueAtTime(1400, t + 0.25);

      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    } catch {}

    this.haptic([20, 40]);
  }

  /**
   * Device physical vibration
   */
  public haptic(pattern: number[] = [15]) {
    if (typeof window !== 'undefined' && 'navigator' in window && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch {}
    }
  }
}

export const sounds = new SoundEngine();

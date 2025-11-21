
export class AudioController {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private isMuted: boolean = false;
  private bgmVolume: number = 0.2;
  private sfxVolume: number = 0.2;
  private bgmInterval: NodeJS.Timeout | null = null;
  private kickInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Lazy initialization
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = (window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = this.bgmVolume;

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxVolume;

    this.bgmGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    
    // Compressor to glue sounds together like a mix
    const compressor = this.ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 12;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    this.masterGain.connect(compressor);
    compressor.connect(this.ctx.destination);
  }

  setBgmVolume(val: number) {
    this.bgmVolume = Math.max(0, Math.min(1, val));
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(this.bgmVolume, this.ctx.currentTime, 0.1);
    }
  }

  setSfxVolume(val: number) {
    this.sfxVolume = Math.max(0, Math.min(1, val));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.1);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.masterGain) {
      const target = this.isMuted ? 0 : 1.0;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    }
    return this.isMuted;
  }

  // --- Cyberpunk Synthwave BGM ---
  startBgm() {
    if (!this.ctx) this.init();
    if (!this.ctx || this.bgmInterval) return;
    
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const tempo = 110; // Faster tempo
    const beatTime = 60 / tempo; 

    // 1. Bass Drone / Arp
    const playBass = () => {
      if (!this.ctx || !this.bgmGain) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      // Sawtooth for gritty cyberpunk bass
      osc.type = 'sawtooth'; 
      // Progression: C#1 -> A0 -> E1 -> B0
      const notes = [34.65, 27.50, 41.20, 30.87]; 
      const randomIndex = Math.floor(Math.random() * notes.length);
      const note: number = notes[randomIndex];
      
      osc.frequency.setValueAtTime(note, t);
      
      // Lowpass filter with envelope for "Wow" sound
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 5;
      filter.frequency.setValueAtTime(100, t);
      filter.frequency.exponentialRampToValueAtTime(800, t + 0.2);
      filter.frequency.exponentialRampToValueAtTime(100, t + 0.5);

      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 2.0); // Long decay

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.bgmGain);

      osc.start(t);
      osc.stop(t + 2.5);
    };

    // 2. Digital Kick Drum (The Heartbeat)
    const playKick = () => {
      if (!this.ctx || !this.bgmGain) return;
      const t = this.ctx.currentTime;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(0.01, t + 0.5);

      gain.gain.setValueAtTime(0.8, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

      osc.connect(gain);
      gain.connect(this.bgmGain);
      
      osc.start(t);
      osc.stop(t + 0.5);
    };

    // Loopers
    playBass();
    this.bgmInterval = setInterval(() => playBass(), beatTime * 4000); // Bass every measure
    
    this.kickInterval = setInterval(() => {
       playKick();
    }, beatTime * 1000); // Kick every beat
  }

  stopBgm() {
    if (this.bgmInterval) clearInterval(this.bgmInterval);
    if (this.kickInterval) clearInterval(this.kickInterval);
    this.bgmInterval = null;
    this.kickInterval = null;
  }

  // --- Enhanced SFX ---

  private playTone(freqStart: number, freqEnd: number, duration: number, type: OscillatorType = 'sine', vol: number = 0.1, distortion = false) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    if (distortion) {
        const shaper = this.ctx.createWaveShaper();
        shaper.curve = this.makeDistortionCurve(400);
        shaper.oversample = '4x';
        osc.connect(shaper);
        shaper.connect(gain);
    } else {
        osc.connect(gain);
    }
    
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  // Distortion curve for gritty sounds
  private makeDistortionCurve(amount: number) {
    const k: number = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  private playNoise(duration: number, vol: number = 0.1, filterFreq = 1000) {
    if (!this.ctx || !this.sfxGain || this.isMuted) return;
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, this.ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + duration);

    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    noise.start();
  }

  playWeaponAttack(id: string) {
    if (this.isMuted) return;
    switch (id) {
      case 'missile':
        // High tech laser chirp
        this.playTone(800, 100, 0.15, 'sawtooth', 0.1);
        break;
      case 'shotgun':
        // Distorted blast
        this.playNoise(0.3, 0.2, 800);
        this.playTone(150, 50, 0.2, 'square', 0.15, true);
        break;
      case 'crossbow':
        // Metallic kinetic release
        this.playTone(1200, 2000, 0.1, 'square', 0.05);
        this.playNoise(0.1, 0.05, 5000);
        break;
      case 'lightning':
        // High voltage zaps
        this.playNoise(0.2, 0.15, 3000);
        this.playTone(2000, 100, 0.2, 'sawtooth', 0.05);
        break;
      case 'mines':
        // Digital arming beep
        this.playTone(1500, 1500, 0.05, 'sine', 0.05);
        break;
      case 'mine_explode':
        // Heavy explosion
        this.playNoise(0.5, 0.3, 500);
        this.playTone(100, 10, 0.5, 'sawtooth', 0.3, true);
        break;
      case 'orbit':
        // Resonant hum
        this.playTone(400, 600, 0.2, 'sine', 0.05);
        break;
      case 'flame':
        // Plasma burn
        this.playNoise(0.15, 0.05, 2000);
        break;
      case 'spitter_charge':
         this.playTone(200, 800, 0.5, 'square', 0.05);
         break;
    }
  }

  playEnemyHit(type: string) {
    if (this.isMuted) return;
    // Digital crunch
    this.playNoise(0.05, 0.05, 3000);
    if (type === 'player') {
       // Glitch sound
       this.playTone(500, 50, 0.3, 'sawtooth', 0.2, true);
    }
  }

  playLevelUp() {
    // Ascending digital chime
    if (this.isMuted) return;
    setTimeout(() => this.playTone(440, 880, 0.2, 'square', 0.15), 0);
    setTimeout(() => this.playTone(554, 1108, 0.2, 'square', 0.15), 100);
    setTimeout(() => this.playTone(659, 1318, 0.4, 'square', 0.15), 200);
  }

  playGameOver() {
    // Power down
    this.playTone(200, 20, 1.5, 'sawtooth', 0.3, true);
  }
}

export const audioController = new AudioController();

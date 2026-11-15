const TYPE_PROFILES = {
  car:        { base: 38, rev: 104, gain: 0.19, lowpass: 820, sub: 0.42 },
  motorcycle: { base: 52, rev: 176, gain: 0.16, lowpass: 1450, sub: 0.18 },
  helicopter: { base: 28, rev: 66, gain: 0.12, lowpass: 980, sub: 0.65 },
  boat:       { base: 30, rev: 78, gain: 0.15, lowpass: 620, sub: 0.72 }
};

/**
 * Small procedural vehicle synthesizer. It uses Web Audio oscillators instead
 * of external copyrighted recordings, so every garage vehicle has sound.
 * Audio starts only after a real user gesture (the game's start button).
 */
export class VehicleAudio {
  constructor({ toggleButton = null } = {}) {
    this.toggleButton = toggleButton;
    this.context = null;
    this.master = null;
    this.engineBus = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.rotorGain = null;
    this.windGain = null;
    this.oscillators = [];
    this.rotorLfo = null;
    this.enabled = true;
    this.vehicleType = 'car';
    this.active = false;
    this.lastThrottle = 0;
    this.lastSpeed = 0;
    this.noiseSource = null;

    if (this.toggleButton) {
      this.toggleButton.addEventListener('click', () => {
        this.setEnabled(!this.enabled);
      });
      this.updateButton();
    }
  }

  ensureAudioGraph() {
    if (this.context) return true;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      if (this.toggleButton) {
        this.toggleButton.disabled = true;
        this.toggleButton.textContent = 'AUDIO UNAVAILABLE';
      }
      return false;
    }

    this.context = new AudioContextClass();
    const ctx = this.context;

    this.master = ctx.createGain();
    this.master.gain.value = this.enabled ? 0.48 : 0;
    this.master.connect(ctx.destination);

    this.engineBus = ctx.createGain();
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 820;
    this.engineFilter.Q.value = 0.7;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineBus.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);

    // A fundamental, a slightly detuned harmonic and a low mechanical pulse.
    const oscillatorSpecs = [
      { type: 'sawtooth', frequency: 38, gain: 0.30 },
      { type: 'square', frequency: 76.7, gain: 0.075 },
      { type: 'sine', frequency: 19, gain: 0.50 }
    ];
    for (const spec of oscillatorSpecs) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = spec.type;
      oscillator.frequency.value = spec.frequency;
      gain.gain.value = spec.gain;
      oscillator.connect(gain);
      gain.connect(this.engineBus);
      oscillator.start();
      this.oscillators.push({ oscillator, gain });
    }

    // Helicopter blade beat: an LFO gently modulates a dedicated rotor tone.
    const rotorOscillator = ctx.createOscillator();
    rotorOscillator.type = 'sawtooth';
    rotorOscillator.frequency.value = 34;
    const rotorToneGain = ctx.createGain();
    rotorToneGain.gain.value = 0.13;
    rotorOscillator.connect(rotorToneGain);
    rotorToneGain.connect(this.engineBus);
    rotorOscillator.start();

    this.rotorGain = ctx.createGain();
    this.rotorGain.gain.value = 0;
    rotorToneGain.disconnect();
    rotorToneGain.connect(this.rotorGain);
    this.rotorGain.connect(this.engineFilter);

    this.rotorLfo = ctx.createOscillator();
    this.rotorLfo.type = 'square';
    this.rotorLfo.frequency.value = 18;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.045;
    this.rotorLfo.connect(lfoDepth);
    lfoDepth.connect(this.rotorGain.gain);
    this.rotorLfo.start();

    // Soft broadband airflow grows with speed, but stays quiet under the engine.
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * 2));
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const channel = noiseBuffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = (Math.random() * 2 - 1) * 0.18;
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 680;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.noiseSource.connect(windFilter);
    windFilter.connect(this.windGain);
    this.windGain.connect(this.master);
    this.noiseSource.start();

    return true;
  }

  async start() {
    if (!this.ensureAudioGraph()) return false;
    if (this.context.state !== 'running') {
      try { await this.context.resume(); } catch { return false; }
    }
    this.active = true;
    this.applyProfile();
    return true;
  }

  async resume() {
    if (!this.ensureAudioGraph()) return false;
    if (this.context.state !== 'running') {
      try { await this.context.resume(); } catch { return false; }
    }
    return true;
  }

  setVehicleType(type = 'car') {
    const next = Object.hasOwn(TYPE_PROFILES, type) ? type : 'car';
    if (this.vehicleType === next) return;
    this.vehicleType = next;
    this.applyProfile();
  }

  applyProfile() {
    if (!this.context || !this.engineFilter) return;
    const profile = TYPE_PROFILES[this.vehicleType];
    const now = this.context.currentTime;
    this.engineFilter.frequency.setTargetAtTime(profile.lowpass, now, 0.16);
    this.oscillators[2]?.gain.gain.setTargetAtTime(profile.sub, now, 0.16);
    this.rotorGain?.gain.setTargetAtTime(this.vehicleType === 'helicopter' ? 0.2 : 0, now, 0.2);
    if (this.rotorLfo) this.rotorLfo.frequency.setTargetAtTime(
      this.vehicleType === 'helicopter' ? 21 : 1,
      now,
      0.2
    );
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(this.enabled ? 0.48 : 0, this.context.currentTime, 0.06);
    }
    this.updateButton();
  }

  updateButton() {
    if (!this.toggleButton) return;
    this.toggleButton.textContent = this.enabled ? 'SOUND ON' : 'SOUND OFF';
    this.toggleButton.setAttribute('aria-pressed', String(this.enabled));
  }

  update({ speed = 0, throttle = 0, active = true, nitro = false } = {}) {
    if (!this.context || this.context.state !== 'running') return;
    const ctx = this.context;
    const profile = TYPE_PROFILES[this.vehicleType];
    const velocity = Math.max(0, Math.abs(Number(speed) || 0));
    const load = Math.max(0, Math.min(1, Math.abs(Number(throttle) || 0)));
    const rpm = profile.base + Math.min(profile.rev, velocity * (this.vehicleType === 'motorcycle' ? 5.3 : 2.4))
      + load * (this.vehicleType === 'motorcycle' ? 42 : 28)
      + (nitro ? 12 : 0);
    const now = ctx.currentTime;
    const audible = this.enabled && active;
    this.oscillators[0]?.oscillator.frequency.setTargetAtTime(rpm, now, 0.08);
    this.oscillators[1]?.oscillator.frequency.setTargetAtTime(rpm * 2.015, now, 0.08);
    this.oscillators[2]?.oscillator.frequency.setTargetAtTime(Math.max(14, rpm * 0.48), now, 0.12);
    const volume = audible ? profile.gain * (0.42 + load * 0.62 + Math.min(0.35, velocity / 55)) : 0;
    this.engineGain.gain.setTargetAtTime(volume, now, 0.09);
    const rotorVolume = audible && this.vehicleType === 'helicopter' ? 0.18 : 0;
    this.rotorGain.gain.setTargetAtTime(rotorVolume, now, 0.14);
    this.windGain.gain.setTargetAtTime(audible ? Math.min(0.055, velocity * 0.0022) : 0, now, 0.2);
  }

  dispose() {
    if (!this.context) return;
    for (const { oscillator } of this.oscillators) {
      try { oscillator.stop(); } catch {}
    }
    try { this.rotorLfo?.stop(); this.noiseSource?.stop(); } catch {}
    this.context.close().catch(() => {});
    this.context = null;
  }
}

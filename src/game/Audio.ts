import { clamp, damp } from './math';
import type { Event, Simulation } from './Simulation';

// Recorded CC0 foley and wind over original sub pressure and sand synthesis.
// Everything is bundled locally and routed through a limiter. See public/audio/CREDITS.md.
export class Sound {
  context?: AudioContext;
  master?: GainNode; wind?: GainNode; rumble?: GainNode; filter?: BiquadFilterNode;
  private music?: GainNode; private rhythm = 0; private heartbeat = 0; private markerPhases = new Map<number, number>();
  private recordings = new Map<string, AudioBuffer>();
  private recordingsLoading?: Promise<void>; private lastDebris = -1;
  private noise?: AudioBuffer; private volume = .65; private active = false;
  async start() {
    if (!this.context) {
      const ctx = this.context = new AudioContext();
      const master = this.master = ctx.createGain(); master.gain.value = this.volume * .55;
      const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -16; limiter.knee.value = 12; limiter.ratio.value = 8;
      master.connect(limiter); limiter.connect(ctx.destination);
      const buffer = this.noise = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      const data = buffer.getChannelData(0); let last = 0;
      for (let i = 0; i < data.length; i++) { last = (last + (Math.random() * 2 - 1) * .025) / 1.025; data[i] = last * 8; }
      const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
      this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.frequency.value = 800;
      const wind = this.wind = ctx.createGain(); wind.gain.value = .06;
      source.connect(this.filter); this.filter.connect(wind); wind.connect(master); source.start();
      const osc = ctx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 39;
      const rumble = this.rumble = ctx.createGain(); rumble.gain.value = 0; osc.connect(rumble); rumble.connect(master); osc.start();
      const music = this.music = ctx.createGain(); music.gain.value = 0;
      const velvet = ctx.createBiquadFilter(); velvet.type = 'lowpass'; velvet.frequency.value = 320;
      music.connect(velvet); velvet.connect(master);
      for (const [i, frequency] of [73.416, 87.307, 110].entries()) {
        const voice = ctx.createOscillator(), level = ctx.createGain(); voice.type = 'triangle'; voice.frequency.value = frequency;
        voice.detune.value = (i - 1) * 5; level.gain.value = .2; voice.connect(level); level.connect(music); voice.start();
      }
    }
    await this.context.resume(); this.active = true;
    this.recordingsLoading ??= this.loadRecordings(this.context);
    void this.recordingsLoading;
  }
  private async loadRecordings(ctx: AudioContext) {
    await Promise.all(['desert-wind', 'chitin-crunch', 'rock-fall'].map(async name => {
      try {
        const response = await fetch(`/audio/${name}.ogg`);
        if (!response.ok) return;
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer()); this.recordings.set(name, buffer);
        if (name === 'desert-wind' && this.filter) {
          const source = ctx.createBufferSource(), level = ctx.createGain();
          source.buffer = buffer; source.loop = true; level.gain.value = 2.4;
          source.connect(level); level.connect(this.filter); source.start();
        }
      } catch { /* The original sound bed remains available if media decoding fails. */ }
    }));
  }
  private sample(name: string, gain: number, rate: number, lowpass = 9000) {
    const ctx = this.context, buffer = this.recordings.get(name);
    if (!ctx || !buffer || !this.master) return;
    const source = ctx.createBufferSource(), level = ctx.createGain(), filter = ctx.createBiquadFilter();
    source.buffer = buffer; source.playbackRate.value = rate;
    filter.type = 'lowpass'; filter.frequency.value = lowpass; level.gain.value = gain;
    source.connect(filter); filter.connect(level); level.connect(this.master); source.start();
  }
  setVolume(v: number) { this.volume = v; if (this.master && this.context) this.master.gain.setTargetAtTime(v * .55, this.context.currentTime, .1); }
  pause(paused: boolean) { this.active = !paused; }
  update(sim: Simulation, dt: number) {
    if (!this.context || !this.wind || !this.rumble || !this.filter) return;
    const now = this.context.currentTime;
    const wind = this.active ? .035 + sim.speed / 400 + (sim.state === 'air' ? .1 : 0) : .025;
    this.wind.gain.value = damp(this.wind.gain.value, wind, 3, dt);
    this.rumble.gain.value = damp(this.rumble.gain.value, this.active && sim.state !== 'air' ? .07 + sim.speed * .002 : .015, 4, dt);
    this.filter.frequency.setTargetAtTime(sim.deep ? 220 : sim.state === 'air' ? 3000 : 1000, now, .2);
    const hunting = this.active && sim.mode === 'hunt' && sim.hunt.status === 'active';
    if (this.music) this.music.gain.setTargetAtTime(hunting ? .045 + sim.hunt.heat * .0005 : .006, now, .7);
    this.rhythm -= dt; this.heartbeat -= dt;
    if (hunting && sim.hunt.heat > 28 && this.rhythm <= 0) {
      this.rhythm = 1.2 - sim.hunt.heat * .006;
      this.tone(64, 37, .16, .055 + sim.hunt.heat * .0006); this.grit(.06, .025, 550, 1900, .16);
    }
    if (hunting && (sim.hunt.health < 30 || sim.hunt.hunger < 15) && this.heartbeat <= 0) {
      this.heartbeat = .83; this.tone(57, 38, .16, .12); this.tone(64, 43, .12, .075, 'sine', .19);
    }
    const live = new Set<number>();
    if (hunting) for (const marker of sim.markers) {
      live.add(marker.id);
      if (Math.hypot(marker.x - sim.x, marker.z - sim.z) > marker.radius + 20) continue;
      const phase = marker.time < .45 ? 2 : 1;
      if ((this.markerPhases.get(marker.id) ?? 0) < phase) {
        this.markerPhases.set(marker.id, phase);
        this.tone(marker.kind === 'seismic' ? 420 : 1250, marker.kind === 'seismic' ? 310 : 640, .16, phase === 2 ? .13 : .08, 'triangle');
      }
    }
    for (const id of this.markerPhases.keys()) if (!live.has(id)) this.markerPhases.delete(id);
  }
  private tone(from: number, to: number, duration: number, gain: number, type: OscillatorType = 'sine', delay = 0) {
    const ctx = this.context; if (!ctx || !this.master || gain <= 0) return;
    const t = ctx.currentTime + delay; const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(to, 10), t + duration);
    g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(gain, t + .015); g.gain.exponentialRampToValueAtTime(.001, t + duration);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + duration + .03);
  }
  private grit(duration: number, gain: number, low: number, high: number, delay = 0) {
    const ctx = this.context; if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime + delay, s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = this.noise; s.playbackRate.value = .7 + Math.random() * .5;
    f.type = 'bandpass'; f.frequency.setValueAtTime(high, t); f.frequency.exponentialRampToValueAtTime(low, t + duration); f.Q.value = .7;
    g.gain.setValueAtTime(.001, t); g.gain.exponentialRampToValueAtTime(gain, t + .018); g.gain.exponentialRampToValueAtTime(.001, t + duration);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + duration + .04);
  }
  event(e: Event, chain: number) {
    if (!this.context) return;
    if (e.type === 'breach') {
      this.sample('rock-fall', .33, .65, 2600); this.grit(1.1, .45, 450, 2800); this.tone(68, 27, .8, .6); this.grit(.4, .2, 1800, 5500, .12);
    } else if (e.type === 'slam' || e.type === 'land') {
      const p = clamp(e.power / 45); this.sample('rock-fall', e.type === 'slam' ? .6 : .28, e.type === 'slam' ? .72 : .9, 4200); this.tone(100, 26, .7, .45 + p * .4); this.grit(.85, .55 + p * .4, 140, 1900);
      this.grit(.3, .35, 400, 3200, .08);
    } else if (e.type === 'eat') {
      this.sample('chitin-crunch', .72, .75 + Math.min(chain, 8) * .045); this.grit(.14, .18, 700, 4200); this.grit(.1, .16, 200, 2200, .07); this.tone(170, 64, .18, .3);
      this.tone(260 + Math.min(chain, 8) * 38, 400 + Math.min(chain, 8) * 52, .18, .045, 'triangle', .08);
    } else if (e.type === 'break') {
      if (this.context.currentTime - this.lastDebris < .08) return;
      this.lastDebris = this.context.currentTime;
      this.sample('rock-fall', .45, 1.2, 6500); this.grit(.35, .3, 800, 6200); this.tone(130, 60, .22, .2, 'triangle');
    } else if (e.type === 'lunge') { this.grit(.27, .33, 500, 3000); this.tone(100, 55, .23, .19); }
    else if (e.type === 'shot') { this.grit(.1, .3, 900, 6800); this.tone(150, 58, .12, .12); }
    else if (e.type === 'hurt') { this.grit(.24, .38, 350, 1400); this.tone(125, 40, .34, .35); }
    else if (e.type === 'grow') {
      this.grit(.9, .55, 220, 1700); this.tone(52, 83, .85, .45, 'triangle');
      [293.66, 349.23, 440, 587.33].forEach((note, i) => this.tone(note, note, .7, .085, 'triangle', i * .1));
    } else if (e.type === 'win') {
      this.sample('rock-fall', .8, .6, 5000); this.tone(95, 28, 1.2, .65);
      [293.66, 349.23, 440, 587.33, 880].forEach((note, i) => this.tone(note, note, .9, .12, 'triangle', i * .13));
    } else if (e.type === 'lose') {
      [220, 174.61, 146.83].forEach((note, i) => this.tone(note, note * .97, .8, .1, 'triangle', i * .22));
    }
  }
  tick() { this.tone(440, 320, .07, .045, 'triangle'); }
}

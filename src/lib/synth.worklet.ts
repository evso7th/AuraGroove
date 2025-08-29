
// synth.worklet.js
console.log("[WORKLET_TRACE] synth.worklet.ts script loading. ARCH: ATTACK_RELEASE");
declare const currentTime: number;
declare const sampleRate: number;

// --- ADSR Envelope ---
class ADSREnvelope {
  private state: 'idle' | 'attack' | 'decay' | 'sustain' | 'release';
  private value: number;
  private samplesProcessed: number;
  private attackSamples: number;
  private decaySamples: number;
  private releaseSamples: number;
  private sustainLevel: number;
  private releaseInitialValue: number;

  constructor(options: any, sampleRate: number) {
    this.state = 'idle';
    this.value = 0.0;
    this.samplesProcessed = 0;

    this.attackSamples = (options.attack || 0.01) * sampleRate;
    this.decaySamples = (options.decay || 0.1) * sampleRate;
    this.releaseSamples = (options.release || 0.2) * sampleRate;
    this.sustainLevel = options.sustain ?? 0.5;
    this.releaseInitialValue = 0;
  }

  triggerAttack() {
    this.state = 'attack';
    this.samplesProcessed = 0;
    this.value = 0;
  }

  triggerRelease() {
    if (this.state !== 'idle') {
      this.state = 'release';
      this.releaseInitialValue = this.value;
      this.samplesProcessed = 0;
    }
  }

  process() {
    switch (this.state) {
      case 'attack':
        if (this.attackSamples > 0) {
          this.value = (this.samplesProcessed / this.attackSamples);
        } else {
          this.value = 1.0;
        }
        if (this.samplesProcessed >= this.attackSamples) {
          this.state = 'decay';
          this.samplesProcessed = 0;
        }
        break;
      case 'decay':
        if (this.decaySamples > 0) {
          this.value = 1.0 - (1.0 - this.sustainLevel) * (this.samplesProcessed / this.decaySamples);
        } else {
          this.value = this.sustainLevel;
        }
        if (this.samplesProcessed >= this.decaySamples) {
          this.state = 'sustain';
          this.samplesProcessed = 0;
        }
        break;
      case 'sustain':
        this.value = this.sustainLevel;
        break;
      case 'release':
        if (this.releaseSamples > 0) {
          this.value = this.releaseInitialValue * (1.0 - (this.samplesProcessed / this.releaseSamples));
        } else {
          this.value = 0;
        }
        if (this.samplesProcessed >= this.releaseSamples) {
          this.state = 'idle';
          this.value = 0.0;
        }
        break;
      case 'idle':
        this.value = 0.0;
        break;
    }
    
    if (this.value < 0.0001 && this.state !== 'attack') {
        this.state = 'idle';
        this.value = 0.0;
    }


    this.samplesProcessed++;
    return this.value;
  }

  isActive() {
    return this.state !== 'idle';
  }
}

// --- Oscillator ---
class Oscillator {
  private phase: number;
  private phaseIncrement: number;
  private type: string;
  private sampleRate: number;

  constructor(type, sampleRate) {
    this.phase = 0;
    this.phaseIncrement = 0;
    this.type = type;
    this.sampleRate = sampleRate;
  }

  setFrequency(freq) {
    this.phaseIncrement = (2 * Math.PI * freq) / this.sampleRate;
  }

  process() {
    let value = 0;
    switch (this.type) {
      case 'sine':
        value = Math.sin(this.phase);
        break;
      case 'sawtooth':
        value = (this.phase / Math.PI) - 1;
        break;
      case 'square':
        value = Math.sign(Math.sin(this.phase));
        break;
      case 'fatsine':
        value = (Math.sin(this.phase) + Math.sin(this.phase * 1.01) + Math.sin(this.phase * 0.99)) / 3;
        break;
      case 'fatsawtooth':
        value = (((this.phase / Math.PI) - 1) + (((this.phase * 1.01) / Math.PI) - 1) + (((this.phase * 0.99) / Math.PI) - 1)) / 3;
        break;
      case 'fmsquare': {
        const modulatorFreq = this.phaseIncrement * 5;
        const modulator = Math.sin(modulatorFreq) * 2.0;
        value = Math.sign(Math.sin(this.phase + modulator));
        break;
      }
      default:
        value = Math.sin(this.phase);
    }

    this.phase += this.phaseIncrement;
    if (this.phase >= 2 * Math.PI) {
      this.phase -= 2 * Math.PI;
    }
    return value;
  }
}

// --- Voice (A single mono-synth automaton) ---
class Voice {
  public noteId: number;
  private sampleRate: number;
  private oscillator: Oscillator;
  public envelope: ADSREnvelope;
  private velocity: number;
    
  constructor(sampleRate) {
    this.noteId = -1; 
    this.sampleRate = sampleRate;
    this.oscillator = new Oscillator('sine', sampleRate);
    this.envelope = new ADSREnvelope({}, sampleRate);
    this.velocity = 0;
  }

  trigger(note) {
    this.noteId = note.id;
    this.velocity = note.velocity;
    this.oscillator = new Oscillator(note.oscType || 'sine', this.sampleRate);
    this.oscillator.setFrequency(note.freq);
    this.envelope = new ADSREnvelope({
      attack: note.attack,
      decay: note.decay,
      sustain: note.sustain,
      release: note.release
    }, this.sampleRate);
    this.envelope.triggerAttack();
  }

  release() {
    this.envelope.triggerRelease();
  }

  process() {
    if (!this.isActive()) {
      return 0.0;
    }
    const envValue = this.envelope.process();
    if (!this.isActive()) {
      this.noteId = -1;
      return 0.0;
    }
    const oscValue = this.oscillator.process();
    return oscValue * envValue * this.velocity;
  }

  isActive() {
    return this.envelope.isActive();
  }
}


// --- Main Processor (The Metronome and Mixer) ---
class SynthProcessor extends AudioWorkletProcessor {
  private voicePools: Record<string, Voice[]>;
  private poolSizes: Record<string, number>;
  private attackQueue: any[];
  private releaseQueue: Map<number, number>;

  constructor() {
    super();
    console.log("[WORKLET_TRACE] SynthProcessor constructor called.");

    this.voicePools = {
      solo: [], accompaniment: [], bass: [], effects: [],
    };
    this.poolSizes = { solo: 4, accompaniment: 12, bass: 4, effects: 4 };

    this.attackQueue = [];
    this.releaseQueue = new Map();

    for (const poolName in this.poolSizes) {
      const size = this.poolSizes[poolName];
      for (let i = 0; i < size; i++) {
        this.voicePools[poolName].push(new Voice(sampleRate));
      }
    }
    console.log("[WORKLET_TRACE] Voice pools initialized:", this.poolSizes);


    this.port.onmessage = (event) => {
      const { type, score, startTime } = event.data;
      if (type === 'schedule') {
        const allNotes = [];
        if (score.solo) allNotes.push(...score.solo);
        if (score.accompaniment) allNotes.push(...score.accompaniment);
        if (score.bass) allNotes.push(...score.bass);
        if (score.effects) allNotes.push(...score.effects);

        allNotes.forEach(note => {
            const noteAttackTime = startTime + note.startTime;
            const noteReleaseTime = noteAttackTime + note.duration;
            this.attackQueue.push({ ...note, scheduledTime: noteAttackTime });
            this.releaseQueue.set(note.id, noteReleaseTime);
        });

        this.attackQueue.sort((a, b) => a.scheduledTime - b.scheduledTime);

      } else if (type === 'clear') {
        console.log("[WORKLET_TRACE] Received 'clear' command. Clearing voices and queues.");
        for (const poolName in this.voicePools) {
          this.voicePools[poolName].forEach(voice => voice.release());
        }
        this.attackQueue = [];
        this.releaseQueue.clear();
      }
    };
  }

  getVoiceForNote(note) {
    const poolName = note.part;
    const pool = this.voicePools[poolName];
    if (!pool) return null;

    let voice = pool.find(v => !v.isActive());

    if (!voice) {
        // Voice stealing: find the voice that has been in release the longest
        let oldestVoice = null;
        let longestRelease = -1;

        for(const v of pool){
            if(!v.isActive()){ // Should not happen if we are here but for safety
                oldestVoice = v;
                break;
            }
             // Prioritize stealing voices that are in release phase
            if (v.envelope.state === 'release' && v.envelope.samplesProcessed > longestRelease) {
                longestRelease = v.envelope.samplesProcessed;
                oldestVoice = v;
            }
        }
        if(!oldestVoice){
             // if no voice is in release, steal the one that has been playing the longest in sustain
             oldestVoice = pool.reduce((prev, curr) => (prev.envelope.samplesProcessed > curr.envelope.samplesProcessed) ? prev : curr);
        }
        
        console.warn(`[WORKLET_VOICE_STEAL] Stealing voice for part ${note.part}`);
        voice = oldestVoice;
    }
    
    return voice;
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel = output[0];

    if (!channel) {
      return true;
    }

    for (let i = 0; i < channel.length; i++) {
        const currentFrameTime = currentTime + i / sampleRate;

        // Process attacks
        while (this.attackQueue.length > 0 && this.attackQueue[0].scheduledTime <= currentFrameTime) {
            const note = this.attackQueue.shift();
            const voice = this.getVoiceForNote(note);
            if (voice) {
                voice.trigger(note);
            }
        }
        
        // Process releases
        this.releaseQueue.forEach((releaseTime, noteId) => {
            if (releaseTime <= currentFrameTime) {
                for (const poolName in this.voicePools) {
                    const voice = this.voicePools[poolName].find(v => v.noteId === noteId);
                    if (voice) {
                        voice.release();
                        break; 
                    }
                }
                this.releaseQueue.delete(noteId);
            }
        });

        // Mix all active voices
        let sample = 0;
        for (const poolName in this.voicePools) {
            for (const voice of this.voicePools[poolName]) {
                if (voice.isActive()) {
                    sample += voice.process(); 
                }
            }
        }
        channel[i] = Math.max(-1, Math.min(1, sample * 0.3));
    }
    
    return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);
console.log("[WORKLET_TRACE] synth-processor registered.");

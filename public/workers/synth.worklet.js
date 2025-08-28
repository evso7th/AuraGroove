
// synth.worklet.js
console.log("[WORKLET_TRACE] synth.worklet.ts script loading. ARCH: ATTACK_RELEASE");

// --- ADSR Envelope ---
class ADSREnvelope {
  constructor(options, sampleRate) {
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
  }

  triggerRelease() {
    if (this.state !== 'idle') {
      this.state = 'release';
      this.releaseInitialValue = this.value;
      this.samplesProcessed = 0;
    }
  }

  process(velocity) {
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
        }
        break;
      case 'sustain':
        this.value = this.sustainLevel;
        break;
      case 'release':
        if (this.releaseSamples > 0) {
          this.value = this.releaseInitialValue * (1.0 - this.samplesProcessed / this.releaseSamples);
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

    if (this.value < 0.0001 && (this.state === 'release' || (this.state === 'decay' && this.sustainLevel < 0.0001))) {
        this.state = 'idle';
        this.value = 0.0;
    }

    this.samplesProcessed++;
    return this.value * velocity;
  }

  isActive() {
    return this.state !== 'idle';
  }
}

// --- Oscillator ---
class Oscillator {
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
  constructor(sampleRate) {
    this.noteId = -1; 
    this.sampleRate = sampleRate;
    this.oscillator = new Oscillator('sine', sampleRate);
    this.envelope = new ADSREnvelope({}, sampleRate);
  }

  triggerAttack(note) {
    this.noteId = note.id;
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

  triggerRelease() {
    this.envelope.triggerRelease();
  }

  process(velocity) {
    if (!this.isActive()) {
      return 0.0;
    }
    const envValue = this.envelope.process(velocity);
    if (!this.isActive()) {
      this.noteId = -1; // Mark as free
      return 0.0;
    }
    const oscValue = this.oscillator.process();
    return oscValue * envValue;
  }

  isActive() {
    return this.envelope.isActive();
  }
}


// --- Main Processor (The Metronome and Mixer) ---
class SynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    console.log("[WORKLET_TRACE] SynthProcessor constructor called.");

    this.voicePools = {
      solo: [], accompaniment: [], bass: [], effects: [],
    };
    this.poolSizes = { solo: 4, accompaniment: 12, bass: 4, effects: 4 };

    this.attackQueue = [];
    this.releaseQueue = new Map(); // Maps noteId to releaseTime

    this.scoreStartTime = 0;
    this.isPlaying = false;
    
    this.lastRequestTime = -Infinity;
    this.scoreBufferTime = 10; // seconds

    for (const poolName in this.poolSizes) {
      const size = this.poolSizes[poolName];
      for (let i = 0; i < size; i++) {
        this.voicePools[poolName].push(new Voice(sampleRate));
      }
    }
    console.log("[WORKLET_TRACE] Voice pools initialized:", this.poolSizes);


    this.port.onmessage = (event) => {
      const { type, score } = event.data;
      if (type === 'schedule') {
        // console.log("[WORKLET_TRACE] Received 'schedule' command with score.", { score });
        if (!this.isPlaying) {
          this.scoreStartTime = currentTime;
          this.lastRequestTime = currentTime;
          // console.log(`[WORKLET_TRACE] Note queue was empty. Resetting scoreStartTime to ${this.scoreStartTime}`);
        }

        const allNotes = [];
        if (score.solo) allNotes.push(...score.solo);
        if (score.accompaniment) allNotes.push(...score.accompaniment);
        if (score.bass) allNotes.push(...score.bass);
        if (score.effects) allNotes.push(...score.effects);

        this.attackQueue.push(...allNotes);
        this.attackQueue.sort((a, b) => a.startTime - b.startTime);

        allNotes.forEach(note => {
          this.releaseQueue.set(note.id, this.scoreStartTime + note.startTime + note.duration);
        });
        
        this.isPlaying = true;

      } else if (type === 'clear') {
        console.log("[WORKLET_TRACE] Received 'clear' command. Clearing voices and queues.");
        for (const poolName in this.voicePools) {
          this.voicePools[poolName].forEach(voice => voice.triggerRelease());
        }
        this.attackQueue = [];
        this.releaseQueue.clear();
        this.isPlaying = false;
      }
    };
  }

  getVoiceForNote(note) {
    const poolName = note.part;
    const pool = this.voicePools[poolName];
    if (!pool) return null;

    let voice = pool.find(v => !v.isActive());

    if (!voice) {
        // Voice stealing: find the voice in the release state for the longest time
        let oldestVoice = pool.reduce((prev, curr) => (prev.envelope.samplesProcessed > curr.envelope.samplesProcessed && prev.envelope.state ==='release') ? prev : curr);
        console.warn(`[WORKLET_VOICE_STEAL] Stealing voice for part ${note.part}`);
        voice = oldestVoice;
    }
    
    return voice;
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel = output[0];

    if (!this.isPlaying || !channel) {
      return true;
    }

    for (let i = 0; i < channel.length; i++) {
        const currentFrameTime = currentTime + i / sampleRate;

        // Process attacks
        while (this.attackQueue.length > 0 && this.scoreStartTime + this.attackQueue[0].startTime <= currentFrameTime) {
            const note = this.attackQueue.shift();
            const voice = this.getVoiceForNote(note);
            if (voice) {
                voice.triggerAttack(note);
            }
        }
        
        // Process releases
        this.releaseQueue.forEach((releaseTime, noteId) => {
            if (releaseTime <= currentFrameTime) {
                for (const poolName in this.voicePools) {
                    const voice = this.voicePools[poolName].find(v => v.noteId === noteId);
                    if (voice) {
                        voice.triggerRelease();
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
                    // Note velocity is now part of the envelope process
                    sample += voice.process(1.0); 
                }
            }
        }
        channel[i] = Math.max(-1, Math.min(1, sample * 0.3));
    }
    
    const attackQueueDuration = this.attackQueue.length > 0 
      ? (this.scoreStartTime + this.attackQueue[this.attackQueue.length - 1].startTime) - currentTime
      : 0;

    if (this.isPlaying && attackQueueDuration < this.scoreBufferTime && currentTime > this.lastRequestTime + 1) {
      // console.log(`[WORKLET_TRACE] Buffer low (${attackQueueDuration.toFixed(2)}s). Requesting new score.`);
      this.port.postMessage({ type: 'request_new_score' });
      this.lastRequestTime = currentTime;
    }

    return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);
console.log("[WORKLET_TRACE] synth-processor registered.");

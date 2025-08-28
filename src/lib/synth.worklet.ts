
// synth.worklet.js
console.log("[WORKLET_TRACE] synth.worklet.ts script loading. ARCH: FINITE_AUTOMATA");

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
    this.baseSustainLevel = this.sustainLevel;
    this.releaseInitialValue = 0;
  }

  triggerAttack() {
    this.state = 'attack';
    this.samplesProcessed = 0;
    this.sustainLevel = this.baseSustainLevel;
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

    if (this.value < 0.0001) {
      if (this.state === 'release' || this.state === 'decay') {
        this.state = 'idle';
        this.value = 0.0;
      }
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
    this.startTime = 0;
    this.releaseTime = Infinity;
    this.noteVelocity = 0;
    this.noteId = -1; // Added to track which note this voice is playing
    this.sampleRate = sampleRate;
    this.oscillator = new Oscillator('sine', sampleRate);
    this.envelope = new ADSREnvelope({}, sampleRate);
  }

  play(note, currentTime) {
    this.startTime = currentTime;
    this.releaseTime = currentTime + note.duration;
    this.noteVelocity = note.velocity;
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

  stop() {
    this.envelope.triggerRelease();
  }

  process(currentTime) {
      if (!this.isActive()) {
          return 0.0;
      }

      // Check if it's time to release the note
      if (this.envelope.state !== 'release' && currentTime >= this.releaseTime) {
          this.stop();
      }

      const envValue = this.envelope.process(this.noteVelocity);
      
      // If the envelope has just become idle, log it and return 0
      if (!this.isActive()) {
          console.log(`[WORKLET_VOICE_FREE] Voice for noteId ${this.noteId} is now idle.`);
          this.noteId = -1;
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
      solo: [],
      accompaniment: [],
      bass: [],
      effects: [],
    };
    this.poolSizes = { solo: 4, accompaniment: 12, bass: 4, effects: 4 };

    this.noteQueue = [];
    this.scoreStartTime = 0;
    this.isPlaying = false;
    this.nextNoteId = 0;

    this.lastRequestTime = -Infinity;
    this.scoreBufferTime = 10; // seconds

    // --- Correct Initialization of Voice Pools ---
    for (const poolName in this.poolSizes) {
      if (this.voicePools.hasOwnProperty(poolName)) {
        const size = this.poolSizes[poolName];
        for (let i = 0; i < size; i++) {
          this.voicePools[poolName].push(new Voice(sampleRate));
        }
      }
    }
    console.log("[WORKLET_TRACE] Voice pools initialized:", this.poolSizes);


    this.port.onmessage = (event) => {
      const { type, score } = event.data;
      if (type === 'schedule') {
        console.log("[WORKLET_TRACE] Received 'schedule' command with score.", { score });
        if (!this.isPlaying) {
          this.scoreStartTime = currentTime;
          this.lastRequestTime = currentTime;
          console.log(`[WORKLET_TRACE] Note queue was empty. Resetting scoreStartTime to ${this.scoreStartTime}`);
        }

        const allNotes = [];
        if (score.solo) allNotes.push(...score.solo.map(n => ({ ...n, part: 'solo' })));
        if (score.accompaniment) allNotes.push(...score.accompaniment.map(n => ({ ...n, part: 'accompaniment' })));
        if (score.bass) allNotes.push(...score.bass.map(n => ({ ...n, part: 'bass' })));
        if (score.effects) allNotes.push(...score.effects.map(n => ({ ...n, part: 'effects' })));

        const notesWithIds = allNotes.map(n => ({ ...n, id: this.nextNoteId++ }));

        this.noteQueue.push(...notesWithIds);
        this.noteQueue.sort((a, b) => a.startTime - b.startTime);
        this.isPlaying = true;

      } else if (type === 'clear') {
        console.log("[WORKLET_TRACE] Received 'clear' command. Clearing voices and queue.");
        for (const poolName in this.voicePools) {
          if (this.voicePools[poolName]) {
            this.voicePools[poolName].forEach(voice => voice.stop());
          }
        }
        this.noteQueue = [];
        this.isPlaying = false;
      }
    };
  }

  getVoiceForNote(note) {
    const poolName = note.part;
    if (!poolName || !this.voicePools.hasOwnProperty(poolName)) return null;

    let pool = this.voicePools[poolName];

    let voiceIndex = pool.findIndex(v => !v.isActive());

    // Voice stealing logic
    if (voiceIndex === -1) {
      let oldestVoiceIndex = 0;
      for (let i = 1; i < pool.length; i++) {
        if (pool[i].startTime < pool[oldestVoiceIndex].startTime) {
          oldestVoiceIndex = i;
        }
      }
      console.warn(`[WORKLET_VOICE_STEAL] Stealing voice ${oldestVoiceIndex} for part ${note.part}`);
      voiceIndex = oldestVoiceIndex;
    }
    
    // console.log(`[WORKLET_VOICE_TRACE] Part: ${note.part}, Voice: ${voiceIndex}, Freq: ${note.freq.toFixed(2)}, V: ${note.velocity.toFixed(2)}, ADSR: A:${note.attack} D:${note.decay} S:${note.sustain} R:${note.release}`);

    return pool[voiceIndex];
  }

  process(inputs, outputs) {
    const output = outputs[0];
    const channel = output[0];

    if (!this.isPlaying || !channel) {
      return true;
    }

    const timeToScheduleUntil = currentTime + (channel.length / sampleRate);

    while (this.noteQueue.length > 0 && this.scoreStartTime + this.noteQueue[0].startTime < timeToScheduleUntil) {
      const note = this.noteQueue.shift();
      const voice = this.getVoiceForNote(note);
      if (voice) {
        voice.play(note, this.scoreStartTime + note.startTime);
      }
    }

    for (let i = 0; i < channel.length; i++) {
      let sample = 0;
      const currentFrameTime = currentTime + i / sampleRate;
      for (const poolName in this.voicePools) {
        for (const voice of this.voicePools[poolName]) {
          if (voice.isActive()) {
            sample += voice.process(currentFrameTime);
          }
        }
      }
      channel[i] = Math.max(-1, Math.min(1, sample * 0.3));
    }

    const remainingBuffer = this.noteQueue.length > 0
      ? (this.scoreStartTime + this.noteQueue[this.noteQueue.length - 1].startTime) - currentTime
      : 0;

    if (this.isPlaying && remainingBuffer < this.scoreBufferTime && currentTime > this.lastRequestTime + 1) {
      console.log(`[WORKLET_TRACE] Buffer low (${remainingBuffer.toFixed(2)}s). Requesting new score.`);
      this.port.postMessage({ type: 'request_new_score' });
      this.lastRequestTime = currentTime;
    }

    return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);
console.log("[WORKLET_TRACE] synth-processor registered.");

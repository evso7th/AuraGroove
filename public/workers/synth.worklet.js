// synth.worklet.js
console.log("[WORKLET_TRACE] synth.worklet.ts script loading. ARCH: FINITE_AUTOMATA");

// --- ADSR Envelope ---
class ADSREnvelope {
  state = 'idle';
  value = 0.0;
  samplesProcessed = 0;
  
  attackSamples;
  decaySamples;
  releaseSamples;
  sustainLevel;

  constructor(options, sampleRate) {
      this.attackSamples = (options.attack || 0.01) * sampleRate;
      this.decaySamples = (options.decay || 0.1) * sampleRate;
      this.releaseSamples = (options.release || 0.2) * sampleRate;
      this.sustainLevel = options.sustain ?? 0.5;
  }

  triggerAttack() {
      this.state = 'attack';
      this.samplesProcessed = 0;
  }

  triggerRelease() {
      if (this.state !== 'idle') {
          this.state = 'release';
          this.samplesProcessed = 0;
      }
  }

  process() {
      switch (this.state) {
          case 'attack':
              this.value = this.samplesProcessed / this.attackSamples;
              if (this.samplesProcessed >= this.attackSamples) {
                  this.state = 'decay';
                  this.samplesProcessed = 0;
              }
              break;
          case 'decay':
              this.value = 1.0 - (1.0 - this.sustainLevel) * (this.samplesProcessed / this.decaySamples);
              if (this.samplesProcessed >= this.decaySamples) {
                  this.state = 'sustain';
              }
              break;
          case 'sustain':
              this.value = this.sustainLevel;
              break;
          case 'release':
              this.value = this.sustainLevel * (1.0 - this.samplesProcessed / this.releaseSamples);
              if (this.samplesProcessed >= this.releaseSamples) {
                  this.state = 'idle';
                  this.value = 0.0;
              }
              break;
          case 'idle':
              this.value = 0.0;
              break;
      }
      
      if (this.value < 0.0001 && this.state === 'release') {
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
  phase = 0;
  phaseIncrement = 0;
  type;
  sampleRate;

  constructor(type, sampleRate) {
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
  oscillator;
  envelope;
  noteId = -1;
  startTime = 0;
  sampleRate;

  constructor(sampleRate) {
      this.sampleRate = sampleRate;
      // Initialize with placeholder objects
      this.oscillator = new Oscillator('sine', sampleRate);
      this.envelope = new ADSREnvelope({}, sampleRate);
  }

  play(note, currentTime) {
      this.noteId = note.id; 
      this.startTime = currentTime;
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

  process() {
      if (!this.envelope.isActive()) {
          return 0.0;
      }
      const envValue = this.envelope.process();
      const oscValue = this.oscillator.process();
      return oscValue * envValue;
  }

  isActive() {
      return this.envelope.isActive();
  }
}


// --- Main Processor (The Metronome and Mixer) ---
class SynthProcessor extends AudioWorkletProcessor {
  voicePools = {
      solo: [],
      accompaniment: [],
      bass: [],
      effects: [],
  };
  poolSizes = { solo: 4, accompaniment: 12, bass: 4, effects: 4 };
  
  noteQueue = [];
  scoreStartTime = 0;
  isPlaying = false;
  nextNoteId = 0;

  lastRequestTime = -Infinity;
  scoreBufferTime = 10; // seconds

  constructor() {
      super();
      console.log("[WORKLET_TRACE] SynthProcessor constructor called.");

      this.port.onmessage = (event) => {
          const { type, score, bpm } = event.data;
          if (type === 'schedule') {
              console.log("[WORKLET_TRACE] Received 'schedule' command with score.", { score });
              if (!this.isPlaying) {
                  this.scoreStartTime = currentTime;
                  this.lastRequestTime = currentTime;
                  console.log(`[WORKLET_TRACE] Note queue was empty. Resetting scoreStartTime to ${this.scoreStartTime}`);
              }
              
              const allNotes = [];
              if (score.solo) allNotes.push(...score.solo.map(n => ({...n, part: 'solo'})));
              if (score.accompaniment) allNotes.push(...score.accompaniment.map(n => ({...n, part: 'accompaniment'})));
              if (score.bass) allNotes.push(...score.bass.map(n => ({...n, part: 'bass'})));
              if (score.effects) allNotes.push(...score.effects.map(n => ({...n, part: 'effects'})));
              
              const notesWithIds = allNotes.map(n => ({...n, id: this.nextNoteId++}));

              this.noteQueue.push(...notesWithIds);
              this.noteQueue.sort((a, b) => a.startTime - b.startTime);
              this.isPlaying = true;

          } else if (type === 'clear') {
              console.log("[WORKLET_TRACE] Received 'clear' command. Clearing voices and queue.");
              for (const poolName in this.voicePools) {
                this.voicePools[poolName].forEach(voice => voice.stop());
              }
              this.noteQueue = [];
              this.isPlaying = false;
          }
      };
  }

  getVoiceForNote(note, currentTime) {
      const poolName = note.part;
      let pool = this.voicePools[poolName];
      let voiceIndex = -1;

      // Lazy initialization of pools
      while (pool.length < this.poolSizes[poolName]) {
          pool.push(new Voice(sampleRate));
      }

      // Find a free voice
      const freeVoiceIndex = pool.findIndex(v => !v.isActive());
      if (freeVoiceIndex !== -1) {
          voiceIndex = freeVoiceIndex;
      } else {
          // Voice stealing: find the oldest voice to reuse
          let oldestVoiceIndex = 0;
          for (let i = 1; i < pool.length; i++) {
              if (pool[i].startTime < pool[oldestVoiceIndex].startTime) {
                  oldestVoiceIndex = i;
              }
          }
          voiceIndex = oldestVoiceIndex;
          console.log(`[WORKLET_VOICE_STEAL] Stealing voice ${voiceIndex} for part ${poolName}`);
      }

      console.log(`[WORKLET_VOICE_TRACE] Part: ${note.part}, Voice: ${voiceIndex}, Freq: ${note.freq.toFixed(2)}`);
      return pool[voiceIndex];
  }

  process(inputs, outputs, parameters) {
      const output = outputs[0];
      const channel = output[0];

      if (!this.isPlaying || !channel) {
          return true;
      }

      const timeToScheduleUntil = currentTime + channel.length / sampleRate;

      while (this.noteQueue.length > 0 && this.scoreStartTime + this.noteQueue[0].startTime < timeToScheduleUntil) {
          const note = this.noteQueue.shift();
          if (this.voicePools[note.part]) {
              const voice = this.getVoiceForNote(note, this.scoreStartTime + note.startTime);
              if(voice) {
                voice.play(note, this.scoreStartTime + note.startTime);
              }
          }
      }

      for (let i = 0; i < channel.length; i++) {
          let sample = 0;
          for (const poolName in this.voicePools) {
              for (const voice of this.voicePools[poolName]) {
                  if (voice.isActive()) {
                      sample += voice.process();
                  }
              }
          }
          // Simple limiter to prevent clipping
          channel[i] = Math.max(-1, Math.min(1, sample * 0.3)); // Master volume
      }

      const remainingBuffer = this.noteQueue.length > 0 
          ? (this.scoreStartTime + this.noteQueue[this.noteQueue.length - 1].startTime) - currentTime 
          : 0;

      if (remainingBuffer < this.scoreBufferTime && currentTime > this.lastRequestTime + 1) {
          this.port.postMessage({ type: 'request_new_score' });
          this.lastRequestTime = currentTime;
      }

      return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);
console.log("[WORKLET_TRACE] synth-processor registered.");

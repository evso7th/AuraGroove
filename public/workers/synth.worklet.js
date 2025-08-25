
// synth.worklet.ts
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
                // Use the sustain level at the moment of release as the starting point
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
        
        this.samplesProcessed++;
        return Math.max(0, this.value);
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
        while (this.phase >= 2 * Math.PI) {
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
    lastUsedTime = 0;
    sampleRate;

    constructor(sampleRate) {
        this.sampleRate = sampleRate;
        this.oscillator = new Oscillator('sine', sampleRate);
        this.envelope = new ADSREnvelope({}, sampleRate);
    }

    play(note, currentTime) {
        this.noteId = note.id; // Assuming notes will have unique IDs
        this.lastUsedTime = currentTime;
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

    process() {
        if (!this.envelope.isActive()) {
            this.noteId = -1; // Free up the voice
            return 0.0;
        }
        
        const envValue = this.envelope.process();
        const oscValue = this.oscillator.process();
        return oscValue * envValue * (this.noteId !== -1 ? 1 : 0);
    }

    isActive() {
        return this.noteId !== -1;
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
    poolSizes = { solo: 4, accompaniment: 8, bass: 4, effects: 4 };
    
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
                
                // Flatten all parts into a single array
                const allNotes = Object.values(score).flat();
                
                const notesWithIds = allNotes.map(n => ({...n, id: this.nextNoteId++}));

                this.noteQueue.push(...notesWithIds);
                this.noteQueue.sort((a, b) => a.startTime - b.startTime);
                this.isPlaying = true;

            } else if (type === 'clear') {
                console.log("[WORKLET_TRACE] Received 'clear' command. Clearing voices and queue.");
                this.voicePools = { solo: [], accompaniment: [], bass: [], effects: [] };
                this.noteQueue = [];
                this.isPlaying = false;
            }
        };
    }

    getVoiceForNote(note, currentTime) {
        const poolName = note.part;
        if (!this.voicePools[poolName]) {
            this.voicePools[poolName] = [];
        }

        let pool = this.voicePools[poolName];
        
        // Lazy initialization of pools
        if (pool.length < this.poolSizes[poolName]) {
            const newVoice = new Voice(sampleRate);
            pool.push(newVoice);
            return newVoice;
        }

        let voice = pool.find(v => !v.isActive());
        if (voice) return voice;

        // Voice stealing: find the oldest voice to reuse
        return pool.reduce((oldest, current) => {
            return current.lastUsedTime < oldest.lastUsedTime ? current : oldest;
        });
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
            // Ensure the part exists in the pools before getting a voice
            if(this.voicePools[note.part]) {
                const voice = this.getVoiceForNote(note, this.scoreStartTime + note.startTime);
                voice.play(note, this.scoreStartTime + note.startTime);
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
            channel[i] = sample * 0.2; // Master volume
        }

        const remainingBuffer = this.noteQueue.length > 0 
            ? (this.scoreStartTime + this.noteQueue[this.noteQueue.length - 1].startTime) - currentTime 
            : 0;

        if (remainingBuffer < this.scoreBufferTime && currentTime > this.lastRequestTime + 1) {
            console.log(`[WORKLET_TRACE] Buffer low (${remainingBuffer.toFixed(2)}s). Requesting new score.`);
            this.port.postMessage({ type: 'request_new_score' });
            this.lastRequestTime = currentTime;
        }

        return true;
    }
}

registerProcessor('synth-processor', SynthProcessor);
console.log("[WORKLET_TRACE] synth-processor registered.");

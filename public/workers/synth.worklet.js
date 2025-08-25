
// synth.worklet.ts
console.log("[WORKLET_TRACE] synth.worklet.ts script loading. ARCH: FINITE_AUTOMATA");

// --- ADSR Envelope ---
class ADSREnvelope {
    private state: 'idle' | 'attack' | 'decay' | 'sustain' | 'release' = 'idle';
    private value = 0.0;
    private samplesProcessed = 0;
    
    private attackSamples: number;
    private decaySamples: number;
    private releaseSamples: number;

    constructor(
        private options: { attack?: number; decay?: number; sustain?: number; release?: number },
        private sampleRate: number
    ) {
        this.attackSamples = (this.options.attack || 0.01) * this.sampleRate;
        this.decaySamples = (this.options.decay || 0.1) * this.sampleRate;
        this.releaseSamples = (this.options.release || 0.2) * this.sampleRate;
    }

    triggerAttack() {
        this.state = 'attack';
        this.samplesProcessed = 0;
    }

    triggerRelease() {
        this.state = 'release';
        this.samplesProcessed = 0;
    }

    process(): number {
        switch (this.state) {
            case 'attack':
                this.value = this.samplesProcessed / this.attackSamples;
                if (this.samplesProcessed >= this.attackSamples) {
                    this.state = 'decay';
                    this.samplesProcessed = 0;
                }
                break;
            case 'decay':
                this.value = 1.0 - (1.0 - (this.options.sustain ?? 0.5)) * (this.samplesProcessed / this.decaySamples);
                if (this.samplesProcessed >= this.decaySamples) {
                    this.state = 'sustain';
                }
                break;
            case 'sustain':
                this.value = this.options.sustain ?? 0.5;
                break;
            case 'release':
                this.value = (this.options.sustain ?? 0.5) * (1.0 - this.samplesProcessed / this.releaseSamples);
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

    isActive(): boolean {
        return this.state !== 'idle';
    }
}

// --- Oscillator ---
class Oscillator {
    private phase = 0;
    private phaseIncrement = 0;

    constructor(private type: string, private sampleRate: number) {}

    setFrequency(freq: number) {
        this.phaseIncrement = (2 * Math.PI * freq) / this.sampleRate;
    }

    process(): number {
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
    private oscillator: Oscillator;
    private envelope: ADSREnvelope;
    public note: any = null; // Storing the note for stealing logic
    public startTime = 0;

    constructor(private sampleRate: number) {
        this.oscillator = new Oscillator('sine', sampleRate);
        this.envelope = new ADSREnvelope({}, sampleRate);
    }

    play(note: any, currentTime: number) {
        this.note = note;
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

    process(): number {
        if (!this.envelope.isActive()) return 0.0;
        
        const envValue = this.envelope.process();
        const oscValue = this.oscillator.process();
        return oscValue * envValue * this.note.velocity;
    }

    isActive(): boolean {
        return this.envelope.isActive();
    }
}


// --- Main Processor (The Metronome and Mixer) ---
class SynthProcessor extends AudioWorkletProcessor {
    private voicePools: Record<string, Voice[]> = {
        solo: [],
        accompaniment: [],
        bass: [],
        effects: []
    };
    private poolConfig = {
        solo: { size: 4 },
        accompaniment: { size: 8 },
        bass: { size: 4 },
        effects: { size: 4 }
    };

    private noteQueue: any[] = [];
    private scoreStartTime = 0;
    private isPlaying = false;

    private lastRequestTime = -Infinity;
    private scoreBufferTime = 10; // seconds

    constructor() {
        super();
        console.log("[WORKLET_TRACE] SynthProcessor constructor called.");

        this.port.onmessage = (event) => {
            const { type, score, bpm } = event.data;
            if (type === 'schedule') {
                if (this.noteQueue.length === 0) {
                    this.scoreStartTime = currentTime;
                    this.lastRequestTime = currentTime;
                }
                
                const allNotes = [...(score.solo || []), ...(score.accompaniment || []), ...(score.bass || []), ...(score.effects || [])];
                this.noteQueue.push(...allNotes);
                this.noteQueue.sort((a, b) => a.startTime - b.startTime);
                this.isPlaying = true;
            } else if (type === 'clear') {
                this.voicePools = { solo: [], accompaniment: [], bass: [], effects: [] };
                this.noteQueue = [];
                this.isPlaying = false;
            }
        };
    }

    getVoiceForNote(note: any): Voice {
        const poolName = note.part;
        if (!this.voicePools[poolName]) {
            this.voicePools[poolName] = [];
        }

        let pool = this.voicePools[poolName];
        let voice = pool.find(v => !v.isActive());

        if (voice) {
            return voice;
        }

        const poolMaxSize = this.poolConfig[poolName as keyof typeof this.poolConfig]?.size || 4;
        if (pool.length < poolMaxSize) {
            voice = new Voice(sampleRate);
            pool.push(voice);
            return voice;
        }

        // Voice stealing
        return pool.reduce((oldest, current) => {
            return current.startTime < oldest.startTime ? current : oldest;
        });
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];

        if (!this.isPlaying) {
            channel.fill(0);
            return true;
        }

        const timeToScheduleUntil = currentTime + channel.length / sampleRate;

        while (this.noteQueue.length > 0 && this.scoreStartTime + this.noteQueue[0].startTime < timeToScheduleUntil) {
            const note = this.noteQueue.shift();
            const voice = this.getVoiceForNote(note);
            if (voice) {
                voice.play(note, this.scoreStartTime + note.startTime);
            }
        }

        channel.fill(0);
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

        const remainingBuffer = this.noteQueue.length > 0 ? (this.scoreStartTime + this.noteQueue[this.noteQueue.length - 1].startTime) - currentTime : 0;
        if (remainingBuffer < this.scoreBufferTime && currentTime > this.lastRequestTime + 1) {
            this.port.postMessage({ type: 'request_new_score' });
            this.lastRequestTime = currentTime;
        }

        return true;
    }
}

registerProcessor('synth-processor', SynthProcessor);
console.log("[WORKLET_TRACE] synth-processor registered.");

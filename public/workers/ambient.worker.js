/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication.
 * 2.  Scheduler: The central "conductor" or "event loop".
 * 3.  Instrument Generators: The "composers" (e.g., DrumGenerator, BassGenerator).
 * 4.  PatternProvider: The "music sheet library".
 * 5.  AudioRenderer: The "audio engine" for sample-based instruments.
 * 6.  SampleBank: Storage for decoded audio samples.
 */

// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 0.5 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 },
            { sample: 'hat', time: 2.5 },
            { sample: 'snare', time: 3 },
            { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 0.5 },
            { sample: 'kick', time: 0.75 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 },
            { sample: 'snare', time: 2.5 },
            { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 },
            { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 1 },
            { sample: 'snare', time: 2 },
            { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 },
            { sample: 'ride', time: 0.5 },
            { sample: 'snare', time: 1, velocity: 1.0 },
            { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 },
            { sample: 'ride', time: 2.5 },
            { sample: 'snare', time: 3, velocity: 1.0 },
            { sample: 'ride', time: 3.5 },
        ],
    },
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];
        if (barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
     static createScore(rootNote = 'E') {
        const score = [
            { note: `${rootNote}1`, time: 0, duration: '2n', velocity: 0.9 },
            { note: `${rootNote}1`, time: 2, duration: '2n', velocity: 0.9 },
        ];
        return score;
    }
}

class SoloGenerator {
    static createScore(barNumber) {
        // Simple rotating chord progression: Em -> C -> G -> D
        const chords = [
            ['E3', 'G3', 'B3'], // Em
            ['C3', 'E3', 'G3'], // C
            ['G3', 'B3', 'D4'], // G
            ['D3', 'F#3', 'A3']  // D
        ];
        const currentChord = chords[barNumber % chords.length];
        
        const score = [
            // Play the chord as a whole note
            { notes: currentChord, time: 0, duration: '1n', velocity: 0.6 }
        ];
        return score;
    }
}


// --- 3. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {},
    isInitialized: false,

    init(samples) {
        // Samples are now decoded on the main thread and sent here as Float32Arrays
        this.samples = samples;
        this.isInitialized = true;
        console.log("SampleBank Initialized with pre-decoded samples:", Object.keys(this.samples));
        // IMPORTANT: Signal back to main thread that initialization is complete
        self.postMessage({ type: 'initialized' });
    },

    getSample(name) {
        return this.samples[name];
    }
};


// --- 4. AudioRenderer (The Sound Engine) ---
const AudioRenderer = {
    render(score, settings, sampleRate) {
        const { duration, volume } = settings;
        const totalSamples = Math.floor(duration * sampleRate);
        const chunk = new Float32Array(totalSamples).fill(0);

        for (const note of score) {
            const sample = SampleBank.getSample(note.sample);
            if (!sample) continue;

            const noteVelocity = note.velocity ?? 1.0;
            const finalVolume = volume * noteVelocity;
            
            const startSample = Math.floor(note.time * Scheduler.secondsPerBeat * sampleRate);
            const endSample = Math.min(startSample + sample.length, totalSamples);
            
            for (let i = 0; i < (endSample - startSample); i++) {
                if (startSample + i < chunk.length) {
                    chunk[startSample + i] += sample[i] * finalVolume;
                }
            }
        }
        
        for (let i = 0; i < totalSamples; i++) {
            chunk[i] = Math.max(-1, Math.min(1, chunk[i]));
        }

        return chunk;
    }
};


// --- 5. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    sampleRate: 44100,
    bpm: 120,
    instruments: {},
    drumSettings: {},

    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;
        
        this.tick();

        this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isRunning = false;
        self.postMessage({ type: 'stopped' });
    },

    reset() {
        this.barCount = 0;
    },
    
    updateSettings(settings) {
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.bpm) {
            const wasRunning = this.isRunning;
            if (wasRunning) this.stop();
            this.bpm = settings.bpm;
            if (wasRunning) this.start();
        }
    },

    tick() {
        if (!this.isRunning) return;

        let drumScore = [];
        
        if (this.drumSettings.enabled) {
            drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount
            );
        }

        if (this.instruments.bass === 'bass synth') {
            const bassScore = BassGenerator.createScore('E');
            self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }

        if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore(this.barCount);
            self.postMessage({ type: 'solo_score', data: { score: soloScore } });
        }

        const audioChunk = this.render(drumScore, {
            duration: this.barDuration,
            volume: this.drumSettings.volume || 0.7
        });
        
        self.postMessage({
            type: 'chunk',
            data: {
                chunk: audioChunk,
                duration: this.barDuration,
            }
        }, [audioChunk.buffer]);

        this.barCount++;
    },

    render(score, settings) {
        const { duration, volume } = settings;
        const totalSamples = Math.floor(duration * this.sampleRate);
        const chunk = new Float32Array(totalSamples).fill(0);

        for (const note of score) {
            const sample = SampleBank.getSample(note.sample);
            if (!sample) continue;

            const noteVelocity = note.velocity ?? 1.0;
            const finalVolume = volume * noteVelocity;
            
            const startSample = Math.floor(note.time * this.secondsPerBeat * this.sampleRate);
            const endSample = Math.min(startSample + sample.length, totalSamples);
            
            for (let i = 0; i < (endSample - startSample); i++) {
                if (startSample + i < chunk.length) {
                    chunk[startSample + i] += sample[i] * finalVolume;
                }
            }
        }
        
        for (let i = 0; i < totalSamples; i++) {
            chunk[i] = Math.max(-1, Math.min(1, chunk[i]));
        }

        return chunk;
    }
};


// --- MessageBus (The "Kafka" entry point) ---
self.onmessage = async (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                Scheduler.sampleRate = data.sampleRate;
                // No decoding needed in worker anymore
                SampleBank.init(data.samples);
                break;
            
            case 'start':
                if (!SampleBank.isInitialized) {
                   throw new Error("Worker is not initialized with samples yet. Call 'init' first.");
                }
                Scheduler.updateSettings(data);
                Scheduler.start();
                break;

            case 'stop':
                Scheduler.stop();
                break;

            case 'update_settings':
                 Scheduler.updateSettings(data);
                break;
        }
    } catch (e) {
        self.postMessage({ type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
};

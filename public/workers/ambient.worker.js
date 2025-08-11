/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication.
 *
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals (a "tick"),
 *     determines what musical data is needed, and coordinates the other entities.
 *
 * 3.  Instrument Generators (e.g., DrumGenerator, BassGenerator): These are the "composers".
 *     They take musical parameters and return a "score" - a simple array of events.
 *     DrumGenerator returns an audio score to be rendered here.
 *     BassGenerator returns a note score to be rendered by Tone.js on the main thread.
 *
 * 4.  PatternProvider: The "music sheet library". It holds rhythmic and melodic patterns.
 *
 * 5.  AudioRenderer: The "audio engine". Renders drum scores into a raw audio buffer (Float32Array).
 *
 * 6.  SampleBank: A repository for decoded audio samples.
 */

// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0, velocity: 0.7 },
            { sample: 'hat', time: 0.5 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 0.7 },
            { sample: 'hat', time: 2.5 },
            { sample: 'snare', time: 3 },
            { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0, velocity: 0.7 },
            { sample: 'hat', time: 0.5 },
            { sample: 'kick', time: 0.75, velocity: 0.7 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 0.7 },
            { sample: 'snare', time: 2.5 },
            { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 },
            { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0, velocity: 0.6 },
            { sample: 'hat', time: 1 },
            { sample: 'snare', time: 2 },
            { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 0.8 },
            { sample: 'ride', time: 0.5 },
            { sample: 'snare', time: 1, velocity: 1.0 },
            { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 0.8 },
            { sample: 'ride', time: 2.5 },
            { sample: 'snare', time: 3, velocity: 1.0 },
            { sample: 'ride', time: 3.5 },
        ],
    },
    getDrumPattern(name) {
        const pattern = this.drumPatterns[name] || this.drumPatterns.basic;
        return pattern.map(note => ({...note, velocity: note.velocity ?? 1.0}));
    },
    bassPatterns: {
        // Defines the root note for each bar for different drum patterns
        basic: ['E1', 'A1', 'C2', 'G1'],
        breakbeat: ['E1', 'E1', 'A1', 'G1'],
        slow: ['E1', 'A1', 'C2', 'G1'],
        heavy: ['E1', 'E1', 'E1', 'E1'],
    },
    getBassPattern(drumPatternName, barNumber) {
        const pattern = this.bassPatterns[drumPatternName] || this.bassPatterns.basic;
        return pattern[barNumber % pattern.length];
    }
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName, barNumber, totalBars, beatsPerBar = 4) {
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
     static createScore(drumPatternName, barNumber, beatsPerBar = 4) {
        const rootNote = PatternProvider.getBassPattern(drumPatternName, barNumber);
        
        // Simple bassline: root note on the first beat of the bar, plus one syncopated note
        const score = [
            { note: rootNote, time: 0, duration: beatsPerBar / 2, velocity: 0.6 },
            { note: rootNote, time: beatsPerBar - 1.5, duration: 0.5, velocity: 0.4 }
        ];
        return score;
    }
}


// --- 3. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {},
    isInitialized: false,

    init(samples) {
        this.samples = samples;
        this.isInitialized = true;
        console.log("SampleBank Initialized with samples:", Object.keys(this.samples));
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
    
    // Settings from main thread
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
            const oldBarDuration = this.barDuration;
            this.bpm = settings.bpm;
            if (this.isRunning) {
                const newBarDuration = this.barDuration;
                // If BPM changes, we need to restart the interval to match the new timing
                clearInterval(this.intervalId);
                this.intervalId = setInterval(() => this.tick(), newBarDuration * 1000);
            }
        }
    },

    tick() {
        if (!this.isRunning) return;

        // 1. Generate Drum Score & Render Audio
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount,
                -1 // totalBars not needed for this simple generator
            );
            const audioChunk = AudioRenderer.render(drumScore, {
                duration: this.barDuration,
                volume: this.drumSettings.volume
            }, this.sampleRate);
            
            self.postMessage({
                type: 'chunk',
                data: {
                    chunk: audioChunk,
                    duration: this.barDuration,
                }
            }, [audioChunk.buffer]);
        }
        
        // 2. Generate Bass Score & Post to Main Thread
        if (this.instruments.bass === 'bass synth') {
            const bassScore = BassGenerator.createScore(this.drumSettings.pattern, this.barCount);
            // We need to add the bar's start time offset to each note
            const now = 0; // The 'now' for this chunk is its beginning
            const timedBassScore = bassScore.map(note => ({
                ...note,
                time: now + (note.time * this.secondsPerBeat)
            }));
            self.postMessage({
                type: 'bass_score',
                data: { score: timedBassScore }
            });
        }
        
        this.barCount++;
    }
};


// --- MessageBus (The "Kafka" entry point) ---
self.onmessage = async (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                Scheduler.sampleRate = data.sampleRate;
                SampleBank.init(data.samples);
                self.postMessage({ type: 'initialized' });
                break;
            
            case 'start':
                if (!Sample.isInitialized) {
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


/**
 * @file AuraGroove Ambient Music Worker
 * This worker operates on a microservice-style architecture.
 * It is responsible for all heavy-lifting music generation logic,
 * freeing up the main UI thread.
 *
 * It does NOT use Tone.js or any other large libraries directly.
 * All operations are based on native Web APIs and manual audio processing.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication with the main thread.
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals
 *     and directs the flow of music generation.
 * 3.  Instrument Generators (DrumGenerator, BassGenerator): These are the "composers".
 *     They return a "score" - a simple array of note events.
 * 4.  PatternProvider: The "music sheet library". A data store for patterns.
 * 5.  AudioRenderer: The "audio engine". Its ONLY job is to take a drum score
 *     and render it into a raw audio buffer (Float32Array).
 * 6.  SampleBank: A repository for decoded audio samples, ready for the AudioRenderer.
 */

// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0, velocity: 0.8 },
            { sample: 'hat', time: 0.5 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 0.8 },
            { sample: 'hat', time: 2.5 },
            { sample: 'snare', time: 3 },
            { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0, velocity: 0.8 },
            { sample: 'hat', time: 0.5 },
            { sample: 'kick', time: 0.75, velocity: 0.7 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 0.8 },
            { sample: 'snare', time: 2.5 },
            { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 },
            { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0, velocity: 0.8 },
            { sample: 'hat', time: 1 },
            { sample: 'snare', time: 2 },
            { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 0.9 },
            { sample: 'ride', time: 0.5 },
            { sample: 'snare', time: 1, velocity: 1.0 },
            { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 0.9 },
            { sample: 'ride', time: 2.5 },
            { sample: 'snare', time: 3, velocity: 1.0 },
            { sample: 'ride', time: 3.5 },
        ],
    },
    getDrumPattern(name) {
        const pattern = this.drumPatterns[name] || this.drumPatterns.basic;
        // Return a copy to prevent mutation
        return pattern.map(p => ({...p})); 
    },
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName, barNumber, totalBars, beatsPerBar = 4) {
        const pattern = PatternProvider.getDrumPattern(patternName);

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber > 0 && barNumber % 4 === 0) {
            // Remove any other drum hit at time 0 to avoid conflict
            const score = pattern.filter(note => note.time !== 0);
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
            return score;
        }
        
        return pattern;
    }
}

class BassGenerator {
     static createScore(rootNote = 'E', beatsPerBar = 4) {
        // Simple bassline: root note on the first beat of the bar
        const score = [
            { note: `${rootNote}1`, time: 0, duration: beatsPerBar, velocity: 0.9 }
        ];
        return score;
    }
}


// --- 3. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {}, // { kick: Float32Array, snare: Float32Array, ... }
    isInitialized: false,

    // Samples are now decoded on the main thread and sent here
    init(samples) {
        this.samples = samples;
        this.isInitialized = true;
        console.log("SampleBank Initialized in worker with samples:", Object.keys(this.samples));
        // Signal that the worker is ready
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

            // Ensure we don't write past the end of the chunk buffer
            const endSample = Math.min(startSample + sample.length, totalSamples);
            
            for (let i = 0; i < (endSample - startSample); i++) {
                // Simple mixing by adding samples
                if (startSample + i < chunk.length) {
                    chunk[startSample + i] += sample[i] * finalVolume;
                }
            }
        }
        
        // Basic clipping prevention (limiter)
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
    bpm: 100,
    instruments: {},
    drumSettings: {},

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start(initialSettings) {
        if (this.isRunning) return;

        this.updateSettings(initialSettings);
        this.reset();
        this.isRunning = true;
        
        // Generate the first chunk immediately
        this.tick();

        // Then set up the interval for subsequent chunks
        // We use a shorter, more reliable interval and check the time
        this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
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
        if (settings.bpm) this.bpm = settings.bpm;
    },

    tick() {
        if (!this.isRunning) return;
        
        // --- Generate Drum Score and render audio ---
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
        
        // --- Generate Bass Score and post it ---
        if (this.instruments.bass === 'bass synth') {
            const bassScore = BassGenerator.createScore('E', this.beatsPerBar);
            // Post the score, not the audio. The main thread will synthesize it.
            self.postMessage({
                type: 'bass_score',
                data: { score: bassScore }
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
                // Samples are now passed directly as Float32Arrays
                SampleBank.init(data.samples);
                break;
            
            case 'start':
                if (!SampleBank.isInitialized) {
                   throw new Error("Worker is not initialized with samples yet. Call 'init' first.");
                }
                Scheduler.start(data);
                self.postMessage({ type: 'started' });
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

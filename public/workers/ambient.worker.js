/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 */

// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: {
            score: [
                { sample: 'kick', time: 0 },
                { sample: 'hat', time: 0.5 },
                { sample: 'snare', time: 1 },
                { sample: 'hat', time: 1.5 },
                { sample: 'kick', time: 2 },
                { sample: 'hat', time: 2.5 },
                { sample: 'snare', time: 3 },
                { sample: 'hat', time: 3.5 },
            ],
            kickVolume: 0.3,
        },
        breakbeat: {
            score: [
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
            kickVolume: 0.3,
        },
        slow: {
            score: [
                { sample: 'kick', time: 0 },
                { sample: 'hat', time: 1 },
                { sample: 'snare', time: 2 },
                { sample: 'hat', time: 3 },
            ],
            kickVolume: 0.3,
        },
        heavy: {
             score: [
                { sample: 'kick', time: 0, velocity: 1.0 },
                { sample: 'ride', time: 0.5 },
                { sample: 'snare', time: 1, velocity: 1.0 },
                { sample: 'ride', time: 1.5 },
                { sample: 'kick', time: 2, velocity: 1.0 },
                { sample: 'ride', time: 2.5 },
                { sample: 'snare', time: 3, velocity: 1.0 },
                { sample: 'ride', time: 3.5 },
            ],
            kickVolume: 0.3,
        },
    },
    getDrumPattern(name) {
       const patternData = this.drumPatterns[name] || this.drumPatterns.basic;
       // Set default velocity and apply specific kick volume
        return patternData.score.map(note => ({
            ...note,
            velocity: note.velocity ?? 1.0,
            volume: note.sample === 'kick' ? patternData.kickVolume : 1.0,
        }));
    },
     bassPatterns: {
        // Bass will follow the kick drum pattern
        fromKick(drumPattern) {
            return drumPattern
                .filter(note => note.sample === 'kick')
                .map(note => ({
                    sample: 'bass', // We'll map this to a sample in the renderer
                    time: note.time,
                    velocity: 0.8, // Bass is a bit quieter
                    volume: 1.0
                }));
        }
    }
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber % 4 === 0) {
            // Remove any other drum hit at time 0 to avoid conflict
            score = score.filter(note => note.time !== 0);
            score.unshift({ sample: 'crash', time: 0, velocity: 0.8, volume: 1.0 });
        }
        
        return score;
    }
}

class BassGenerator {
     static createScore(drumPatternName) {
        // The bass line is derived from the rhythm of the selected drum pattern
        const drumPattern = PatternProvider.getDrumPattern(drumPatternName);
        return PatternProvider.bassPatterns.fromKick(drumPattern);
    }
}


// --- 3. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {}, // { kick: Float32Array, snare: Float32Array, ... }
    isInitialized: false,

    init(decodedSamples) {
        this.samples = decodedSamples;
        // As a placeholder, let's use the kick for the bass sound
        if (this.samples.kick) {
            this.samples.bass = this.samples.kick;
        }
        this.isInitialized = true;
        console.log("SampleBank Initialized with samples:", Object.keys(this.samples));
        self.postMessage({ type: 'initialized' });
    },

    getSample(name) {
        return this.samples[name];
    }
};


// --- 4. AudioRenderer (The Sound Engine) ---
const AudioRenderer = {
    render(scores, settings, sampleRate) {
        const { duration, volume } = settings;
        const totalSamples = Math.floor(duration * sampleRate);
        const chunk = new Float32Array(totalSamples).fill(0);

        for (const note of scores.flat()) {
            const sample = SampleBank.getSample(note.sample);
            if (!sample) continue;

            const noteVelocity = note.velocity ?? 1.0;
            const noteVolume = note.volume ?? 1.0;
            const finalVolume = volume * noteVelocity * noteVolume;
            
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
        
        // Basic clipping prevention
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

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;
        
        // Generate the first chunk immediately
        this.tick();

        // Then set up the interval for subsequent chunks
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
        if(settings.bpm) this.bpm = settings.bpm;
    },

    tick() {
        if (!this.isRunning) return;

        const scores = [];
        
        // 1. Ask generators for their scores
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount
            );
            scores.push(drumScore);
        }
        
        if (this.instruments.bass === 'bass guitar') {
            const bassScore = BassGenerator.createScore(this.drumSettings.pattern);
            scores.push(bassScore);
        }

        // 2. Pass the final score to the renderer
        const audioChunk = AudioRenderer.render(scores, {
            duration: this.barDuration,
            volume: this.drumSettings.volume // Use a global volume for now
        }, this.sampleRate);
        
        // 3. Post the rendered chunk to the main thread
        self.postMessage({
            type: 'chunk',
            data: {
                chunk: audioChunk,
                duration: this.barDuration,
            }
        }, [audioChunk.buffer]);

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

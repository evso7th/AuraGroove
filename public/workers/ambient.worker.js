
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 */
// Load Tone.js directly into the worker's scope
try {
    importScripts('https://unpkg.com/tone@15.0.4/build/Tone.js');
} catch (e) {
    console.error("Failed to load Tone.js", e);
    // Post an error back to the main thread if Tone.js fails to load
    self.postMessage({ type: 'error', error: 'Failed to load Tone.js in worker.' });
}


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
    static createScore(patternName, barNumber, totalBars, beatsPerBar = 4) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber % 4 === 0) {
            // Remove any other drum hit at time 0 to avoid conflict
            score = score.filter(note => note.time !== 0);
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        
        return score;
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

    async init(samples, sampleRate) {
        // Use the global OfflineAudioContext available after importing Tone.js
        console.log("OfflineAudioContext is defined:", typeof OfflineAudioContext !== 'undefined');
        
        for (const key in samples) {
            if (samples[key] && samples[key].byteLength > 0) {
                 try {
                    const audioBuffer = await Tone.context.decodeAudioData(samples[key].slice(0));

                    // Add type checking
                    if (!(audioBuffer instanceof Tone.Buffer)) {
                        console.error(`Decoded data for sample ${key} is not a Tone.Buffer. Type received:`, typeof audioBuffer, audioBuffer);
                        throw new Error(`Decoded data for sample ${key} is not a Tone.Buffer.`);
                    }
                    
                    // Use the correct method for Tone.Buffer
                    this.samples[key] = audioBuffer.get();

                } catch(e) {
                    console.error(`Detailed decoding error for sample ${key}:`, e); // Detailed error logging
                    self.postMessage({ type: 'error', error: `Failed to decode sample ${key}: ${e instanceof Error ? e.message : String(e)}` });
                }
            }
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

        let finalScore = [];
        
        // 1. Ask generators for their scores
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount,
                -1 // totalBars not needed for this simple generator
            );
            finalScore.push(...drumScore);
        }
        
        // 2. Pass the final score to the renderer
        const audioChunk = AudioRenderer.render(finalScore, {
            duration: this.barDuration,
            volume: this.drumSettings.volume
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
                if (typeof Tone === 'undefined') {
                    throw new Error("Tone.js is not loaded in the worker.");
                }
                Scheduler.sampleRate = data.sampleRate;
                // Don't message 'initialized' from here, let SampleBank do it.
                await SampleBank.init(data.samples, data.sampleRate);
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

    
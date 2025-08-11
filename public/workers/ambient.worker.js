/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 */

// Polyfill for OfflineAudioContext
const OfflineAudioContext = self.OfflineAudioContext || self.webkitOfflineAudioContext;

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

// --- 3. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {},
    isInitialized: false,

    async init(samples, sampleRate) {
        if (!OfflineAudioContext) {
             self.postMessage({ type: 'error', error: 'OfflineAudioContext is not supported in this worker environment.' });
             return;
        }
        const tempAudioContext = new OfflineAudioContext(1, 1, sampleRate);
        for (const key in samples) {
            if (samples[key] && samples[key].byteLength > 0) {
                try {
                    const audioBuffer = await tempAudioContext.decodeAudioData(samples[key].slice(0));
                    this.samples[key] = audioBuffer.getChannelData(0);
                } catch(e) {
                    self.postMessage({ type: 'error', error: `Failed to decode sample ${key}: ${e instanceof Error ? e.message : String(e)}` });
                }
            }
        }
        this.isInitialized = true;
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
        if (settings.bpm) this.bpm = settings.bpm;
    },

    tick() {
        if (!this.isRunning) return;

        let finalScore = [];
        
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount
            );
            finalScore.push(...drumScore);
        }

        const audioChunk = AudioRenderer.render(finalScore, {
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

        this.barCount++;
    }
};

// --- MessageBus (The entry point) ---
self.onmessage = async (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                Scheduler.sampleRate = data.sampleRate;
                await SampleBank.init(data.samples, data.sampleRate);
                break;
            
            case 'start':
                if (!SampledBank.isInitialized) {
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

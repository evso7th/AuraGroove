/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication between the main thread and the worker.
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals,
 *     determines what musical data is needed, and coordinates the other entities.
 * 3.  Instrument Generators: These are the "composers". They return a "score" - an
 *     array of note events.
 * 4.  PatternProvider: The "music sheet library". A simple data store.
 * 5.  AudioRenderer: The "audio engine". Its ONLY job is to take a score and
 *     render it into a raw audio buffer (Float32Array).
 * 6.  SampleBank: A repository for decoded audio samples.
 *
 * This architecture ensures that changing a drum pattern CANNOT break the audio renderer,
 * and changing the audio renderer CANNOT break the musical logic.
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
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 },
            { sample: 'kick', time: 0.75 }, { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 }, { sample: 'kick', time: 2 },
            { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 }, { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 1 },
            { sample: 'snare', time: 2 },
            { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 },
            { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 },
            { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ],
    },
    getDrumPattern(name: string) {
        return this.drumPatterns[name as keyof typeof this.drumPatterns] || this.drumPatterns.basic;
    },
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName: string, barNumber: number) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber > 0 && barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0); // Remove other hits at time 0
            score.unshift({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        
        return score;
    }
}

// --- 3. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {} as Record<string, { buffer: Float32Array, sampleRate: number }>,
    isInitialized: false,

    async init(sampleUrls: Record<string, string>, targetSampleRate: number) {
        if (this.isInitialized) return;

        // This works because we are in a worker context where OfflineAudioContext is available.
        const tempAudioContext = new OfflineAudioContext(1, 1, targetSampleRate);
        for (const key in sampleUrls) {
            try {
                const response = await fetch(sampleUrls[key]);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                if (arrayBuffer.byteLength === 0) continue;
                
                const decodedBuffer = await tempAudioContext.decodeAudioData(arrayBuffer);
                this.samples[key] = {
                    buffer: decodedBuffer.getChannelData(0),
                    sampleRate: decodedBuffer.sampleRate,
                };

            } catch(e) {
                const errorMessage = e instanceof Error ? e.message : String(e);
                self.postMessage({ type: 'error', error: `Failed to fetch/decode sample ${key}: ${errorMessage}` });
                return;
            }
        }
        this.isInitialized = true;
        self.postMessage({ type: 'initialized' });
        console.log("SampleBank Initialized with samples:", Object.keys(this.samples));
    },

    getSample(name: string) {
        return this.samples[name];
    }
};

// --- 4. AudioRenderer (The Sound Engine) ---
const AudioRenderer = {
    render(score: any[], settings: { duration: number, volume: number }, renderSampleRate: number) {
        const { duration, volume } = settings;
        const totalSamples = Math.floor(duration * renderSampleRate);
        const chunk = new Float32Array(totalSamples).fill(0);

        for (const note of score) {
            const sampleData = SampleBank.getSample(note.sample);
            if (!sampleData) continue;

            const { buffer: sampleBuffer } = sampleData;
            const noteVelocity = note.velocity ?? 1.0;
            const finalVolume = volume * noteVelocity;
            
            const startSample = Math.floor(note.time * (60 / Scheduler.bpm) * renderSampleRate);

            const endSample = Math.min(startSample + sampleBuffer.length, totalSamples);
            
            for (let i = 0; i < (endSample - startSample); i++) {
                if (startSample + i < chunk.length) {
                    chunk[startSample + i] += sampleBuffer[i] * finalVolume;
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
    intervalId: null as any,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    sampleRate: 44100,
    bpm: 100,
    drumSettings: { enabled: true, pattern: 'basic', volume: 0.7 } as any,
    instruments: {} as any,

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
        
        const tick = () => {
            if (!this.isRunning) return;
            this.generateAndPostChunk();
            // Schedule the next tick precisely
            this.intervalId = setTimeout(tick, this.barDuration * 1000);
        };
        tick();

        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        clearTimeout(this.intervalId);
        this.intervalId = null;
        this.isRunning = false;
        self.postMessage({ type: 'stopped' });
    },

    reset() {
        this.barCount = 0;
    },
    
    updateSettings(settings: any) {
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.bpm) {
            this.bpm = settings.bpm;
            // If running, we need to restart the loop to apply the new BPM
            if (this.isRunning) {
                this.stop();
                this.start();
            }
        }
    },

    generateAndPostChunk() {
        let finalScore: any[] = [];
        
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount,
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
                sampleRate: this.sampleRate,
            }
        }, [audioChunk.buffer]);

        this.barCount++;
    }
};


// --- MessageBus (The entry point) ---
self.onmessage = async (event: MessageEvent) => {
    const { command, data } = event.data;
    
    try {
        switch (command) {
            case 'init':
                Scheduler.sampleRate = data.sampleRate;
                await SampleBank.init(data.sampleUrls, data.sampleRate);
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
        self.postMessage({ type: 'error', error: e instanceof Error ? e.message : String(e)} );
    }
};

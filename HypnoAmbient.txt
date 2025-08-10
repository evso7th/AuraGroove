/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture, inspired by the user's feedback.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  MessageBus (self): The "Kafka" of the worker. Handles all communication
 *     between the main thread and the worker's internal systems.
 *
 * 2.  Scheduler: The central "conductor" or "event loop". It wakes up at regular
 *     intervals, determines what musical data is needed, and coordinates the other
 *     entities. It doesn't generate music itself, only directs the flow.
 *
 * 3.  Instrument Generators (e.g., DrumGenerator, BassGenerator): These are the "composers".
 *     They take a time signature and a pattern name and return a "score" - a simple
 *     array of note events (`{ time, sample, velocity }`). They are stateless and
 *     know nothing about audio rendering.
 *
 * 4.  PatternProvider: The "music sheet library". It holds all rhythmic and melodic
 *     patterns. It's a simple data store that the Instrument Generators query.
 *
 * 5.  AudioRenderer: The "audio engine". Its ONLY job is to take a score (from any
 *     generator) and "render" it into a raw audio buffer (Float32Array). It handles
 *     mixing, volume, and sample placement. It is completely decoupled from musical logic.
 *
 * 6.  SampleBank: A repository for decoded audio samples, ensuring they are ready for
 *     the AudioRenderer to use instantly.
 *
 * Data Flow on Start:
 * - Main thread sends 'init' with samples and sampleRate.
 * - Worker decodes samples into SampleBank.
 * - Main thread sends 'start' with instrument/drum settings.
 * - Scheduler starts its loop.
 * - In each loop:
 *   - Scheduler asks the appropriate generators for their scores for the next time slice.
 *   - Generators ask PatternProvider for their patterns.
 *   - Generators create their scores and return them to the scheduler.
 *   - Scheduler passes all scores to the AudioRenderer.
 *   - AudioRenderer creates a blank audio chunk, "paints" the samples from each score onto it, and returns the mixed chunk.
 *   - Scheduler posts the final audio chunk back to the main thread.
 *
 * This architecture ensures that changing a drum pattern CANNOT break the audio renderer,
 * and changing the audio renderer CANNOT break the musical logic. Each part is
 * independent, testable, and replaceable, following the user's core architectural principle.
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
    getDrumPattern(name: string) {
        return this.drumPatterns[name as keyof typeof this.drumPatterns] || this.drumPatterns.basic;
    },
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName: string, barNumber: number, totalBars: number, beatsPerBar = 4) {
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
    samples: {} as Record<string, Float32Array>, // { kick: Float32Array, snare: Float32Array, ... }
    isInitialized: false,

    async init(samples: Record<string, ArrayBuffer>, sampleRate: number) {
        const tempAudioContext = new OfflineAudioContext(1, 1, sampleRate);
        for (const key in samples) {
            if (samples[key].byteLength > 0) {
                try {
                    const audioBuffer = await tempAudioContext.decodeAudioData(samples[key].slice(0));
                    this.samples[key] = audioBuffer.getChannelData(0);
                } catch(e) {
                    // post error back to main thread
                    self.postMessage({ type: 'error', error: `Failed to decode sample ${key}: ${e instanceof Error ? e.message : String(e)}` });
                }
            }
        }
        this.isInitialized = true;
        console.log("SampleBank Initialized with samples:", Object.keys(this.samples));
    },

    getSample(name: string) {
        return this.samples[name];
    }
};


// --- 4. AudioRenderer (The Sound Engine) ---
const AudioRenderer = {
    render(score: any[], settings: { duration: number, volume: number }, sampleRate: number) {
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
    intervalId: null as any,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    sampleRate: 44100,
    bpm: 120,
    instruments: {} as any,
    drumSettings: {} as any,

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
    },

    reset() {
        this.barCount = 0;
    },
    
    updateSettings(settings: any) {
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if(settings.bpm) this.bpm = settings.bpm;
    },

    tick() {
        if (!this.isRunning) return;

        let finalScore: any[] = [];
        
        // 1. Ask generators for their scores
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount,
                -1 // totalBars not needed for this simple generator
            );
            finalScore.push(...drumScore);
        }
        
        // Add other instrument generators here (bass, solo, etc.) in the future
        // For now, bass is conceptual
        // if (this.instruments.bass !== 'none') {
        //     const bassScore = BassGenerator.createScore('E');
        //     // We would need a synth renderer for this, not a sample renderer
        // }


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
self.onmessage = async (event: MessageEvent) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                Scheduler.sampleRate = data.sampleRate;
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
            
            case 'set_instruments':
                Scheduler.updateSettings({ instruments: data });
                break;

            case 'set_drums':
                 Scheduler.updateSettings({ drumSettings: data });
                break;
        }
    } catch (e) {
        self.postMessage({ type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
};
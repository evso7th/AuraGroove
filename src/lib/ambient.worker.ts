
/**
 * @file AuraGroove Ambient Music Worker (Architecture: "Conveyor Belt")
 *
 * This worker is the "Master of Time" and the "Sound Factory".
 * It is responsible for all composition and offline rendering of audio.
 * It uses its own internal, high-precision loop and sends ready-to-play
 * audio buffers to the main thread, ensuring the UI remains perfectly smooth.
 */

// Make TypeScript aware of the global Tone object from importScripts
declare const Tone: any;

// --- 1. Audio Renderer & Sample Bank ---

const SampleBank = {
    samples: {} as Record<string, any>, // { kick: Tone.Buffer, snare: Tone.Buffer, ... }
    isReady: false,
    async init(sampleMap: Record<string, string>) {
        return new Promise<void>((resolve, reject) => {
            this.samples = new Tone.Players(sampleMap, () => {
                this.isReady = true;
                console.log('[WORKER] SampleBank Initialized.');
                resolve();
            }).toDestination(); // We have to connect it to something, even in Offline
        });
    },
    getSampler() {
        return this.samples;
    }
};

const AudioRenderer = {
    async render(score: any, settings: { duration: number, sampleRate: number }): Promise<Float32Array> {
        if (!SampleBank.isReady) {
             console.warn('[WORKER] AudioRenderer: SampleBank not ready, returning empty chunk.');
             return new Float32Array(0);
        }
        
        try {
            const buffer = await Tone.Offline(() => {
                // In offline context, we create temporary instruments
                const bassSynth = new Tone.MonoSynth({
                    portamento: 0.08,
                    oscillator: { type: 'fmsine' },
                    envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 1.0 },
                    filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 1.5, baseFrequency: 200, octaves: 6 }
                }).toDestination();

                // Schedule bass notes
                score.bassScore.forEach((note: any) => {
                    bassSynth.triggerAttackRelease(note.note, note.duration, note.time, note.velocity);
                });

                // Schedule drum samples
                 const sampler = SampleBank.getSampler();
                 score.drumScore.forEach((note: any) => {
                     if (sampler.has(note.sample)) {
                        sampler.player(note.sample).start(note.time).stop(note.time + 0.5);
                     }
                 });

            }, settings.duration, 1, settings.sampleRate);
            
            return buffer.getChannelData(0);

        } catch (e) {
            console.error('[WORKER] AudioRenderer failed:', e);
            self.postMessage({ type: 'error', error: `Audio rendering failed: ${e instanceof Error ? e.message : String(e)}` });
            return new Float32Array(0);
        }
    }
};

// --- 2. Composer ---

class Composer {
    private chordProgression: { root: string; notes: string[] }[];
    
    constructor() {
        this.chordProgression = [
            { root: 'C2', notes: ['C3', 'E3', 'G3'] },
            { root: 'A1', notes: ['A2', 'C3', 'E3'] },
            { root: 'F1', notes: ['F2', 'A2', 'C3'] },
            { root: 'G1', notes: ['G2', 'B2', 'D3'] },
        ];
    }
    
    createScoreForNextBar(barNumber: number, settings: any) {
        const { drumSettings, instrumentSettings } = settings;
        const currentChord = this.chordProgression[Math.floor(barNumber / 2) % this.chordProgression.length];

        const bassScore = [];
        if (instrumentSettings.bass.name !== 'none' && barNumber % 2 === 0) {
             bassScore.push({
                note: currentChord.root,
                duration: '2m', // 2 measures long
                time: 0,
                velocity: instrumentSettings.bass.volume ?? 0.7
            });
        }
        
        const drumScore = [];
        if (drumSettings.enabled && drumSettings.pattern === 'ambient_beat') {
            drumScore.push({ sample: 'kick', time: 0, velocity: 0.9 * drumSettings.volume });
            drumScore.push({ sample: 'hat', time: 1.5, velocity: 0.3 * drumSettings.volume });
            drumScore.push({ sample: 'snare', time: 2.0, velocity: 0.7 * drumSettings.volume });
            drumScore.push({ sample: 'hat', time: 3.5, velocity: 0.3 * drumSettings.volume });
        }

        return { bassScore, drumScore };
    }
}


// --- 3. Scheduler (The Conductor) ---

const Scheduler = {
    loopId: null as any,
    isRunning: false,
    barCount: 0,
    composer: new Composer(),
    
    settings: {
        bpm: 75,
        sampleRate: 44100, // Default, will be updated from main thread
        drumSettings: { pattern: 'ambient_beat', volume: 0.5, enabled: true },
        instrumentSettings: { bass: { name: "portamento", volume: 0.45 } },
    } as any,

    get barDuration() { 
        return (60 / this.settings.bpm) * 4; // 4 beats per bar
    },

    start() {
        if (this.isRunning) return;
        console.log('[WORKER] Scheduler starting...');
        this.isRunning = true;
        this.barCount = 0;
        
        // High-precision loop using timeout chaining
        const loop = () => {
            if (!this.isRunning) return;
            this.tick();
            this.loopId = setTimeout(loop, this.barDuration * 1000);
        };
        
        // Start the first tick immediately
        loop();
        self.postMessage({ type: 'worker_started' });
    },

    stop() {
        if (!this.isRunning) return;
        console.log('[WORKER] Scheduler stopping...');
        this.isRunning = false;
        if (this.loopId) {
            clearTimeout(this.loopId);
            this.loopId = null;
        }
    },
    
    updateSettings(settings: any) {
        // A simple merge, more specific logic can be added
        if (settings.bpm) this.settings.bpm = settings.bpm;
        if (settings.drumSettings) this.settings.drumSettings = {...this.settings.drumSettings, ...settings.drumSettings};
        if (settings.instrumentSettings) this.settings.instrumentSettings = {...this.settings.instrumentSettings, ...settings.instrumentSettings};
    },

    async tick() {
        if (!this.isRunning) return;
        
        const score = this.composer.createScoreForNextBar(this.barCount, this.settings);
        
        const audioChunk = await AudioRenderer.render(score, {
            duration: this.barDuration,
            sampleRate: this.settings.sampleRate
        });

        if (audioChunk.length > 0) {
             self.postMessage({
                type: 'audio_chunk',
                data: {
                    chunk: audioChunk,
                    duration: this.barDuration,
                }
            }, [audioChunk.buffer] as any); // Transfer the buffer
        }

        this.barCount++;
    }
};

// --- MessageBus (The entry point) ---

self.onmessage = async (event: MessageEvent) => {
    if (!event.data || !event.data.command) return;
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                self.postMessage({ type: 'log', message: 'Worker received init command.' });
                // Load Tone.js library
                importScripts('/assets/vendor/tone/Tone.js');
                self.postMessage({ type: 'log', message: 'Tone.js loaded.' });
                
                Scheduler.settings.sampleRate = data.sampleRate;
                
                // Initialize SampleBank
                await SampleBank.init({
                    'kick': '/assets/drums/kick_drum6.wav',
                    'snare': '/assets/drums/snare.wav',
                    'hat': '/assets/drums/closed_hi_hat_accented.wav',
                });

                self.postMessage({ type: 'worker_ready' });
                break;
            
            case 'start':
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

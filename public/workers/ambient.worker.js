
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 */

// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    compositions: {
        slowAmbientIntro: {
            durationBars: 6, // Total length of the intro
            parts: {
                solo: [
                    // Starts at bar 0
                    { bar: 0, notes: [{ notes: ['C4', 'E4', 'G4'], time: '0:0', duration: '1m' }] },
                    { bar: 1, notes: [{ notes: ['D4', 'F4', 'A4'], time: '0:0', duration: '1m' }] },
                    { bar: 2, notes: [{ notes: ['E4', 'G4', 'B4'], time: '0:0', duration: '1m' }] },
                    { bar: 3, notes: [{ notes: ['F4', 'A4', 'C5'], time: '0:0', duration: '1m' }] },
                    { bar: 4, notes: [{ notes: ['G4', 'B4', 'D5'], time: '0:0', duration: '1m' }] },
                    { bar: 5, notes: [{ notes: ['A4', 'C5', 'E5'], time: '0:0', duration: '1m' }] },
                ],
                bass: [
                    // Starts at bar 1
                    { bar: 1, notes: [{ note: 'C2', time: '0:0', duration: '1m', velocity: 0.7 }] },
                    { bar: 2, notes: [{ note: 'E2', time: '0:0', duration: '1m', velocity: 0.7 }] },
                    { bar: 3, notes: [{ note: 'F2', time: '0:0', duration: '1m', velocity: 0.7 }] },
                    { bar: 4, notes: [{ note: 'G2', time: '0:0', duration: '1m', velocity: 0.7 }] },
                    { bar: 5, notes: [{ note: 'A2', time: '0:0', duration: '1m', velocity: 0.7 }] },
                ],
                drums: [
                     // Starts at bar 2 with progressive parts
                    { bar: 2, notes: [{ sample: 'hat', time: 0 }, { sample: 'hat', time: 0.5 }] }, // Intro hats
                    { bar: 3, notes: [{ sample: 'kick', time: 0 }, { sample: 'ride', time: 0.5 }] }, // Intro kick & ride
                    { bar: 4, notes: [{ sample: 'snare', time: 0.5 }, { sample: 'snare', time: 0.75 }] }, // Intro fill
                    { bar: 5, notes: [ // Main pattern starts
                         { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 },
                         { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 }
                    ] },
                ]
            }
        }
    },
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 },
            { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 },
            { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'kick', time: 0.75 },
            { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 }, { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 }, { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 },
            { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 },
            { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 },
            { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ],
    },
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
    getComposition(name) {
        return this.compositions[name];
    }
};

// --- 2. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {},
    isInitialized: false,

    async init(samples, sampleRate) {
        this.isInitialized = false;
        const tempAudioContext = new OfflineAudioContext(1, 1, sampleRate);
        const decodePromises = Object.entries(samples).map(async ([key,-
        value]) => {
            if (value.byteLength > 0) {
                try {
                    const audioBuffer = await tempAudioContext.decodeAudioData(value.slice(0));
                    this.samples[key] = audioBuffer.getChannelData(0);
                } catch (e) {
                    self.postMessage({ type: 'error', error: `Failed to decode sample ${key}: ${e instanceof Error ? e.message : String(e)}` });
                }
            }
        });
        await Promise.all(decodePromises);
        this.isInitialized = true;
        console.log("SampleBank Initialized with samples:", Object.keys(this.samples));
    },

    getSample(name) {
        return this.samples[name];
    }
};


// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    sampleRate: 44100,
    bpm: 100,
    instruments: {},
    drumSettings: {},
    compositionName: 'slowAmbientIntro', // Default composition

    // Calculated properties
    get beatsPerBar() { return 2; }, // Shortened for faster intro steps
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
        
        // Use a timeout to ensure the scheduler loop starts cleanly
        setTimeout(() => {
            this.tick(); // Generate the first chunk immediately
            this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        }, 0);
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

        const composition = PatternProvider.getComposition(this.compositionName);
        if (!composition) {
            // Future: handle what happens after the intro
            // For now, let's just loop the intro for testing
             if (this.barCount >= composition.durationBars) {
                this.barCount = 0; // Loop the intro
            }
            // this.stop();
            // self.postMessage({ type: 'error', error: `Composition ${this.compositionName} not found.` });
            // return;
        }

        const currentBar = this.barCount % composition.durationBars;
        
        // Find parts for the current bar
        for (const [instrument, part] of Object.entries(composition.parts)) {
            const notesForBar = part.find(p => p.bar === currentBar);
            if (notesForBar && notesForBar.notes.length > 0) {
                 if (instrument === 'drums' && !this.drumSettings.enabled) continue;
                 if (instrument === 'bass' && this.instruments.bass === 'none') continue;
                 if (instrument === 'solo' && this.instruments.solo === 'none') continue;

                 // Post score back to the main thread
                self.postMessage({
                    type: `${instrument}_score`,
                    data: { score: notesForBar.notes }
                });
            }
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
                if (!data || !data.sampleRate || !data.samples) {
                    throw new Error("Initialization failed: invalid data received.");
                }
                Scheduler.sampleRate = data.sampleRate;
                await SampleBank.init(data.samples, data.sampleRate);
                // Correctly send 'initialized' only after await completes.
                self.postMessage({ type: 'initialized' });
                break;
            
            case 'start':
                if (!SampleBank.isInitialized) {
                   throw new Error("Worker is not initialized with samples yet.");
                }
                Scheduler.updateSettings(data);
                Scheduler.start();
                // Moved 'started' message to be sent from the UI thread after it receives 'initialized'
                // and successfully calls Tone.start()
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

    
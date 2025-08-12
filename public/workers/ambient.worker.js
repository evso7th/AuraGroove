
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture. Each musical
 * component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication between the main thread and the worker.
 *
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals, reads a
 *     "composition" from the PatternProvider, and sends the right notes for the
 *     current time slice back to the main thread. It's a "score player".
 *
 * 3.  PatternProvider: The "music sheet library". It holds all rhythmic and melodic
 *     patterns, but more importantly, it defines entire "compositions" which are
 *     sequences of musical parts for all instruments. This is the heart of the
 *     musical logic.
 *
 * 4.  Generators (DrumGenerator, BassGenerator, etc.): These are now stateless utility
 *     functions that might be used to create complex patterns *within* a composition
 *     definition, but are no longer called on every tick by the scheduler.
 *
 * Data Flow on Start:
 * - Main thread sends 'start' with instrument/drum settings.
 * - Scheduler starts its loop.
 * - In each loop ('tick'):
 *   - Scheduler gets the current 'bar' number.
 *   - It asks PatternProvider for the notes corresponding to that bar number from the active composition.
 *   - It finds parts for solo, bass, and drums for the current bar.
 *   - It posts the notes for each instrument back to the main thread in separate messages.
 *
 * This architecture makes the system highly modular. To create a new song structure,
 * one only needs to add a new composition to the PatternProvider.
 */


// --- 1. PatternProvider (The Music Sheet and Composition Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 0.5 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 0.5 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.25 },
        ],
        slow: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 1 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 },
            { sample: 'ride', time: 0.5 },
            { sample: 'snare', time: 1, velocity: 1.0 },
            { sample: 'ride', time: 1.5 },
        ],
        // --- Intro-specific drum patterns ---
        intro_hats: [
            { sample: 'hat', time: 0 },
            { sample: 'hat', time: 0.5 },
            { sample: 'hat', time: 1 },
            { sample: 'hat', time: 1.5 },
        ],
        intro_kick_ride: [
            { sample: 'kick', time: 0 },
            { sample: 'ride', time: 0.5 },
            { sample: 'kick', time: 1 },
            { sample: 'ride', time: 1.5 },
        ],
        intro_fill: [
            { sample: 'snare', time: 0, velocity: 0.6 },
            { sample: 'hat', time: 0.5, velocity: 0.7 },
            { sample: 'snare', time: 1, velocity: 0.8 },
            { sample: 'snare', time: 1.5, velocity: 0.9 },
        ]
    },

    // --- NEW: Composition Library ---
    compositions: {
        // Our first composition, defining the entire intro sequence.
        slowAmbientIntro: {
            totalBars: 6, // The intro lasts for 6 bars (cycles)
            parts: [
                // Bar 0: Solo enters
                { bar: 0, instrument: 'solo', score: SoloGenerator.createScore({ octaves: [3, 4] }) },
                
                // Bar 1: Bass joins
                { bar: 1, instrument: 'solo', score: SoloGenerator.createScore({ octaves: [3, 4] }) },
                { bar: 1, instrument: 'bass', score: BassGenerator.createScore('E') },
                
                // Bar 2: Hi-hats join
                { bar: 2, instrument: 'solo', score: SoloGenerator.createScore({ octaves: [3, 4] }) },
                { bar: 2, instrument: 'bass', score: BassGenerator.createScore('F#') },
                { bar: 2, instrument: 'drums', score: (settings) => PatternProvider.drumPatterns.intro_hats },
                
                // Bar 3: Kick and Ride join
                { bar: 3, instrument: 'solo', score: SoloGenerator.createScore({ octaves: [3, 4] }) },
                { bar: 3, instrument: 'bass', score: BassGenerator.createScore('B') },
                { bar: 3, instrument: 'drums', score: (settings) => PatternProvider.drumPatterns.intro_kick_ride },
                
                // Bar 4: Drum Fill
                { bar: 4, instrument: 'solo', score: SoloGenerator.createScore({ octaves: [4] }) }, // Higher octave for tension
                { bar: 4, instrument: 'bass', score: BassGenerator.createScore('A') },
                { bar: 4, instrument: 'drums', score: (settings) => PatternProvider.drumPatterns.intro_fill },

                // Bar 5: Main beat starts
                { bar: 5, instrument: 'solo', score: SoloGenerator.createScore({ octaves: [3, 4] }) },
                { bar: 5, instrument: 'bass', score: BassGenerator.createScore('E') },
                { bar: 5, instrument: 'drums', score: (settings) => PatternProvider.drumPatterns[settings.pattern] },
            ]
        }
    },

    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },

    // Helper to get all musical parts for a specific bar in a composition
    getCompositionParts(compositionName, bar, loop = true) {
        const composition = this.compositions[compositionName];
        if (!composition) {
             self.postMessage({ type: 'error', error: `Composition "${compositionName}" not found.` });
             return [];
        }

        let currentBar = bar;
        // If looping, wrap the bar number around the total bars of the composition
        if (loop && bar >= composition.totalBars) {
            // we loop back to the bar after the intro sequence
            const introBars = 5; 
            currentBar = introBars + ((bar - introBars) % (composition.totalBars - introBars));
        }

        // Find all parts scheduled for the current bar
        return composition.parts.filter(part => part.bar === currentBar);
    }
};


// --- 2. Instrument Generators (Stateless "Composer" utilities) ---
class DrumGenerator {
    // This is now mainly for the main loop after the intro, fetched by the composition.
    static createScore(patternName) {
        return PatternProvider.getDrumPattern(patternName);
    }
}

class BassGenerator {
     // A stateless function that returns a simple bassline for a given root note.
     static createScore(rootNote = 'E') {
        return [
            { note: `${rootNote}1`, time: 0, duration: Scheduler.beatsPerBar, velocity: 0.9 },
            { note: `${rootNote}1`, time: 1.5, duration: 0.5, velocity: 0.6 } // Add some variation
        ];
    }
}

class SoloGenerator {
    // A stateless function that creates a semi-random solo pattern.
    static createScore({ octaves = [3, 4] }) {
        const notes = ['C', 'D', 'E', 'F#', 'G', 'A', 'B'];
        const score = [];
        
        const noteCount = Math.random() > 0.6 ? 2 : 1;
        
        for(let i=0; i<noteCount; i++) {
            const randomNote = notes[Math.floor(Math.random() * notes.length)];
            const randomOctave = octaves[Math.floor(Math.random() * octaves.length)];
            const randomTime = Math.random() * (Scheduler.beatsPerBar - 1); // Ensure it fits in the bar
            const randomDuration = 0.5 + Math.random() * 1.5;
            
            score.push({
                notes: `${randomNote}${randomOctave}`,
                time: randomTime,
                duration: randomDuration
            });
        }
        return score;
    }
}


// --- 3. Scheduler (The "Score Player") ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    bpm: 100,
    drumSettings: {},
    instruments: {},
    activeComposition: 'slowAmbientIntro', // The composition to play

    // --- Calculated properties ---
    // This is the core change for the new intro logic. A shorter cycle.
    get beatsPerBar() { return 2; }, 
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;
        
        // Generate the first chunk immediately
        this.tick();

        // Set up the interval for subsequent chunks
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
        
        // If BPM changes, we need to restart the interval to match the new timing
        if (this.isRunning) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        }
    },

    tick() {
        if (!this.isRunning) return;

        // 1. Get all musical parts for the current bar from the active composition
        const parts = PatternProvider.getCompositionParts(this.activeComposition, this.barCount, true);
        
        if (!parts) {
            console.error(`No parts found for bar ${this.barCount} in composition ${this.activeComposition}`);
            this.barCount++;
            return;
        }

        // 2. Process each part and send its score to the main thread
        parts.forEach(part => {
            if (!part.instrument || !part.score) return;

            let score;
            // The score can be a direct array of notes or a function to be resolved
            if (typeof part.score === 'function') {
                score = part.score(this.drumSettings); // Pass settings if the generator needs them
            } else {
                score = part.score;
            }

            // Check if instrument is enabled in settings before posting
            switch(part.instrument) {
                case 'drums':
                    if (this.drumSettings.enabled) {
                        self.postMessage({ type: 'drum_score', data: { score } });
                    }
                    break;
                case 'bass':
                    if (this.instruments.bass !== 'none') {
                        self.postMessage({ type: 'bass_score', data: { score } });
                    }
                    break;
                case 'solo':
                    if (this.instruments.solo !== 'none') {
                        self.postMessage({ type: 'solo_score', data: { score } });
                    }
                    break;
            }
        });
        
        this.barCount++;
    }
};


// --- MessageBus (The entry point) ---
self.onmessage = async (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'start':
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

    
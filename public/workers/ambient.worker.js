/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Its only job is to act as a precise "metronome" and musical score generator.
 * It does NOT handle audio rendering, which is now managed by Tone.js in the main thread.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles communication with the main thread.
 *
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals (one bar),
 *     requests scores from the generators, and posts them to the main thread.
 *
 * 3.  Instrument Generators (e.g., DrumGenerator, BassGenerator): "Composers" that create
 *     musical patterns (scores) based on the current settings.
 *
 * 4.  PatternProvider: The "music sheet library" holding all rhythmic and melodic patterns.
 *
 * Data Flow:
 * - Main thread sends 'start' with instrument/drum settings.
 * - Scheduler starts its loop.
 * - In each loop tick (every bar):
 *   - Scheduler asks the appropriate generators for their scores for the current bar.
 *   - Generators query PatternProvider for the base patterns.
 *   - Generators create their scores and return them to the scheduler.
 *   - Scheduler posts a message to the main thread for each active instrument,
 *     containing the generated score (e.g., { type: 'drum_score', data: { score: [...] } }).
 * - The main thread, using Tone.js, receives these scores and schedules the audio playback.
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
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
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
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        
        return score.map(note => ({
            ...note,
            time: (note.time * (60 / Scheduler.bpm))
        }));
    }
}

class BassGenerator {
     static createScore(rootNote = 'E', beatsPerBar = 4) {
        const barDuration = beatsPerBar * (60/ Scheduler.bpm);
        const score = [
            { note: `${rootNote}1`, time: 0, duration: barDuration, velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static createScore(barNumber, beatsPerBar = 4) {
        const barDuration = beatsPerBar * (60/ Scheduler.bpm);
        const notes = [ "C4", "E4", "G4", "B4" ];
        const score = [];

        // Simple arpeggio for demonstration
        for (let i = 0; i < beatsPerBar; i++) {
            score.push({
                notes: notes[i % notes.length],
                time: i * (barDuration / beatsPerBar),
                duration: "8n",
                velocity: 0.7
            });
        }
        return score;
    }
}


// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    bpm: 100,
    instruments: {
        solo: 'none',
        bass: 'none',
    },
    drumSettings: {
        enabled: true,
        pattern: 'basic'
    },

    // Calculated properties
    get beatsPerBar() { return 4; },
    get barDuration() { return this.beatsPerBar * (60 / this.bpm); },

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
        if (settings.bpm) {
            this.bpm = settings.bpm;
            // If running, restart the interval with the new BPM
            if (this.isRunning) {
                clearInterval(this.intervalId);
                this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
            }
        }
    },

    tick() {
        if (!this.isRunning) return;
        
        // 1. Generate drum score
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount
            );
            self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }
        
        // 2. Generate bass score
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore('E', this.beatsPerBar);
            self.postMessage({ type: 'bass_score', data: { score: bassScore }});
        }

        // 3. Generate solo score
        if (this.instruments.solo !== 'none') {
             const soloScore = SoloGenerator.createScore(this.barCount, this.beatsPerBar);
             self.postMessage({ type: 'solo_score', data: { score: soloScore }});
        }

        this.barCount++;
    }
};


// --- MessageBus (The "Kafka" entry point) ---
self.onmessage = async (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            // 'init' is no longer needed as audio is handled by main thread
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
    
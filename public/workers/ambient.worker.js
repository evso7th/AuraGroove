

import { promenadeScore } from "@/lib/scores/promenade";

/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
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
            score = score.filter(note => note.time !== 0);
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        
        return score;
    }
}

class BassGenerator {
     static createScore(barCount) {
        const score = [];
        const beatsPerBar = 4;
        
        // Use a simple scale (E minor pentatonic)
        const scale = ['E2', 'G2', 'A2', 'B2', 'D3', 'E3', 'G3'];
        let lastNoteIndex = 0;

        for (let i = 0; i < 2; i++) {
             // Choose a new note, but not the same as the last one
            let nextNoteIndex;
            do {
                nextNoteIndex = Math.floor(Math.random() * scale.length);
            } while (nextNoteIndex === lastNoteIndex);
            lastNoteIndex = nextNoteIndex;

            const note = scale[nextNoteIndex];
            const time = i * (beatsPerBar / 2); // Two notes per bar
            const duration = (beatsPerBar / 2);
            const velocity = 0.65 + Math.random() * 0.1; // Slight velocity variation

            score.push({ note, time, duration, velocity });
        }

        return score;
    }
}

class SoloGenerator {
     static createScore(barCount) {
        const score = [];
        const beatsPerBar = 4;
        const scale = ['E4', 'G4', 'A4', 'B4', 'D5', 'E5', 'G5'];

        // Generate 1 to 3 notes per bar
        const numNotes = Math.floor(Math.random() * 3) + 1;

        for (let i = 0; i < numNotes; i++) {
            const note = scale[Math.floor(Math.random() * scale.length)];
            
            // Random time within the bar, quantized to 16th notes
            const time = (Math.floor(Math.random() * beatsPerBar * 4)) / 4; 
            
            // Random duration, 8th or 16th note
            const duration = Math.random() > 0.4 ? '8n' : '16n';

            score.push({ notes: note, time, duration });
        }

        // Sort by time to ensure chronological playback
        return score.sort((a, b) => a.time - b.time);
    }
}

// --- 3. Scheduler (The Conductor) ---
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

        // 1. Generate scores
        if (this.drumSettings?.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount
            );
            if (drumScore.length > 0) {
                 self.postMessage({ type: 'drum_score', data: { score: drumScore } });
            }
        }
        
        if (this.instruments?.bass && this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(this.barCount);
            if (bassScore.length > 0) {
                self.postMessage({ type: 'bass_score', data: { score: bassScore } });
            }
        }

        if (this.instruments?.solo && this.instruments.solo !== 'none') {
            // Generate solo less frequently, e.g., every other bar
            if (this.barCount % 2 === 0) {
                const soloScore = SoloGenerator.createScore(this.barCount);
                if (soloScore.length > 0) {
                    self.postMessage({ type: 'solo_score', data: { score: soloScore } });
                }
            }
        }

        this.barCount++;
    }
};


// --- MessageBus (The entry point) ---
self.onmessage = async (event) => {
    const { command, data } = event.data;
    try {
        switch (command) {
            case 'init':
                // The SampleBank is no longer needed in the worker as audio is main-thread only
                self.postMessage({ type: 'initialized' });
                break;
            
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

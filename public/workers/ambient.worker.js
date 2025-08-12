
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 */
// --- Type Definitions (for clarity, not enforced in JS) ---
/**
 * @typedef {import('@/types/music').DrumNote} DrumNote
 * @typedef {import('@/types/music').BassNote} BassNote
 * @typedef {import('@/types/music').SoloNote} SoloNote
 * @typedef {{drums: DrumNote[], bass: BassNote[], solo: SoloNote[]}} FullScore
 */

// --- 1. ScoreLibrary (The Music Sheet Library) ---
const ScoreLibrary = {
    // Pre-defined scores are stored here
    scores: {
        promenade: {
            drums: [
                // Bar 1
                { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
                { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 }, { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
                // Bar 2
                { sample: 'kick', time: 4 }, { sample: 'hat', time: 4.5 }, { sample: 'snare', time: 5 }, { sample: 'hat', time: 5.5 },
                { sample: 'kick', time: 6 }, { sample: 'hat', time: 6.5 }, { sample: 'snare', time: 7 }, { sample: 'hat', time: 7.5 },
                // Bar 3
                { sample: 'kick', time: 8 }, { sample: 'hat', time: 8.5 }, { sample: 'snare', time: 9 }, { sample: 'hat', time: 9.5 },
                { sample: 'kick', time: 10 }, { sample: 'hat', time: 10.5 }, { sample: 'snare', time: 11 }, { sample: 'hat', time: 11.5 },
                // Bar 4 (with crash)
                { sample: 'crash', time: 12, velocity: 0.8 }, { sample: 'hat', time: 12.5 }, { sample: 'snare', time: 13 }, { sample: 'hat', time: 13.5 },
                { sample: 'kick', time: 14 }, { sample: 'hat', time: 14.5 }, { sample: 'snare', time: 15 }, { sample: 'hat', time: 15.5 },
            ],
            bass: [
                { note: 'E1', time: 0, duration: 4, velocity: 0.9 }, { note: 'C1', time: 4, duration: 4, velocity: 0.85 },
                { note: 'G1', time: 8, duration: 4, velocity: 0.88 }, { note: 'D1', time: 12, duration: 4, velocity: 0.86 },
            ],
            solo: [
                { notes: 'B3', duration: '8n', time: 0.5 }, { notes: 'G3', duration: '8n', time: 1.5 },
                { notes: 'A3', duration: '4n', time: 2.5 }, { notes: 'G3', duration: '8n', time: 4.5 },
                { notes: 'E3', duration: '8n', time: 5.5 }, { notes: 'C3', duration: '4n', time: 6.5 },
                { notes: 'D3', duration: '2n', time: 8.5 }, { notes: 'E3', duration: '8n', time: 12.5 },
                { notes: 'G3', duration: '8n', time: 13.5 }, { notes: 'B3', duration: '4n', time: 14.5 },
            ],
            // A score's total length in bars. 4 beats per bar. 16 beats total / 4 = 4 bars.
            totalBars: 4, 
        }
    },
    /** @returns {FullScore | null} */
    getScore(name) {
        return this.scores[name] || null;
    }
};


// --- 2. PatternProvider (For Generative Music) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 }, { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'kick', time: 0.75 }, { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 }, { sample: 'kick', time: 2 }, { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 }, { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 }, { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 }, { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 }, { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ],
    },
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
};

// --- 3. Instrument Generators (The Composers) ---
class DrumGenerator {
    /** @returns {DrumNote[]} */
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber > 0 && barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        
        return score;
    }
}

class BassGenerator {
    constructor() {
        this.currentRoot = 'E';
        this.progression = ['E', 'C', 'G', 'D']; // Example progression
        this.notes = ['E', 'F#', 'G', 'A', 'B', 'C', 'D'];
    }

    /** @returns {BassNote[]} */
    createScore(barCount) {
        const rootNote = this.progression[barCount % this.progression.length];
        const octave = (Math.random() < 0.5) ? 2 : 3;

        const score = [];
        const numberOfNotes = Math.floor(Math.random() * 3) + 1; // 1 to 3 notes per bar
        const beats = [0, 1, 2, 3].sort(() => 0.5 - Math.random()); // Randomize beat order

        for (let i = 0; i < numberOfNotes; i++) {
            const time = beats[i];
            const noteIndex = Math.floor(Math.random() * this.notes.length);
            // Simple logic: primarily root, with some variation
            const note = (Math.random() < 0.7) ? `${rootNote}${octave}` : `${this.notes[noteIndex]}${octave}`;
            
            score.push({
                note: note,
                time: time,
                duration: Math.random() * 1.5 + 0.5, // duration between 0.5 and 2 beats
                velocity: Math.random() * 0.3 + 0.5 // velocity between 0.5 and 0.8
            });
        }
        
        return score;
    }
}

class SoloGenerator {
    constructor() {
        this.scale = ['E3', 'G3', 'A3', 'B3', 'D4', 'E4', 'G4'];
    }

    /** @returns {SoloNote[]} */
    createScore() {
        const score = [];
        const numNotes = Math.floor(Math.random() * 5); // 0 to 4 notes
        for (let i = 0; i < numNotes; i++) {
            const note = this.scale[Math.floor(Math.random() * this.scale.length)];
            const time = (Math.random() * 4); // Random time within the 4 beats
            const duration = ['8n', '4n'][Math.floor(Math.random() * 2)];
            score.push({ notes: note, time, duration });
        }
        return score;
    }
}


// --- 4. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    sampleRate: 44100,
    bpm: 100,
    instruments: {},
    drumSettings: {},
    scoreName: 'generative', // Default to generative

    // Generators
    bassGenerator: new BassGenerator(),
    soloGenerator: new SoloGenerator(),

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },

    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
        this.scheduleNextTick();
        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        if (this.intervalId) {
            clearTimeout(this.intervalId);
            this.intervalId = null;
        }
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
        if (settings.score) this.scoreName = settings.score;
    },

    scheduleNextTick() {
        if (!this.isRunning) return;
        this.tick();
        const intervalTime = this.barDuration * 1000;
        this.intervalId = setTimeout(() => this.scheduleNextTick(), intervalTime);
    },

    tick() {
        if (!this.isRunning) return;

        const isGenerative = this.scoreName === 'generative';
        const score = !isGenerative ? ScoreLibrary.getScore(this.scoreName) : null;
        
        // --- Score Calculation ---
        let drumScore = [];
        let bassScore = [];
        let soloScore = [];

        if (score) {
            // --- Use Pre-defined Score ---
            const loopPoint = this.barCount % score.totalBars;
            const barStartBeat = loopPoint * this.beatsPerBar;
            const barEndBeat = barStartBeat + this.beatsPerBar;

            if (this.drumSettings.enabled && this.instruments.bass !== 'none') {
                 drumScore = score.drums
                    .filter(note => note.time >= barStartBeat && note.time < barEndBeat)
                    .map(note => ({ ...note, time: note.time - barStartBeat }));
            }
           
            if (this.instruments.bass !== 'none') {
                 bassScore = score.bass
                    .filter(note => note.time >= barStartBeat && note.time < barEndBeat)
                    .map(note => ({ ...note, time: note.time - barStartBeat }));
            }
            if (this.instruments.solo !== 'none') {
                soloScore = score.solo
                    .filter(note => note.time >= barStartBeat && note.time < barEndBeat)
                    .map(note => ({ ...note, time: note.time - barStartBeat }));
            }
        } else {
            // --- Use Generative Mode ---
            if (this.drumSettings.enabled) {
                drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            }
            if (this.instruments.bass !== 'none') {
                bassScore = this.bassGenerator.createScore(this.barCount);
            }
            if (this.instruments.solo !== 'none') {
                soloScore = this.soloGenerator.createScore();
            }
        }

        // --- Post Scores to Main Thread ---
        if (drumScore.length > 0) {
            self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }
        if (bassScore.length > 0) {
            self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }
        if (soloScore.length > 0) {
            self.postMessage({ type: 'solo_score', data: { score: soloScore } });
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
                Scheduler.sampleRate = data.sampleRate;
                // Note: SampleBank is removed, samples are handled on the main thread
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

    
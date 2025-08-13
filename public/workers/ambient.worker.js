
/**
 * @file AuraGroove Ambient Music Worker
 * This worker generates musical scores for various instruments and sends them
 * to the main thread for playback with Tone.js. It operates on a scheduler
 * to ensure all parts are synchronized.
 */
import { promenadeScore } from '../../src/lib/scores/promenade';

// --- Type Definitions (Subset for Worker) ---
/** @typedef {'bass synth' | 'none'} BassInstrument */
/** @typedef {'synthesizer' | 'piano' | 'organ' | 'none'} MelodicInstrument */
/** @typedef {'basic' | 'breakbeat' | 'slow' | 'heavy'} DrumPattern */
/** @typedef {'generative' | 'promenade'} ScoreName */

/**
 * @typedef {Object} DrumNote
 * @property {string} sample
 * @property {number} time
 * @property {number} [velocity]
 */

/**
 * @typedef {Object} BassNote
 * @property {string} note
 * @property {string | number} duration
 * @property {number} time
 * @property {number} velocity
 */

/**
 * @typedef {Object} SoloNote
 * @property {string | string[]} notes
 * @property {string | number} duration
 * @property {number} time
 */

/**
 * @typedef {Object} AccompanimentNote
 * @property {string | string[]} notes
 * @property {string | number} duration
 * @property {number} time
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
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'kick', time: 0.75 }, { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 }, { sample: 'kick', time: 2 }, { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 }, { sample: 'hat', time: 3.5 },
        ],
        slow: [ { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 }, { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 }, ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 }, { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 }, { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ],
    },
    /** @param {DrumPattern} name */
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },

    // A simple C Major progression for generative music
    chordProgression: [
        { root: 'C', chord: ['C4', 'E4', 'G4'] },
        { root: 'G', chord: ['G4', 'B4', 'D5'] },
        { root: 'A', chord: ['A4', 'C5', 'E5'] }, // Am
        { root: 'F', chord: ['F4', 'A4', 'C5'] },
    ],
    /** @param {number} barNumber */
    getChord(barNumber) {
        return this.chordProgression[barNumber % this.chordProgression.length];
    }
};


// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    /**
     * @param {DrumPattern} patternName
     * @param {number} barNumber
     * @returns {DrumNote[]}
     */
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.unshift({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
    /**
     * @param {number} barNumber
     * @returns {BassNote[]}
     */
    static createScore(barNumber) {
        const { root } = PatternProvider.getChord(barNumber);
        // Play the root note of the chord for the whole bar
        const score = [{
            note: `${root}2`, // Play in the 2nd octave
            duration: '1n', // for the whole note (bar)
            time: 0,
            velocity: 0.8
        }];
        return score;
    }
}

class SoloGenerator {
     /**
     * @param {number} barNumber
     * @returns {SoloNote[]}
     */
    static createScore(barNumber) {
        const { chord } = PatternProvider.getChord(barNumber);
        const score = [];
        // Simple arpeggiated pattern
        score.push({ notes: chord[0], duration: '8n', time: 0.5 });
        score.push({ notes: chord[1], duration: '8n', time: 1.5 });
        score.push({ notes: chord[2], duration: '8n', time: 2.5 });
        score.push({ notes: chord[1], duration: '8n', time: 3.5 });
        return score;
    }
}

class AccompanimentGenerator {
    /**
     * @param {number} barNumber
     * @returns {AccompanimentNote[]}
     */
    static createScore(barNumber) {
        const { chord } = PatternProvider.getChord(barNumber);
        // Play the chord as a whole note
        const score = [{
            notes: chord,
            duration: '1n',
            time: 0
        }];
        return score;
    }
}

// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    isInitialized: false,

    // Settings from main thread
    /** @type {number} */
    bpm: 120,
    /** @type {{solo: MelodicInstrument, accompaniment: MelodicInstrument, bass: BassInstrument}} */
    instruments: { solo: 'none', accompaniment: 'none', bass: 'none' },
    /** @type {{enabled: boolean, pattern: DrumPattern}} */
    drumSettings: { enabled: false, pattern: 'basic' },
    /** @type {ScoreName} */
    score: 'generative',


    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },

    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;

        // Generate the first chunk immediately and post it
        this.tick();

        // Then set up the interval for subsequent chunks
        // @ts-ignore
        this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        // @ts-ignore
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isRunning = false;
        self.postMessage({ type: 'stopped' });
    },

    reset() {
        this.barCount = 0;
    },

    /** @param {any} settings */
    updateSettings(settings) {
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
    },

    tick() {
        if (!this.isRunning) return;

        if (this.score === 'promenade') {
            // For the 'promenade' score, we send the whole score at once on the first tick
            if (this.barCount === 0) {
                 if (this.drumSettings.enabled) {
                    self.postMessage({ type: 'drum_score', data: { score: promenadeScore.drums } });
                }
                if (this.instruments.bass !== 'none') {
                    self.postMessage({ type: 'bass_score', data: { score: promenadeScore.bass } });
                }
                if (this.instruments.solo !== 'none') {
                    self.postMessage({ type: 'solo_score', data: { score: promenadeScore.solo } });
                }
                if (this.instruments.accompaniment !== 'none') {
                    self.postMessage({ type: 'accompaniment_score', data: { score: promenadeScore.accompaniment } });
                }
            }
             // Stop playback after the score duration (4 bars * bar duration)
            if ((this.barCount + 1) * this.barDuration >= this.barDuration * 4) {
                 // The score is 4 bars long, let it loop or stop. Here we just let it repeat.
                 this.barCount = -1; // It will be incremented to 0
            }

        } else { // 'generative' score
             if (this.drumSettings.enabled) {
                const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
                self.postMessage({ type: 'drum_score', data: { score: drumScore } });
            }
            if (this.instruments.bass !== 'none') {
                const bassScore = BassGenerator.createScore(this.barCount);
                self.postMessage({ type: 'bass_score', data: { score: bassScore } });
            }
            if (this.instruments.solo !== 'none') {
                const soloScore = SoloGenerator.createScore(this.barCount);
                self.postMessage({ type: 'solo_score', data: { score: soloScore } });
            }
            if (this.instruments.accompaniment !== 'none') {
                const accompanimentScore = AccompanimentGenerator.createScore(this.barCount);
                self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
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
                 // Acknowledge initialization immediately to prevent main thread violation errors.
                 // The actual sample loading happens in the background.
                if (!Scheduler.isInitialized) {
                    self.postMessage({ type: 'initialized' });
                    Scheduler.isInitialized = true;
                }
                break;

            case 'start':
                if (!Scheduler.isInitialized) {
                   throw new Error("Worker is not initialized. Call 'init' first.");
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

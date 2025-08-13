/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  Scheduler: The central "conductor" or "event loop". It wakes up at regular
 *     intervals, determines what musical data is needed, and coordinates the other
 *     entities.
 *
 * 2.  Instrument Generators: These are the "composers" (e.g., DrumGenerator).
 *     They return a "score" - an array of note events. They are stateless.
 *
 * 3.  Pattern & Scale Providers: The "music sheet library". It holds all rhythmic and melodic
 *     patterns, scales, and chord progressions.
 */

// --- Type Definitions for Clarity ---
/**
 * @typedef {Object} DrumNote
 * @property {string} sample - The name of the drum sample (e.g., 'kick').
 * @property {number} time - Time in beats from the start of the bar.
 * @property {number} [velocity] - Note velocity (0-1).
 */
/**
 * @typedef {Object} BassNote
 * @property {string} note - The MIDI note name (e.g., 'E2').
 * @property {string | number} duration - The duration of the note.
 * @property {number} time - Time in beats from the start of the bar.
 * @property {number} [velocity] - Note velocity (0-1).
 */
/**
 * @typedef {Object} SoloNote
 * @property {string[]} notes - The MIDI note names (e.g., ['G4']).
 * @property {string | number} duration - The duration of the note.
 * @property {number} time - Time in beats from the start of the bar.
 */
/**
 * @typedef {Object} AccompanimentNote
 * @property {string[]} notes - The MIDI note names for the chord (e.g., ['E3', 'G3', 'B3']).
 * @property {string | number} duration - The duration of the chord.
 * @property {number} time - Time in beats from the start of the bar.
 */
/**
 * @typedef {Object} EffectNote
 * @property {string} note - The MIDI note name for the effect.
 * @property {string | number} duration - The duration of the effect note.
 * @property {number} time - Time in beats from the start of the bar.
 * @property {number} [velocity] - Note velocity (0-1).
 */


// --- 1. Pattern & Scale Providers (The Music Sheet Library) ---
const MusicTheory = {
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
        slow: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 },
            { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 }, { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 }, { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ]
    },
    chordProgressions: {
        // Simple I-V-vi-IV in C major / A minor
        pachelbel: ['C', 'G', 'Am', 'Em', 'F', 'C', 'F', 'G'],
        // Minor key progression
        sad: ['Am', 'G', 'F', 'E'],
        // More ambient progression
        ambient: ['Am', 'F', 'C', 'G'],
    },

    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
    
    getChordProgression(barCount) {
        // For now, simple ambient progression
        const progression = this.chordProgressions.ambient;
        return progression[barCount % progression.length];
    },
};


// --- 2. Instrument Generators (The Composers) ---

class DrumGenerator {
    /** @returns {DrumNote[]} */
    static createScore(patternName, barNumber, totalBars) {
        const pattern = MusicTheory.getDrumPattern(patternName);
        let score = [...pattern];

        if (barNumber > 0 && barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.unshift({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
     /** @returns {BassNote[]} */
    static createScore(rootNote, barNumber) {
        const noteName = `${rootNote}2`; // Play in the 2nd octave for better audibility
        const score = [
            { note: noteName, duration: '1n', time: 0, velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    /** @returns {SoloNote[]} */
    static createScore(rootNote, barNumber) {
        // Simple placeholder logic
        const score = [];
        // Add a note on the 3rd beat
         if (barNumber % 2 === 0) {
             score.push({ notes: [`${rootNote}4`], duration: '8n', time: 2.5 });
         }
        return score;
    }
}

class AccompanimentGenerator {
    /** @returns {AccompanimentNote[]} */
    static createScore(rootNote, barNumber) {
         // Simple placeholder logic
        const score = [];
        return score;
    }
}

class EffectsGenerator {
     /** @returns {EffectNote[]} */
    static createScore(rootNote, barNumber) {
        const score = [];
        // Add a random bell sound occasionally on an off-beat
        if (Math.random() < 0.25) { // 25% chance each bar
            const time = 1.5 + Math.floor(Math.random() * 3); // off-beats
            score.push({
                note: `${rootNote}5`,
                duration: '16n',
                time: time,
                velocity: 0.5 + Math.random() * 0.3
            });
        }
        return score;
    }
}

// --- 3. Score for "Promenade" ---
const promenadeScore = {
    getDrums(barNumber) {
        const barDrums = [
            // Bar 1
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 }, { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
        ];
        if (barNumber > 0 && barNumber % 4 === 0) {
             return [{ sample: 'crash', time: 0, velocity: 0.8 }, ...barDrums.filter(n => n.time !== 0)];
        }
        return barDrums;
    },
    getBass(barNumber) {
        const progression = ['E1', 'C1', 'G1', 'D1'];
        const note = progression[barNumber % progression.length];
        return [{ note: note, duration: '1n', time: 0, velocity: 0.9 }];
    },
    getSolo(barNumber) {
        const phrases = [
            [{ notes: 'B3', duration: '8n', time: 0.5 }, { notes: 'G3', duration: '8n', time: 1.5 }, { notes: 'A3', duration: '4n', time: 2.5 }],
            [{ notes: 'G3', duration: '8n', time: 0.5 }, { notes: 'E3', duration: '8n', time: 1.5 }, { notes: 'C3', duration: '4n', time: 2.5 }],
            [{ notes: 'D3', duration: '2n', time: 0.5 }],
            [{ notes: 'E3', duration: '8n', time: 0.5 }, { notes: 'G3', duration: '8n', time: 1.5 }, { notes: 'B3', duration: '4n', time: 2.5 }],
        ];
        return phrases[barNumber % phrases.length] || [];
    },
    getAccompaniment(barNumber) {
        const chords = [
            { notes: ['E2', 'G2', 'B2'], duration: '1n', time: 0 },
            { notes: ['C2', 'E2', 'G2'], duration: '1n', time: 0 },
            { notes: ['G2', 'B2', 'D3'], duration: '1n', time: 0 },
            { notes: ['D2', 'F#2', 'A2'], duration: '1n', time: 0 },
        ];
        return [chords[barNumber % chords.length]];
    },
    getEffects(barNumber) {
        return []; // No effects in promenade score
    }
};


// --- 4. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    sampleRate: 44100,
    bpm: 100,
    instruments: { solo: 'none', accompaniment: 'none', bass: 'none', effects: 'none' },
    drumSettings: { enabled: false, pattern: 'basic' },
    score: 'generative', // 'generative' or 'promenade'


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
        self.postMessage({ type: 'stopped' });
    },

    reset() {
        this.barCount = 0;
    },
    
    updateSettings(settings) {
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
    },

    tick() {
        if (!this.isRunning) return;

        const currentChord = MusicTheory.getChordProgression(this.barCount);
        
        const scoreAccess = this.score === 'promenade' ? promenadeScore : null;
        
        // 1. Generate scores for all enabled instruments
        if (this.drumSettings.enabled) {
            const drumScore = scoreAccess
                ? scoreAccess.getDrums(this.barCount)
                : DrumGenerator.createScore(this.drumSettings.pattern, this.barCount, -1);
            if (drumScore.length > 0) self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = scoreAccess
                ? scoreAccess.getBass(this.barCount)
                : BassGenerator.createScore(currentChord, this.barCount);
            if (bassScore.length > 0) self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }

        if (this.instruments.solo !== 'none') {
            const soloScore = scoreAccess
                ? scoreAccess.getSolo(this.barCount)
                : SoloGenerator.createScore(currentChord, this.barCount);
            if (soloScore.length > 0) self.postMessage({ type: 'solo_score', data: { score: soloScore } });
        }
        
        if (this.instruments.accompaniment !== 'none') {
            const accompanimentScore = scoreAccess
                ? scoreAccess.getAccompaniment(this.barCount)
                : AccompanimentGenerator.createScore(currentChord, this.barCount);
            if (accompanimentScore.length > 0) self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
        }

        if (this.instruments.effects !== 'none') {
            const effectsScore = scoreAccess
                ? scoreAccess.getEffects(this.barCount)
                : EffectsGenerator.createScore(currentChord, this.barCount);
            if (effectsScore.length > 0) self.postMessage({ type: 'effects_score', data: { score: effectsScore } });
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
                // In this architecture, worker doesn't need samples. It only generates scores.
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

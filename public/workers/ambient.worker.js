
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
    melodicPatterns: {
        major: [0, 2, 4, 5, 7, 9, 11], // Major scale intervals
        minor: [0, 2, 3, 5, 7, 8, 10], // Natural minor scale intervals
    },
    chordProgressions: {
        simple: [['E3', 'G3', 'B3'], ['A3', 'C4', 'E4'], ['C3', 'E3', 'G3'], ['G3', 'B3', 'D4']],
    },

    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
    getMelodyPattern(name) {
        return this.melodicPatterns[name] || this.melodicPatterns.major;
    },
    getChordProgression(name) {
        return this.chordProgressions[name] || this.chordProgressions.simple;
    }
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];
        if (barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
    static createScore(rootNote = 'E1', barNumber) {
        const progression = PatternProvider.getChordProgression('simple');
        const root = progression[barNumber % progression.length][0].slice(0, -1);
        return [{ note: `${root}1`, time: 0, duration: 4, velocity: 0.9 }];
    }
}

class SoloGenerator {
    static createScore(rootNote = 'E', barNumber) {
        const score = [];
        const scale = PatternProvider.getMelodyPattern('minor');
        const rootPitch = 40; // E2

        for (let i = 0; i < 2; i++) {
            const noteIndex = Math.floor(Math.random() * scale.length);
            const pitch = rootPitch + scale[noteIndex] + 12; // E3 octave
            const time = barNumber * 4 + i * 2 + Math.random() * 0.5;
            const duration = ['4n', '8n'][Math.floor(Math.random() * 2)];
             score.push({ notes: `E${(pitch % 12)}`, time: i * 2, duration });
        }
        return score;
    }
}


class AccompanimentGenerator {
    static createScore(barNumber) {
        const progression = PatternProvider.getChordProgression('simple');
        const chords = progression[barNumber % progression.length];
        return [{ notes: chords, time: 0, duration: '1n' }];
    }
}


// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    bpm: 120,
    instruments: {},
    drumSettings: {},
    score: 'generative',

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
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
        if (this.isRunning) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        }
    },

    tick() {
        if (!this.isRunning) return;

        // --- Drums ---
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }

        // --- Bass ---
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore('E1', this.barCount);
            self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }

        // --- Accompaniment ---
        if (this.instruments.accompaniment !== 'none') {
            const accompanimentScore = AccompanimentGenerator.createScore(this.barCount);
            self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
        }
        
        // --- Solo ---
        if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore('E', this.barCount);
             //self.postMessage({ type: 'solo_score', data: { score: soloScore } });
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
                // SampleBank is now managed on the main thread
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

    
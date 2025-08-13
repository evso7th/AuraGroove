/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * It is responsible for generating musical scores (note events) but does not handle
 * audio rendering itself. That is left to the main thread with Tone.js.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication between the main thread and the worker.
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals (ticks)
 *     and coordinates the generators to produce music for the next time slice.
 * 3.  Instrument Generators: The "composers" (e.g., DrumGenerator, BassGenerator).
 *     They create arrays of note events based on musical rules and patterns.
 * 4.  Pattern/Score Providers: Data stores for predefined musical patterns or full scores.
 */

// --- Type Definitions for Clarity (JSDoc) ---
/**
 * @typedef {Object} DrumNote
 * @property {string} sample - The name of the drum sample (e.g., 'kick').
 * @property {number} time - Time in beats from the start of the measure.
 * @property {number} [velocity] - Note velocity (0-1).
 */
/**
 * @typedef {Object} BassNote
 * @property {string} note - The MIDI note name (e.g., 'E1').
 * @property {number} time - Time in beats from the start of the measure.
 * @property {number | string} duration - Duration in beats or Tone.js time format.
 * @property {number} [velocity] - Note velocity (0-1).
 */
/**
 * @typedef {Object} SoloNote
 * @property {string|string[]} notes - The MIDI note(s) name (e.g., 'C4' or ['C4', 'E4']).
 * @property {number|string} time - Time in Tone.js time format relative to the start of the measure.
 * @property {number|string} duration - Duration in Tone.js time format.
 */
/**
 * @typedef {Object} AccompanimentNote
 * @property {string|string[]} notes - The MIDI note(s) name.
 * @property {number|string} time - Time in Tone.js time format relative to the start of the measure.
 * @property {number|string} duration - Duration in Tone.js time format.
 */

// --- Static Data Providers ---

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

const promenadeScore = {
    drums: [
        { sample: 'kick', time: 0 },{ sample: 'hat', time: 0.5 },{ sample: 'snare', time: 1 },{ sample: 'hat', time: 1.5 },{ sample: 'kick', time: 2 },{ sample: 'hat', time: 2.5 },{ sample: 'snare', time: 3 },{ sample: 'hat', time: 3.5 },
        { sample: 'kick', time: 4 },{ sample: 'hat', time: 4.5 },{ sample: 'snare', time: 5 },{ sample: 'hat', time: 5.5 },{ sample: 'kick', time: 6 },{ sample: 'hat', time: 6.5 },{ sample: 'snare', time: 7 },{ sample: 'hat', time: 7.5 },
        { sample: 'kick', time: 8 },{ sample: 'hat', time: 8.5 },{ sample: 'snare', time: 9 },{ sample: 'hat', time: 9.5 },{ sample: 'kick', time: 10 },{ sample: 'hat', time: 10.5 },{ sample: 'snare', time: 11 },{ sample: 'hat', time: 11.5 },
        { sample: 'crash', time: 12, velocity: 0.8 },{ sample: 'hat', time: 12.5 },{ sample: 'snare', time: 13 },{ sample: 'hat', time: 13.5 },{ sample: 'kick', time: 14 },{ sample: 'hat', time: 14.5 },{ sample: 'snare', time: 15 },{ sample: 'hat', time: 15.5 },
    ],
    bass: [
        { note: 'E1', time: 0, duration: '1n', velocity: 0.9 },
        { note: 'C1', time: 4, duration: '1n', velocity: 0.85 },
        { note: 'G1', time: 8, duration: '1n', velocity: 0.88 },
        { note: 'D1', time: 12, duration: '1n', velocity: 0.86 },
    ],
    solo: [
        { notes: 'B3', duration: '8n', time: 0.5 }, { notes: 'G3', duration: '8n', time: 1.5 }, { notes: 'A3', duration: '4n', time: 2.5 },
        { notes: 'G3', duration: '8n', time: 4.5 }, { notes: 'E3', duration: '8n', time: 5.5 }, { notes: 'C3', duration: '4n', time: 6.5 },
        { notes: 'D3', duration: '2n', time: 8.5 },
        { notes: 'E3', duration: '8n', time: 12.5 }, { notes: 'G3', duration: '8n', time: 13.5 }, { notes: 'B3', duration: '4n', time: 14.5 },
    ],
    accompaniment: [
        { notes: ['E2', 'G2', 'B2'], duration: '1n', time: 0 },
        { notes: ['C2', 'E2', 'G2'], duration: '1n', time: 4 },
        { notes: ['G2', 'B2', 'D3'], duration: '1n', time: 8 },
        { notes: ['D2', 'F#2', 'A2'], duration: '1n', time: 12 },
    ]
};


// --- Musical Utilities ---
const MusicUtils = {
    notes: ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"],
    scales: {
        major: [0, 2, 4, 5, 7, 9, 11],
        minor: [0, 2, 3, 5, 7, 8, 10],
    },
    
    getNote(root, interval, octave) {
        const rootIndex = this.notes.indexOf(root);
        const noteIndex = (rootIndex + interval) % 12;
        return this.notes[noteIndex] + octave;
    },

    getChord(root, type, octave) {
        const scale = type.includes('m') ? this.scales.minor : this.scales.major;
        let intervals = [scale[0], scale[2], scale[4]]; // Basic triad

        if (type.includes('7')) {
             intervals.push(type.includes('maj7') ? scale[6] : (type.includes('m') ? this.scales.minor[6] -1 : this.scales.major[6] -1));
        }

        return intervals.map(interval => this.getNote(root, interval, octave));
    },

    getNoteMidi(noteName) {
        const match = noteName.match(/([A-G]#?)(\d+)/);
        if (!match) return 0;
        const note = match[1];
        const octave = parseInt(match[2], 10);
        return this.notes.indexOf(note) + octave * 12;
    },

    getNoteFromMidi(midi) {
        const noteIndex = midi % 12;
        const octave = Math.floor(midi / 12);
        return this.notes[noteIndex] + octave;
    }
};


// --- Instrument Generators ---

class DrumGenerator {
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        if (barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.unshift({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
    static createScore(rootNote, barNumber, beatsPerBar = 4) {
        const progression = ['E', 'C', 'G', 'D'];
        const currentRoot = progression[barNumber % progression.length];
        
        const score = [
            { note: `${currentRoot}1`, time: 0, duration: '1n', velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static createScore(barNumber, beatsPerBar = 4) {
        // Simple placeholder melody
        const score = [];
        if (barNumber % 4 === 0) {
            score.push({ notes: 'B3', duration: '8n', time: 0.5 });
            score.push({ notes: 'G3', duration: '8n', time: 1.5 });
        }
        return score;
    }
}

class AccompanimentGenerator {
    static createScore(barNumber, beatsPerBar = 4) {
        const progression = [
            { root: 'E', type: 'm' },
            { root: 'C', type: 'maj7' },
            { root: 'G', type: 'maj' },
            { root: 'D', type: '7' }
        ];
        const { root, type } = progression[barNumber % progression.length];
        
        const score = [];
        const patternType = Math.random(); // Decide whether to play a chord or arpeggio

        // Determine base octave, primarily 3rd, sometimes 4th
        let octave = (Math.random() < 0.75) ? 3 : 4;
        
        // Ensure the highest note of the chord doesn't go too high
        const tempChord = MusicUtils.getChord(root, type, octave);
        const highestNote = MusicUtils.getNoteMidi(tempChord[tempChord.length - 1]);
        if (highestNote > MusicUtils.getNoteMidi('B4')) {
            octave = 3;
        }

        const chordNotes = MusicUtils.getChord(root, type, octave);

        if (patternType < 0.5) { // Play a full chord
            score.push({ notes: chordNotes, duration: '1n', time: 0 });

        } else if (patternType < 0.75) { // Play arpeggio up
            chordNotes.forEach((note, index) => {
                score.push({
                    notes: note,
                    duration: '8n',
                    time: index * 0.5 // 16th notes
                });
            });
        } else { // Play arpeggio down
            chordNotes.slice().reverse().forEach((note, index) => {
                score.push({
                    notes: note,
                    duration: '8n',
                    time: index * 0.5 // 16th notes
                });
            });
        }
        return score;
    }
}


// --- Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    bpm: 100,
    scoreName: 'generative',
    instruments: {},
    drumSettings: {},

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDurationSeconds() { return this.beatsPerBar * this.secondsPerBeat; },
    get barDurationMillis() { return this.barDurationSeconds * 1000; },

    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
        this.tick();
        this.intervalId = setInterval(() => this.tick(), this.barDurationMillis);
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
        if (settings.score) this.scoreName = settings.score;
        
        // If already running, restart the interval with the new BPM
        if (this.isRunning) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.tick(), this.barDurationMillis);
        }
    },

    getScoreForBar(scoreData, bar, beatsPerBar) {
        const startTime = bar * beatsPerBar;
        const endTime = startTime + beatsPerBar;
        return scoreData.filter(note => note.time >= startTime && note.time < endTime)
                        .map(note => ({ ...note, time: note.time - startTime }));
    },

    tick() {
        if (!this.isRunning) return;
        
        if (this.scoreName === 'promenade') {
            const barInScore = this.barCount % 4; // Promenade score is 4 bars long
            if (this.drumSettings.enabled) {
                const drumScore = this.getScoreForBar(promenadeScore.drums, barInScore, this.beatsPerBar);
                self.postMessage({ type: 'drum_score', data: { score: drumScore } });
            }
            if (this.instruments.bass !== 'none') {
                 const bassScore = this.getScoreForBar(promenadeScore.bass, barInScore, this.beatsPerBar);
                 self.postMessage({ type: 'bass_score', data: { score: bassScore } });
            }
            if (this.instruments.solo !== 'none') {
                const soloScore = this.getScoreForBar(promenadeScore.solo, barInScore, this.beatsPerBar);
                 self.postMessage({ type: 'solo_score', data: { score: soloScore } });
            }
             if (this.instruments.accompaniment !== 'none') {
                const accompanimentScore = this.getScoreForBar(promenadeScore.accompaniment, barInScore, this.beatsPerBar);
                 self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
            }

        } else { // Generative score
            if (this.drumSettings.enabled) {
                const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
                self.postMessage({ type: 'drum_score', data: { score: drumScore } });
            }
            if (this.instruments.bass !== 'none') {
                const bassScore = BassGenerator.createScore(this.instruments.bass, this.barCount);
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

// --- MessageBus (Entry Point) ---
self.onmessage = (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                // Worker doesn't need to decode, just receives sampleRate
                Scheduler.updateSettings({ sampleRate: data.sampleRate });
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

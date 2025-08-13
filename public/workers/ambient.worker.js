
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 */

// --- Type Definitions for Clarity ---
/**
 * @typedef {object} DrumNote
 * @property {string} sample
 * @property {number} time
 * @property {number} [velocity]
 */
/**
 * @typedef {object} BassNote
 * @property {string} note
 * @property {number} time
 * @property {import('tone').Unit.Time} duration
 * @property {number} velocity
 */
/**
 * @typedef {object} SoloNote
 * @property {string|string[]} notes
 * @property {import('tone').Unit.Time} time
 * @property {import('tone').Unit.Time} duration
 */
/**
 * @typedef {object} AccompanimentNote
 * @property {string|string[]} notes
 * @property {import('tone').Unit.Time} time
 * @property {import('tone').Unit.Time} duration
 */

// --- 1. Score Library ---
const promenadeScore = {
    drums: [
        { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
        { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 }, { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
        { sample: 'kick', time: 4 }, { sample: 'hat', time: 4.5 }, { sample: 'snare', time: 5 }, { sample: 'hat', time: 5.5 },
        { sample: 'kick', time: 6 }, { sample: 'hat', time: 6.5 }, { sample: 'snare', time: 7 }, { sample: 'hat', time: 7.5 },
        { sample: 'kick', time: 8 }, { sample: 'hat', time: 8.5 }, { sample: 'snare', time: 9 }, { sample: 'hat', time: 9.5 },
        { sample: 'kick', time: 10 }, { sample: 'hat', time: 10.5 }, { sample: 'snare', time: 11 }, { sample: 'hat', time: 11.5 },
        { sample: 'crash', time: 12, velocity: 0.8 }, { sample: 'hat', time: 12.5 }, { sample: 'snare', time: 13 }, { sample: 'hat', time: 13.5 },
        { sample: 'kick', time: 14 }, { sample: 'hat', time: 14.5 }, { sample: 'snare', time: 15 }, { sample: 'hat', time: 15.5 },
    ],
    bass: [
        { note: 'E2', time: 0, duration: '1n', velocity: 0.9 },
        { note: 'C2', time: 4, duration: '1n', velocity: 0.85 },
        { note: 'G2', time: 8, duration: '1n', velocity: 0.88 },
        { note: 'D2', time: 12, duration: '1n', velocity: 0.86 },
    ],
    solo: [
        { notes: 'B3', duration: '8n', time: 0.5 }, { notes: 'G3', duration: '8n', time: 1.5 },
        { notes: 'A3', duration: '4n', time: 2.5 }, { notes: 'G3', duration: '8n', time: 4.5 },
        { notes: 'E3', duration: '8n', time: 5.5 }, { notes: 'C3', duration: '4n', time: 6.5 },
        { notes: 'D3', duration: '2n', time: 8.5 }, { notes: 'E3', duration: '8n', time: 12.5 },
        { notes: 'G3', duration: '8n', time: 13.5 }, { notes: 'B3', duration: '4n', time: 14.5 },
    ],
    accompaniment: [
        { notes: ['E3', 'G3', 'B3'], duration: '1n', time: 0 },
        { notes: ['C3', 'E3', 'G3'], duration: '1n', time: 4 },
        { notes: ['G3', 'B3', 'D4'], duration: '1n', time: 8 },
        { notes: ['D3', 'F#3', 'A3'], duration: '1n', time: 12 },
    ]
};


// --- 2. PatternProvider (The Music Sheet Library) ---
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
        slow: [ { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 }, { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 } ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 }, { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 }, { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ],
    },

    chordProgressions: {
        // Basic I-V-vi-IV in C Major
        'Cmaj_Am_F_G': ['C', 'G', 'Am', 'F'],
        // Simple ii-V-I in A minor
        'Bm7b5_E7_Am': ['Bm7b5', 'E7', 'Am', 'Am'],
        // Modal E minor progression
        'Em_C_G_D': ['Em', 'C', 'G', 'D'],
    },
    
    // --- Music Theory Helpers ---
    notesInScale: {
        'C': { major: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], minor: ['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb'] },
        'G': { major: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'], minor: ['G', 'A', 'Bb', 'C', 'D', 'Eb', 'F'] },
        'D': { major: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'], minor: ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'] },
        'A': { major: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'], minor: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },
        'E': { major: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'], minor: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'] },
        'B': { major: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'], minor: ['B', 'C#', 'D', 'E', 'F#', 'G', 'A'] },
        'F#':{ major: ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'], minor: ['F#', 'G#', 'A', 'B', 'C#', 'D', 'E'] },
        'C#':{ major: ['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'B#'], minor: ['C#', 'D#', 'E', 'F#', 'G#', 'A', 'B'] },
        'F': { major: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'], minor: ['F', 'G', 'Ab', 'Bb', 'C', 'Db', 'Eb'] },
        'Bb':{ major: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'], minor: ['Bb', 'C', 'Db', 'Eb', 'F', 'Gb', 'Ab'] },
        'Eb':{ major: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'], minor: ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db'] },
        'Ab':{ major: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'], minor: ['Ab', 'Bb', 'Cb', 'Db', 'Eb', 'Fb', 'Gb'] },
    },
    
    chords: {
        'C': ['C', 'E', 'G'], 'G': ['G', 'B', 'D'], 'Am': ['A', 'C', 'E'], 'F': ['F', 'A', 'C'],
        'Bm7b5': ['B', 'D', 'F', 'A'], 'E7': ['E', 'G#', 'B', 'D'], 'Em': ['E', 'G', 'B'], 'D': ['D', 'F#', 'A'],
    },

    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },

    getChordProgression(name) {
        return this.chordProgressions[name] || this.chordProgressions.Em_C_G_D;
    },

    getChordNotes(chordName, octave = 3) {
        const notes = this.chords[chordName];
        if (!notes) return [];
        return notes.map(note => `${note}${octave}`);
    },

    getRandomNoteFromChord(chordName, octave = 4) {
        const notes = this.chords[chordName];
        if (!notes || notes.length === 0) return `${'C'}${octave}`;
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        return `${randomNote}${octave}`;
    }
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
    /** @returns {BassNote[]} */
    static createScore(chord, beatsPerBar = 4) {
        // Simple bassline: root note on the first beat of the bar
        const rootNote = chord.replace(/m|7|b5/g, ''); // Get root note from chord name
        const score = [
            { note: `${rootNote}2`, time: 0, duration: '1n', velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    /** @returns {SoloNote[]} */
    static createScore(chord) {
        const score = [];
        // Simple melodic idea: play a random chord note on the second beat
        if (Math.random() > 0.4) { // 60% chance to play a note
            const note = PatternProvider.getRandomNoteFromChord(chord, 4);
            score.push({
                notes: note,
                time: Math.random() * 3, // random time in the bar
                duration: ['8n', '4n'][Math.floor(Math.random() * 2)]
            });
        }
        return score;
    }
}

class AccompanimentGenerator {
    /** @returns {AccompanimentNote[]} */
    static createScore(chord) {
        const score = [{
            notes: PatternProvider.getChordNotes(chord, 3),
            time: 0,
            duration: '1n'
        }];
        return score;
    }
}

// --- 4. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {}, // { kick: Float32Array, snare: Float32Array, ... }
    isReady: false,

    async init(samples, sampleRate) {
        // This is now non-blocking and happens in the background.
        // The main thread is notified of readiness immediately.
        this.decodeSamples(samples, sampleRate)
            .then(() => {
                this.isReady = true;
                console.log("SampleBank finished decoding samples in background.");
            })
            .catch(e => {
                 self.postMessage({ type: 'error', error: `Failed to decode samples: ${e.message}` });
            });
    },

    async decodeSamples(samples, sampleRate) {
        const tempAudioContext = new OfflineAudioContext(1, 1, sampleRate);
        const decodePromises = Object.entries(samples).map(async ([key, buffer]) => {
            if (buffer.byteLength > 0) {
                 try {
                    const audioBuffer = await tempAudioContext.decodeAudioData(buffer.slice(0));
                    this.samples[key] = audioBuffer.getChannelData(0);
                } catch(e) {
                    console.error(`Failed to decode sample ${key}:`, e);
                    // Don't post error here to avoid spamming, but log it.
                }
            }
        });
        await Promise.all(decodePromises);
    },

    getSample(name) {
        return this.samples[name];
    }
};


// --- 5. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    bpm: 120,
    scoreName: 'generative',
    instruments: {},
    drumSettings: {},
    chordProgression: [],

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },
    get loopLengthInBars() { return this.chordProgression.length; },


    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.tick(); // Generate the first chunk immediately
        this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isRunning = false;
        this.barCount = 0;
        self.postMessage({ type: 'stopped' });
    },
    
    updateSettings(settings) {
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.scoreName = settings.score;
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;

        // For now, let's use a fixed progression for generative mode
        this.chordProgression = PatternProvider.getChordProgression('Em_C_G_D');
    },

    tick() {
        if (!this.isRunning) return;

        if (this.scoreName === 'promenade') {
            this.playPromenadeScore();
        } else {
            this.generateAndPlayProceduralScore();
        }

        this.barCount++;
    },

    playPromenadeScore() {
        const currentBeat = (this.barCount * this.beatsPerBar) % (promenadeScore.drums.length);
        const lookahead = this.barDuration; // 1 bar ahead

        const filterScore = (score) => score.filter(note => note.time >= currentBeat && note.time < currentBeat + lookahead);
        
        if (this.drumSettings.enabled) {
            self.postMessage({ type: 'drum_score', data: { score: filterScore(promenadeScore.drums) }});
        }
        if (this.instruments.bass !== 'none') {
             self.postMessage({ type: 'bass_score', data: { score: filterScore(promenadeScore.bass) }});
        }
        if (this.instruments.solo !== 'none') {
            self.postMessage({ type: 'solo_score', data: { score: filterScore(promenadeScore.solo) }});
        }
        if (this.instruments.accompaniment !== 'none') {
            self.postMessage({ type: 'accompaniment_score', data: { score: filterScore(promenadeScore.accompaniment) }});
        }
    },
    
    generateAndPlayProceduralScore() {
        const currentBarInLoop = this.barCount % this.loopLengthInBars;
        const currentChord = this.chordProgression[currentBarInLoop];

        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(currentChord);
            self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }
        
        if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore(currentChord);
            self.postMessage({ type: 'solo_score', data: { score: soloScore } });
        }

        if (this.instruments.accompaniment !== 'none') {
            const accompanimentScore = AccompanimentGenerator.createScore(currentChord);
            self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
        }
    }
};


// --- MessageBus (The "Kafka" entry point) ---
self.onmessage = async (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                // Immediately confirm initialization to the main thread.
                self.postMessage({ type: 'initialized' });
                // Start decoding samples in the background, non-blockingly.
                await SampleBank.init(data.samples, data.sampleRate);
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

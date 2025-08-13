
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 */

// --- Type Definitions ---
/**
 * @typedef {Object} DrumNote
 * @property {string} sample
 * @property {number} time
 * @property {number} [velocity]
 */

/**
 * @typedef {Object} BassNote
 * @property {string} note
 * @property {Tone.Unit.Time} duration
 * @property {number} time
 * @property {number} velocity
 */

/**
 * @typedef {Object} SoloNote
 * @property {string|string[]} notes
 * @property {Tone.Unit.Time} duration
 * @property {Tone.Unit.Time} time
 */
 
/**
 * @typedef {Object} AccompanimentNote
 * @property {string|string[]} notes
 * @property {Tone.Unit.Time} duration
 * @property {Tone.Unit.Time} time
 */
 
/**
 * @typedef {Object} EffectNote
 * @property {string} note
 * @property {Tone.Unit.Time} duration
 * @property {number} time
 */
 
// --- 1. Pattern & Score Providers ---

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
    harmony: {
        // Simple E-minor progression
        chords: ['Em', 'C', 'G', 'D'],
        durations: [4, 4, 4, 4], // beats per chord
        totalBeats: 16,
    },
    getCurrentChord(beats) {
        const progressionTime = beats % this.totalBeats;
        let cumulativeDuration = 0;
        for (let i = 0; i < this.chords.length; i++) {
            cumulativeDuration += this.durations[i];
            if (progressionTime < cumulativeDuration) {
                return this.chords[i];
            }
        }
        return this.chords[0];
    },
    getChordNotes(chordName, octave) {
        const root = chordName.replace('m', '');
        const quality = chordName.endsWith('m') ? 'minor' : 'major';
        const notes = Tonal.Chord.get(chordName).notes;
        return notes.map(n => `${n}${octave}`);
    }
};

const promenadeScore = {
    drums: [
        { sample: 'kick', time: 0 },{ sample: 'hat', time: 0.5 },{ sample: 'snare', time: 1 },{ sample: 'hat', time: 1.5 },{ sample: 'kick', time: 2 },{ sample: 'hat', time: 2.5 },{ sample: 'snare', time: 3 },{ sample: 'hat', time: 3.5 },
        { sample: 'kick', time: 4 },{ sample: 'hat', time: 4.5 },{ sample: 'snare', time: 5 },{ sample: 'hat', time: 5.5 },{ sample: 'kick', time: 6 },{ sample: 'hat', time: 6.5 },{ sample: 'snare', time: 7 },{ sample: 'hat', time: 7.5 },
        { sample: 'kick', time: 8 },{ sample: 'hat', time: 8.5 },{ sample: 'snare', time: 9 },{ sample: 'hat', time: 9.5 },{ sample: 'kick', time: 10 },{ sample: 'hat', time: 10.5 },{ sample: 'snare', time: 11 },{ sample: 'hat', time: 11.5 },
        { sample: 'crash', time: 12, velocity: 0.8 },{ sample: 'hat', time: 12.5 },{ sample: 'snare', time: 13 },{ sample: 'hat', time: 13.5 },{ sample: 'kick', time: 14 },{ sample: 'hat', time: 14.5 },{ sample: 'snare', time: 15 },{ sample: 'hat', time: 15.5 },
    ],
    bass: [
        { note: 'E2', time: 0, duration: '1n', velocity: 0.9 },
        { note: 'C2', time: 4, duration: '1n', velocity: 0.85 },
        { note: 'G2', time: 8, duration: '1n', velocity: 0.88 },
        { note: 'D2', time: 12, duration: '1n', velocity: 0.86 },
    ],
    solo: [
        { notes: 'B3', duration: '8n', time: 0.5 },{ notes: 'G3', duration: '8n', time: 1.5 },{ notes: 'A3', duration: '4n', time: 2.5 },
        { notes: 'G3', duration: '8n', time: 4.5 },{ notes: 'E3', duration: '8n', time: 5.5 },{ notes: 'C3', duration: '4n', time: 6.5 },
        { notes: 'D3', duration: '2n', time: 8.5 },
        { notes: 'E3', duration: '8n', time: 12.5 },{ notes: 'G3', duration: '8n', time: 13.5 },{ notes: 'B3', duration: '4n', time: 14.5 },
    ],
    accompaniment: [
        { notes: ['E2', 'G2', 'B2'], duration: '1n', time: 0 },
        { notes: ['C2', 'E2', 'G2'], duration: '1n', time: 4 },
        { notes: ['G2', 'B2', 'D3'], duration: '1n', time: 8 },
        { notes: ['D2', 'F#2', 'A2'], duration: '1n', time: 12 },
    ],
    effects: [],
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
    static createScore(beats) {
        const chord = PatternProvider.getCurrentChord(beats);
        const rootNote = Tonal.Chord.get(chord).tonic;
        const score = [
            { note: `${rootNote}2`, time: 0, duration: '1n', velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static createScore(beats) {
        const score = [];
        const chord = PatternProvider.getCurrentChord(beats);
        const scale = Tonal.Chord.get(chord).notes.map(n => `${n}3`);

        // Simple algorithm: play a random note from the scale on the off-beats
        for (let i = 0; i < 4; i++) {
            if (Math.random() > 0.6) {
                const note = scale[Math.floor(Math.random() * scale.length)];
                score.push({
                    notes: note,
                    duration: '8n',
                    time: i + 0.5,
                });
            }
        }
        return score;
    }
}

class AccompanimentGenerator {
    static createScore(beats) {
        const chordName = PatternProvider.getCurrentChord(beats);
        const baseNotes = Tonal.Chord.get(chordName).notes;

        const getChordNotesWithOctaves = (octaves) => {
            const chordWithOctaves = [];
            let currentNoteIndex = 0;
            for (const octave of octaves) {
                chordWithOctaves.push(`${baseNotes[currentNoteIndex]}${octave}`);
                currentNoteIndex = (currentNoteIndex + 1) % baseNotes.length;
            }
            return chordWithOctaves;
        };

        const mode = Math.random();
        if (mode < 0.4) { // Full chord
            const notes = getChordNotesWithOctaves([3, 3, 4, 4]);
            return [{ notes: notes, duration: '1n', time: 0 }];
        } else if (mode < 0.7) { // Arpeggio up
            const notes = getChordNotesWithOctaves([3, 3, 4, 4]);
            return notes.map((note, i) => ({
                notes: note,
                duration: '8n',
                time: i * 0.5,
            }));
        } else { // Arpeggio down
            const notes = getChordNotesWithOctaves([4, 4, 3, 3]).reverse();
            return notes.map((note, i) => ({
                notes: note,
                duration: '8n',
                time: i * 0.5,
            }));
        }
    }
}


class EffectsGenerator {
    static createScore(beats) {
        const score = [];
        // Add a random bell sound occasionally on the last beat
        if (Math.random() < 0.25) {
             score.push({
                note: 'C5',
                duration: '16n',
                time: 3.75, // very end of the bar
             });
        }
        return score;
    }
}


// --- 3. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {},
    isInitialized: false,

    async init(samples, sampleRate) {
        const tempAudioContext = new OfflineAudioContext(1, 1, sampleRate);
        
        const decodingPromises = Object.entries(samples).map(async ([key, arrayBuffer]) => {
            if (arrayBuffer.byteLength > 0) {
                try {
                    const audioBuffer = await tempAudioContext.decodeAudioData(arrayBuffer.slice(0));
                    this.samples[key] = audioBuffer.getChannelData(0);
                } catch (e) {
                     // Can't use console.error in worker, post message instead
                    self.postMessage({ type: 'error', error: `Failed to decode sample ${key}: ${e instanceof Error ? e.message : String(e)}` });
                }
            }
        });

        await Promise.all(decodingPromises);
        this.isInitialized = true;
    },

    getSample(name) {
        return this.samples[name];
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
    instruments: {},
    drumSettings: {},
    effectsSettings: {},
    scoreName: 'generative',


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
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.scoreName = settings.score;
        if (settings.effectsSettings) this.effectsSettings = settings.effectsSettings;
    },

    tick() {
        if (!this.isRunning) return;
        
        const currentBeats = this.barCount * this.beatsPerBar;
        const totalLoopBeats = this.scoreName === 'promenade' ? 16 : PatternProvider.totalBeats;
        const loopPosition = currentBeats % totalLoopBeats;

        if (this.scoreName === 'promenade') {
            const getNotesForCurrentBar = (notes) => notes.filter(note => note.time >= loopPosition && note.time < loopPosition + this.beatsPerBar)
                                                          .map(note => ({ ...note, time: note.time - loopPosition }));
                                                          
            if (this.drumSettings.enabled) self.postMessage({ type: 'drum_score', data: { score: getNotesForCurrentBar(promenadeScore.drums) }});
            if (this.instruments.bass !== 'none') self.postMessage({ type: 'bass_score', data: { score: getNotesForCurrentBar(promenadeScore.bass) }});
            if (this.instruments.solo !== 'none') self.postMessage({ type: 'solo_score', data: { score: getNotesForCurrentBar(promenadeScore.solo) }});
            if (this.instruments.accompaniment !== 'none') self.postMessage({ type: 'accompaniment_score', data: { score: getNotesForCurrentBar(promenadeScore.accompaniment) }});
            if (this.effectsSettings.enabled) self.postMessage({ type: 'effects_score', data: { score: getNotesForCurrentBar(promenadeScore.effects) }});

        } else { // Generative
            if (this.drumSettings.enabled) self.postMessage({ type: 'drum_score', data: { score: DrumGenerator.createScore(this.drumSettings.pattern, this.barCount) } });
            if (this.instruments.bass !== 'none') self.postMessage({ type: 'bass_score', data: { score: BassGenerator.createScore(currentBeats) }});
            if (this.instruments.solo !== 'none') self.postMessage({ type: 'solo_score', data: { score: SoloGenerator.createScore(currentBeats) }});
            if (this.instruments.accompaniment !== 'none') self.postMessage({ type: 'accompaniment_score', data: { score: AccompanimentGenerator.createScore(currentBeats) }});
            if (this.effectsSettings.enabled) self.postMessage({ type: 'effects_score', data: { score: EffectsGenerator.createScore(currentBeats) }});
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
                // Dynamically import Tonal
                if (typeof Tonal === 'undefined') {
                    self.importScripts("https://unpkg.com/tonal@4.10.0/browser/tonal.min.js");
                }
                Scheduler.sampleRate = data.sampleRate;
                await SampleBank.init(data.samples, data.sampleRate);
                self.postMessage({ type: 'initialized' });
                break;
            
            case 'start':
                if (!SampleBank.isInitialized) {
                   throw new Error("Worker is not initialized with samples yet. Call 'init' first.");
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

    
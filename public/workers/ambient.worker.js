/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture, inspired by the user's feedback.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  MessageBus (self): The "Kafka" of the worker. Handles all communication
 *     between the main thread and the worker's internal systems.
 *
 * 2.  Scheduler: The central "conductor" or "event loop". It wakes up at regular
 *     intervals, determines what musical data is needed, and coordinates the other
 *     entities. It doesn't generate music itself, only directs the flow.
 *
 * 3.  Instrument Generators (e.g., DrumGenerator, BassGenerator): These are the "composers".
 *     They take musical parameters and return a "score" - a simple
 *     array of note events (`{ time, sample, velocity }`). They are stateless and
 *     know nothing about audio rendering.
 *
 * 4.  PatternProvider: The "music sheet library". It holds all rhythmic and melodic
 *     patterns. It's a simple data store that the Instrument Generators query.
 *
 * 5.  NoteGenerators: The AI/algorithmic part that creates melodies and basslines.
 *
 * Data Flow on Start:
 * - Main thread sends 'start' with instrument/drum settings.
 * - Scheduler starts its loop.
 * - In each loop:
 *   - Scheduler asks the appropriate generators for their scores for the next time slice.
 *   - Generators (Drum, Bass, etc.) create their scores.
 *   - Scheduler posts the final scores back to the main thread for rendering.
 *
 * This architecture ensures that changing a drum pattern CANNOT break the bass generator,
 * and changing the music generation logic CANNOT break the scheduler. Each part is
 * independent, testable, and replaceable.
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
    bassPatterns: {
        // Each pattern is an array of objects: { note, duration, time }
        // Note can be a number representing scale degree (0 = root)
        minimal: [
            { note: 0, duration: 4, time: 0 }, // Single root note for the whole bar
        ],
        walking: [
            { note: 0, duration: 1, time: 0 },
            { note: 2, duration: 1, time: 1 },
            { note: 4, duration: 1, time: 2 },
            { note: 5, duration: 1, time: 3 },
        ],
        arpeggio: [
            { note: 0, duration: 0.5, time: 0 },
            { note: 4, duration: 0.5, time: 0.5 },
            { note: 7, duration: 0.5, time: 1 }, // 7 is the octave
            { note: 4, duration: 0.5, time: 1.5 },
        ],
        rhythmic: [
             { note: 0, duration: 0.75, time: 0 },
             { note: 0, duration: 0.25, time: 0.75 },
             { note: 3, duration: 1, time: 1 },
             { note: 0, duration: 2, time: 2 },
        ]
    },
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
    getBassPattern(name) {
        if (name === 'random') {
            const keys = Object.keys(this.bassPatterns);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            return this.bassPatterns[randomKey];
        }
        return this.bassPatterns[name] || this.bassPatterns.minimal;
    }
};

const MusicTheory = {
    scales: {
        minor: [0, 2, 3, 5, 7, 8, 10], // Aeolian
    },
    getRootNote(barNumber) {
        // Simple I-IV-V-I progression in A minor
        const progression = ['A', 'D', 'E', 'A'];
        return progression[barNumber % 4];
    },
    getNoteFromScale(rootNote, scaleName, degree) {
        const scale = this.scales[scaleName];
        if (!scale) return `${rootNote}2`;

        const rootMidi = this.noteToMidi(rootNote + '0'); // Use octave 0 as base
        const degreeOffset = scale[degree % scale.length];
        const octaveOffset = Math.floor(degree / scale.length) * 12;

        return this.midiToNote(rootMidi + degreeOffset + octaveOffset);
    },
    noteToMidi(note) {
        const noteMap = {'C':0, 'C#':1, 'D':2, 'D#':3, 'E':4, 'F':5, 'F#':6, 'G':7, 'G#':8, 'A':9, 'A#':10, 'B':11};
        const noteName = note.slice(0, -1);
        const octave = parseInt(note.slice(-1));
        return noteMap[noteName] + (octave + 1) * 12;
    },
    midiToNote(midi) {
        const notes = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteName = notes[midi % 12];
        return noteName + octave;
    }
}


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
        
        return score;
    }
}

class BassGenerator {
    static createScore(barNumber) {
        const rootNote = MusicTheory.getRootNote(barNumber);
        const pattern = PatternProvider.getBassPattern('random');
        
        // The second octave is the primary, occasionally drop to the first.
        const baseOctave = Math.random() < 0.7 ? 2 : 1; 

        const score = pattern.map(item => {
            const noteName = MusicTheory.getNoteFromScale(rootNote, 'minor', item.note);
            // Manually set the octave
            const finalNote = noteName.slice(0, -1) + baseOctave;

            return {
                note: finalNote,
                time: item.time,
                duration: item.duration,
                velocity: 0.9,
            };
        });
        
        return score;
    }
}


class SoloGenerator {
    static createScore(barNumber) {
        const rootNote = MusicTheory.getRootNote(barNumber);
        const score = [];
        
        // Simple generative logic for a solo
        for (let i = 0; i < 4; i++) { // Generate 4 notes per bar
            if (Math.random() > 0.4) { // Add some silence
                const degree = Math.floor(Math.random() * 7); // Random degree in the scale
                const noteName = MusicTheory.getNoteFromScale(rootNote, 'minor', degree);
                const finalNote = noteName.slice(0,-1) + (Math.random() > 0.5 ? '4' : '3'); // Play in octaves 3 or 4
                
                score.push({
                    notes: finalNote,
                    duration: 0.5,
                    time: i + (Math.random() * 0.5 - 0.25), // Add slight timing variation
                });
            }
        }
        return score;
    }
}


// --- 5. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
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
        
        // 1. Ask generators for their scores
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount
            );
            self.postMessage({ type: 'drum_score', data: { score: drumScore, bar: this.barCount } });
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(this.barCount);
            self.postMessage({ type: 'bass_score', data: { score: bassScore, bar: this.barCount } });
        }
        
        if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore(this.barCount);
            self.postMessage({ type: 'solo_score', data: { score: soloScore, bar: this.barCount }});
        }


        this.barCount++;
    }
};


// --- MessageBus (The "Kafka" entry point) ---
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

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
 *     They take a time signature and a pattern name and return a "score" - a simple
 *     array of note events (`{ time, sample, velocity }`). They are stateless and
 *     know nothing about audio rendering.
 *
 * 4.  PatternProvider: The "music sheet library". It holds all rhythmic and melodic
 *     patterns. It's a simple data store that the Instrument Generators query.
 *
 * 5.  AudioRenderer: The "audio engine". Its ONLY job is to take a score (from any
 *     generator) and "render" it into a raw audio buffer (Float32Array). It handles
 *     mixing, volume, and sample placement. It is completely decoupled from musical logic.
 *
 * 6.  SampleBank: A repository for decoded audio samples, ensuring they are ready for
 *     the AudioRenderer to use instantly.
 *
 * Data Flow on Start:
 * - Main thread sends 'init' with samples and sampleRate.
 * - Worker decodes samples into SampleBank.
 * - Main thread sends 'start' with instrument/drum settings.
 * - Scheduler starts its loop.
 * - In each loop:
 *   - Scheduler asks the appropriate generators for their scores for the next time slice.
 *   - Generators ask PatternProvider for their patterns.
 *   - Generators create their scores and return them to the scheduler.
 *   - Scheduler passes all scores to the AudioRenderer.
 *   - AudioRenderer creates a blank audio chunk, "paints" the samples from each score onto it, and returns the mixed chunk.
 *   - Scheduler posts the final audio chunk back to the main thread.
 *
 * This architecture ensures that changing a drum pattern CANNOT break the audio renderer,
 * and changing the audio renderer CANNOT break the musical logic. Each part is
 * independent, testable, and replaceable, following the user's core architectural principle.
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
    static createScore(patternName, barNumber, totalBars, beatsPerBar = 4) {
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
     static createScore(rootNote = 'E', beatsPerBar = 4) {
        const octave = Math.random() > 0.4 ? '1' : '2';
        const score = [
            { note: `${rootNote}${octave}`, time: 0, duration: beatsPerBar, velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static getChord(root, quality) {
        // Simple triad logic for now
        const major = [0, 4, 7];
        const minor = [0, 3, 7];
        const qualities = {
            'maj': major,
            'min': minor
        };
        const intervals = qualities[quality] || major;
        // Using Tonal.js or a similar library would be better for real applications
        const C4 = 60; // MIDI for C4
        const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
        const rootMidi = noteNames.indexOf(root);
        
        if (rootMidi === -1) return [`${root}4`]; // fallback

        return intervals.map(i => {
            const noteIndex = (rootMidi + i) % 12;
            return `${noteNames[noteIndex]}4`;
        });
    }

    static createScore(rootNote = 'E', barNumber, beatsPerBar = 4) {
        const score = [];
        
        const possibleNotes = ['E4', 'G4', 'A4', 'B4', 'D5'];
        const longNoteChance = 0.3;

        if (barNumber % 8 === 0) {
            // Play a long, held root note for the whole bar
             score.push({
                notes: `${rootNote}4`,
                time: 0,
                duration: beatsPerBar,
                velocity: 0.5
            });
        } else if (barNumber % 4 === 0) {
             // Play a chord
            const chord = this.getChord(rootNote, 'min');
             score.push({
                notes: chord,
                time: 0,
                duration: beatsPerBar / 2,
                velocity: 0.4
            });
        }
        else {
            // Arpeggiate or play single notes
            for(let i=0; i < beatsPerBar; i++) {
                if(Math.random() > 0.6) { // add some silence
                    const note = possibleNotes[Math.floor(Math.random() * possibleNotes.length)];
                    score.push({
                        notes: note,
                        time: i,
                        duration: Math.random() > longNoteChance ? 0.5 : 1.0,
                        velocity: 0.3 + Math.random() * 0.3
                    });
                }
            }
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
        if(settings.bpm) this.bpm = settings.bpm;
    },

    tick() {
        if (!this.isRunning) return;
        
        // 1. Ask generators for their scores
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount,
                -1 // totalBars not needed for this simple generator
            );
             self.postMessage({
                type: 'drum_score',
                data: { score: drumScore }
            });
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore('E', this.beatsPerBar);
            self.postMessage({
                type: 'bass_score',
                data: { score: bassScore }
            });
        }
        
         if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore('E', this.barCount, this.beatsPerBar);
             self.postMessage({
                type: 'solo_score',
                data: { score: soloScore }
            });
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


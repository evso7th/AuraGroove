/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication with the main thread.
 *
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals, determines
 *     what musical data is needed based on a chosen chord progression, and coordinates the other
 *     entities. It directs the flow of music.
 *
 * 3.  MusicTheory: A static library containing chord progressions and scale information. It
 *     provides the harmonic foundation for the generators.
 *
 * 4.  Instrument Generators (DrumGenerator, BassGenerator, SoloGenerator): These are the "composers".
 *     They receive the current chord and other parameters from the Scheduler and return a "score" -
 *     a simple array of note events. They are stateless.
 *
 * 5.  PatternProvider: The "music sheet library" for rhythmic patterns, used by generators.
 *
 * Data Flow on Start:
 * - Main thread sends 'start' with instrument/drum settings.
 * - Scheduler selects a chord progression from MusicTheory.
 * - Scheduler starts its loop (tick).
 * - In each loop:
 *   - Scheduler determines the current chord based on the bar number.
 *   - Scheduler asks the appropriate generators for their scores, passing them the current chord.
 *   - Generators create their scores (e.g., bassline on the root, solo using chord tones).
 *   - Scheduler posts the generated scores for each instrument back to the main thread.
 *   - The main thread uses Tone.js to schedule and play these notes.
 *
 * This architecture ensures that all instruments play in harmony, following a structured
 * progression, while still allowing for variation and improvisation within that structure.
 */

// --- 1. MusicTheory (The Harmonic Foundation) ---
const MusicTheory = {
    progressions: [
        { name: 'Classic Ambient', chords: ['Em', 'C', 'G', 'D'] },
        { name: 'Spacey', chords: ['Am', 'F', 'C', 'G'] },
        { name: 'Lofi', chords: ['Cmaj7', 'Fmaj7', 'Am7', 'G7'] },
    ],
    chords: {
        // Major
        'C': ['C', 'E', 'G'], 'D': ['D', 'F#', 'A'], 'G': ['G', 'B', 'D'], 'F': ['F', 'A', 'C'],
        // Minor
        'Em': ['E', 'G', 'B'], 'Am': ['A', 'C', 'E'],
        // 7ths
        'Cmaj7': ['C', 'E', 'G', 'B'], 'Fmaj7': ['F', 'A', 'C', 'E'],
        'Am7': ['A', 'C', 'E', 'G'], 'G7': ['G', 'B', 'D', 'F'],
    },
    getRandomProgression() {
        return this.progressions[Math.floor(Math.random() * this.progressions.length)];
    },
    getChordNotes(chordName, octave) {
        const notes = this.chords[chordName as keyof typeof this.chords] || [];
        return notes.map(note => `${note}${octave}`);
    }
};


// --- 2. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 },
            { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 },
            { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'kick', time: 0.75 },
            { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 }, { sample: 'kick', time: 2 },
            { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 }, { sample: 'snare', time: 3.25 },
            { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 },
            { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 },
            { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 },
            { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ],
    },
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
};

// --- 3. Instrument Generators (The Composers) ---
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
    static createScore(currentChord) {
        const rootNote = MusicTheory.chords[currentChord][0];
        
        // Prefer the 2nd octave, but sometimes drop to the 1st for variety.
        const octave = Math.random() < 0.3 ? 1 : 2; 

        // Simple pattern: Root note on the first beat of the bar.
        const score = [
            { note: `${rootNote}${octave}`, time: 0, duration: '1n', velocity: 0.9 }
        ];

        // Occasionally add a passing note from the chord on the 3rd beat.
        if (Math.random() < 0.4) {
             const passingNote = MusicTheory.chords[currentChord][1] || MusicTheory.chords[currentChord][0];
             score.push({ note: `${passingNote}${octave}`, time: 2, duration: '4n', velocity: 0.7 });
        }

        return score;
    }
}

class SoloGenerator {
     static createScore(currentChord) {
        const score = [];
        const chordNotes = MusicTheory.getChordNotes(currentChord, 4); // Play in the 4th octave
        if (chordNotes.length === 0) return [];

        // Create a simple, sparse melody based on the chord notes
        const numberOfNotes = Math.floor(Math.random() * 3) + 1; // 1 to 3 notes per bar
        for (let i = 0; i < numberOfNotes; i++) {
            const note = chordNotes[Math.floor(Math.random() * chordNotes.length)];
            const time = (i * (4 / numberOfNotes)) + (Math.random() * 0.5 - 0.25); // Stagger timing a bit
            const duration = Math.random() > 0.5 ? '4n' : '8n';
            const velocity = Math.random() * 0.3 + 0.6; // Velocity between 0.6 and 0.9
            
            if (time >= 0 && time < 4) {
                 score.push({ notes: note, duration, time, velocity });
            }
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
    bpm: 120,
    instruments: {},
    drumSettings: {},
    
    // Harmonic context
    progression: MusicTheory.getRandomProgression(),

    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },
    
    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
        
        // Pre-schedule the first tick to make startup feel faster
        setTimeout(() => this.tick(), 10);
        
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
        this.progression = MusicTheory.getRandomProgression(); // New progression each time
    },
    
    updateSettings(settings) {
        this.instruments = settings.instruments ?? this.instruments;
        this.drumSettings = settings.drumSettings ?? this.drumSettings;
        this.bpm = settings.bpm ?? this.bpm;
        
        // If BPM changes, we need to restart the interval to get the new timing.
        if (this.isRunning) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        }
    },

    tick() {
        if (!this.isRunning) return;
        
        const currentChordIndex = this.barCount % this.progression.chords.length;
        const currentChord = this.progression.chords[currentChordIndex];

        // 1. Generate scores based on the current chord
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
            self.postMessage({ type: 'solo_score', data: { score: soloScore }});
        }

        this.barCount++;
    }
};


// --- 5. MessageBus (The Entry Point) ---
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



/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * It uses a compositional approach where a Scheduler directs several stateless
 * Instrument Generators to create musical scores based on a shared harmonic context
 * provided by the MusicTheory module.
 */


// --- 1. MusicTheory (The Harmonic Brain) ---
const MusicTheory = {
    progressions: {
        // A classic, uplifting progression
        'uplifting': ['G', 'D', 'Em', 'C'],
        // A more pensive, moody progression
        'pensive': ['Am', 'G', 'C', 'F'],
        // A simple, common progression
        'simple': ['C', 'G', 'Am', 'F'],
    },
    chords: {
        'C': ['C', 'E', 'G'],
        'G': ['G', 'B', 'D'],
        'Am': ['A', 'C', 'E'],
        'F': ['F', 'A', 'C'],
        'D': ['D', 'F#', 'A'],
        'Em': ['E', 'G', 'B'],
    },
    
    getChordNotes(chordName) {
        return this.chords[chordName];
    },

    getRandomProgression() {
        const keys = Object.keys(this.progressions);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        return this.progressions[randomKey];
    }
};


// --- 2. Instrument Generators (The Composers) ---

class DrumGenerator {
    static getPattern(name) {
        const patterns = {
            basic: [
                { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 },
                { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
                { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 },
                { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
            ],
            breakbeat: [
                { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'kick', time: 0.75 },
                { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
                { sample: 'kick', time: 2 }, { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 },
                { sample: 'snare', time: 3.25 }, { sample: 'hat', time: 3.5 },
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
        };
        return patterns[name] || patterns.basic;
    }

    static createScore(patternName, barNumber) {
        const pattern = this.getPattern(patternName);
        let score = [...pattern];
        if (barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
    static getPattern(rootNote) {
         const patterns = [
            [{ note: `${rootNote}1`, time: 0, duration: 4 }], // Whole note
            [{ note: `${rootNote}1`, time: 0, duration: 2 }, { note: `${rootNote}1`, time: 2, duration: 2 }], // Half notes
            [{ note: `${rootNote}1`, time: 0, duration: 1 }, { note: `${rootNote}1`, time: 1, duration: 1 }, { note: `${rootNote}1`, time: 2, duration: 1 }, { note: `${rootNote}1`, time: 3, duration: 1 }], // Quarter notes
        ];
        // Choose a random pattern
        return patterns[Math.floor(Math.random() * patterns.length)];
    }
    
    static createScore(currentChord) {
        const rootNote = MusicTheory.getChordNotes(currentChord.name)[0];
        const octave = Math.random() < 0.7 ? '2' : '1'; // 70% chance for 2nd octave
        
        // Simple pattern: play the root note of the chord.
        // More complex patterns can be added here later.
        const score = [
            { note: `${rootNote}${octave}`, time: 0, duration: 4, velocity: 0.9 }
        ];

        return score.map(note => ({ ...note, velocity: 0.9 }));
    }
}

class SoloGenerator {
     static createScore(currentChord) {
        const chordNotes = MusicTheory.getChordNotes(currentChord.name);
        const score = [];

        // Determine octave: 3rd or 4th, avoiding the 5th.
        const octave = Math.random() < 0.5 ? 3 : 4; 
        
        // Simple pattern: play one long note from the chord
        const note = chordNotes[Math.floor(Math.random() * chordNotes.length)];
        score.push({ notes: [`${note}${octave}`], duration: 4, time: 0, velocity: 0.6 });

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
    instruments: { solo: 'none', bass: 'none' },
    drumSettings: { enabled: false, pattern: 'basic', volume: 0.7 },

    // Harmonic context
    currentProgression: [],
    currentChordIndex: 0,

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;
        
        // Set up the harmonic context
        this.currentProgression = MusicTheory.getRandomProgression();
        this.currentChordIndex = 0;
        
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
        this.currentChordIndex = 0;
    },
    
    updateSettings(settings) {
       if (settings.instruments) this.instruments = settings.instruments;
       if (settings.drumSettings) this.drumSettings = settings.drumSettings;
       if (settings.bpm) {
            this.bpm = settings.bpm;
            // If running, restart the interval with the new speed
            if (this.isRunning) {
                clearInterval(this.intervalId);
                this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
            }
        }
    },

    tick() {
        if (!this.isRunning) return;

        // Determine current chord
        const currentChordName = this.currentProgression[this.currentChordIndex];
        const currentChord = { name: currentChordName, notes: MusicTheory.getChordNotes(currentChordName) };
        
        // Generate scores based on the current chord
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
            if (soloScore) {
                self.postMessage({ type: 'solo_score', data: { score: soloScore } });
            }
        }

        // Advance to the next bar and chord
        this.barCount++;
        this.currentChordIndex = (this.currentChordIndex + 1) % this.currentProgression.length;
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

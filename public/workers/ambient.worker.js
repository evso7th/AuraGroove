/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 */

// --- 1. MusicTheory (The Harmony Rulebook) ---
const MusicTheory = {
    progressions: {
        // Standard ambient/cinematic progressions
        'Am-G-C-F': ['Am', 'G', 'C', 'F'],
        'C-G-Am-F': ['C', 'G', 'Am', 'F'],
        'Em-C-G-D': ['Em', 'C', 'G', 'D'],
        'Bm-G-D-A': ['Bm', 'G', 'D', 'A'],
    },
    chords: {
        // Major Chords (Root, Major Third, Perfect Fifth)
        'C': ['C', 'E', 'G'],
        'F': ['F', 'A', 'C'],
        'G': ['G', 'B', 'D'],
        'D': ['D', 'F#', 'A'],
        'A': ['A', 'C#', 'E'],
        // Minor Chords (Root, Minor Third, Perfect Fifth)
        'Am': ['A', 'C', 'E'],
        'Em': ['E', 'G', 'B'],
        'Bm': ['B', 'D', 'F#'],
    },
    getNotesInChord(chordName) {
        return this.chords[chordName] || [];
    },
};


// --- 2. PatternProvider (The Music Sheet Library) ---
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
       root_note: [
            { time: 0, duration: 2, offset: 0 }, // Play root note for half the bar
            { time: 2, duration: 2, offset: 0 }, // Play root note for the other half
       ],
       root_fifth: [
           { time: 0, duration: 2, offset: 0 }, // Root
           { time: 2, duration: 1, offset: 7 }, // Fifth (7 semitones)
       ],
       arp_up: [
           { time: 0, duration: 1, offset: 0 }, // Root
           { time: 1, duration: 1, offset: 4 }, // Third (or minor third)
           { time: 2, duration: 1, offset: 7 }, // Fifth
       ]
    },
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
    getRandomBassPattern() {
        const patternNames = Object.keys(this.bassPatterns);
        const randomName = patternNames[Math.floor(Math.random() * patternNames.length)];
        return this.bassPatterns[randomName];
    }
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
        const rootNote = MusicTheory.getNotesInChord(currentChord)[0];
        if (!rootNote) return [];

        const pattern = PatternProvider.getRandomBassPattern();
        
        // Make the bass play primarily in the 2nd octave, occasionally dipping to the 1st
        const octave = Math.random() < 0.3 ? '1' : '2';

        const score = pattern.map(noteInfo => ({
            note: rootNote + octave, // Bass synth handles semitone offsets internally
            time: noteInfo.time,
            duration: noteInfo.duration,
            velocity: 0.8
        }));
        
        return score;
    }
}

class SoloGenerator {
    static createScore(currentChord) {
        const chordNotes = MusicTheory.getNotesInChord(currentChord);
        if (!chordNotes || chordNotes.length === 0) return [];
        
        const score = [];
        const octave = '4'; // Let's keep the solo in a higher register

        // Simple logic: play one or two notes from the chord
        const noteCount = Math.random() > 0.6 ? 2 : 1;
        for (let i = 0; i < noteCount; i++) {
             score.push({
                notes: [chordNotes[Math.floor(Math.random() * chordNotes.length)] + octave],
                time: i * 2, // Stagger the notes
                duration: 1.5,
                velocity: 0.5 + Math.random() * 0.2, // Add some velocity variation
            });
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
    progression: [],
    progressionIndex: 0,

    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },

    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
        
        this.tick();

        this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        self.postMessage({ type: 'started' }); // Corrected postMessage
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
        this.progressionIndex = 0;
        // Select a new chord progression on reset
        const progressionNames = Object.keys(MusicTheory.progressions);
        const randomProgressionName = progressionNames[Math.floor(Math.random() * progressionNames.length)];
        this.progression = MusicTheory.progressions[randomProgressionName];
    },
    
    updateSettings(settings) {
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if(settings.bpm) {
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

        // Determine current chord
        const currentChord = this.progression[this.progressionIndex];

        // 1. Generate scores based on the current chord
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            self.postMessage({ type: 'drum_score', data: { score: drumScore }});
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(currentChord);
            self.postMessage({ type: 'bass_score', data: { score: bassScore }});
        }
        
        if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore(currentChord);
             if (soloScore && soloScore.length > 0) { // Check if solo score was generated
                self.postMessage({ type: 'solo_score', data: { score: soloScore }});
            }
        }

        // 2. Advance musical time
        this.barCount++;
        this.progressionIndex = (this.progressionIndex + 1) % this.progression.length;
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

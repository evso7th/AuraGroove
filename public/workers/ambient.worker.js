/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture. Each musical
 * component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  Scheduler: The central "conductor" or "event loop". It wakes up at regular
 *     intervals, determines what musical data is needed, and coordinates the other
 *     entities. It doesn't generate music itself, only directs the flow.
 *
 * 2.  Instrument Generators (e.g., DrumGenerator, BassGenerator): These are the "composers".
 *     They take musical settings and return a "score" - an array of note events.
 *     They are stateless and know nothing about audio rendering.
 *
 * 3.  PatternProvider: The "music sheet library". It holds all rhythmic and melodic
 *     patterns. It's a simple data store that the Instrument Generators query.
 *
 * Data Flow on Tick:
 * - Scheduler's timer fires.
 * - Scheduler asks the appropriate generators for their scores for the next time slice.
 * - Generators may ask PatternProvider for their patterns.
 * - Generators create their scores (e.g., `{ note: 'C4', time: 0, duration: 1 }`).
 * - Scheduler posts the scores back to the main thread.
 *
 * This architecture ensures that changing a drum pattern CANNOT break the bass logic,
 * and changing a generator CANNOT break the audio rendering on the main thread.
 * Each part is independent, testable, and replaceable.
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
    soloScales: {
        C_MAJOR: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
        A_MINOR: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
    },

    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
    getSoloScale() {
        // For now, just return one scale. This could be expanded.
        return this.soloScales.A_MINOR;
    }
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber % 4 === 0) {
            // Remove any other drum hit at time 0 to avoid conflict
            score = score.filter(note => note.time !== 0);
            score.unshift({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        
        return score;
    }
}

class BassGenerator {
     static createScore(rootNote = 'E', beatsPerBar = 4) {
        // Simple bassline: root note on the first beat of the bar
        const score = [
            { note: `${rootNote}1`, time: 0, duration: beatsPerBar, velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static lastNoteIndex = -1;
    
    static createScore(scale, beatsPerBar = 4, barNumber) {
        const score = [];
        
        // Let's play a note only once every 2 bars to keep it sparse
        if (barNumber % 2 !== 0) {
            return score;
        }

        // Simple algorithm: pick a random note from the scale, but not the same one as last time
        let noteIndex;
        do {
            noteIndex = Math.floor(Math.random() * scale.length);
        } while (scale.length > 1 && noteIndex === this.lastNoteIndex);
        this.lastNoteIndex = noteIndex;

        const note = scale[noteIndex];
        const time = Math.random() > 0.5 ? 0 : beatsPerBar / 2; // Place on 1st or 3rd beat
        const duration = beatsPerBar / 2; // half the bar
        
        score.push({
            notes: note,
            time: time,
            duration: duration,
            velocity: 0.7
        });

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
        
        this.tick(); // Generate the first chunk immediately
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
    },

    tick() {
        if (!this.isRunning) return;

        // 1. Generate drum score
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount
            );
            // Post score back to the main thread
            self.postMessage({ type: 'drum_score', data: { score: drumScore }});
        }
        
        // 2. Generate bass score
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore('E', this.beatsPerBar);
            self.postMessage({ type: 'bass_score', data: { score: bassScore }});
        }
        
        // 3. Generate solo score
        if (this.instruments.solo !== 'none') {
            const soloScale = PatternProvider.getSoloScale();
            const soloScore = SoloGenerator.createScore(soloScale, this.beatsPerBar, this.barCount);
            self.postMessage({ type: 'solo_score', data: { score: soloScore }});
        }

        this.barCount++;
    }
};


// --- MessageBus (The entry point) ---
self.onmessage = (event) => {
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

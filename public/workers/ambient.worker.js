
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture. Each musical component
 * is an isolated entity responsible for a single task.
 */

// --- Type Definitions ---
// These are simplified versions for the worker context, matching the main thread types.
/** @typedef {'synthesizer' | 'piano' | 'organ' | 'none'} SoloInstrument */
/** @typedef {'synthesizer' | 'piano' | 'organ' | 'none'} AccompInstrument */
/** @typedef {'bass synth' | 'none'} BassInstrument */
/** @typedef {'basic' | 'breakbeat' | 'slow' | 'heavy'} DrumPattern */

/**
 * @typedef {Object} Instruments
 * @property {SoloInstrument} solo
 * @property {AccompInstrument} accompaniment
 * @property {BassInstrument} bass
 */

/**
 * @typedef {Object} DrumSettings
 * @property {boolean} enabled
 * @property {DrumPattern} pattern
 * @property {number} volume
 */

/**
 * @typedef {Object} Note
 * @property {string} note
 * @property {number} time
 * @property {number} duration
 * @property {number} velocity
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
    /**
     * @param {DrumPattern} patternName
     * @param {number} barNumber
     * @returns {Array<{sample: string, time: number, velocity?: number}>}
     */
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
    /**
     * Selects the next note in a pseudo-random but deterministic way based on the bar count.
     * @param {number} barCount - The current bar number to seed the choice.
     * @param {string[]} scale - The musical scale to choose notes from.
     * @returns {string} The chosen note.
     */
    static getNextNote(barCount, scale) {
        // This is a simple deterministic way to select from the scale.
        // A more complex generator might use Markov chains or other algorithms.
        const index = Math.floor(
            (Math.sin(barCount * 0.5) + 1) * 0.5 * (scale.length -1) +
            (Math.cos(barCount * 0.2)) * 0.5
        ) % scale.length;
        return scale[Math.round(index)];
    }

    /**
     * @param {number} barCount
     * @returns {Array<Note>}
     */
    static createScore(barCount) {
        console.log('BassGenerator: createScore called with barCount', barCount);
        const scale = ['E1', 'F#1', 'G1', 'A1', 'B1', 'C2', 'D2']; // E-minor scale
        const score = [];
        
        // Create a bass note on the first beat
        const note1 = this.getNextNote(barCount, scale);
        score.push({ note: note1, time: 0, duration: 2, velocity: 0.7 });

        // Create another bass note on the third beat
        const note2 = this.getNextNote(barCount + 0.5, scale); // Use offset for variation
        score.push({ note: note2, time: 2, duration: 2, velocity: 0.65 });

        console.log('BassGenerator: Returning score', score);
        return score;
    }
}


class SoloGenerator {
    static getNextNote(time, scale) {
         const index = Math.floor(
            (Math.sin(time * 2) + 1) * 0.5 * (scale.length -1) +
            (Math.cos(time * 0.8)) * 0.5
        ) % scale.length;
        return scale[Math.round(index)];
    }

    static createScore(barCount, beatsPerBar, secondsPerBeat) {
        const scale = ['E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5'];
        const score = [];
        const barStartTime = barCount * beatsPerBar;
        
        // Generate a few notes per bar
        for (let beat = 0; beat < beatsPerBar; beat += 1) { // More frequent notes
             if (Math.random() > 0.4) { // Add some randomness
                const note = this.getNextNote(barStartTime + beat, scale);
                score.push({
                    notes: note,
                    duration: '16n',
                    time: beat, // time in beats relative to the bar start
                });
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
    /** @type {number} */
    sampleRate: 44100,
    /** @type {number} */
    bpm: 120,
    /** @type {Instruments | null} */
    instruments: null,
    /** @type {DrumSettings | null} */
    drumSettings: null,

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
    
    /**
     * @param {Object} settings
     * @param {Instruments} [settings.instruments]
     * @param {DrumSettings} [settings.drumSettings]
     * @param {number} [settings.bpm]
     */
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
        console.log('Worker: tick');

        // 1. Generate Drum Score
        if (this.drumSettings?.enabled) {
            const drumScore = DrumGenerator.createScore(
                this.drumSettings.pattern, 
                this.barCount
            );
            self.postMessage({ type: 'drum_score', data: { score: drumScore }});
        }
        
        // 2. Generate Bass Score
        if (this.instruments?.bass !== 'none') {
            const bassScore = BassGenerator.createScore(this.barCount);
            console.log('Worker: Generated bass score', bassScore);
            self.postMessage({ type: 'bass_score', data: { score: bassScore }});
        }
        
        // 3. Generate Solo Score
        if (this.instruments?.solo !== 'none') {
            const soloScore = SoloGenerator.createScore(
                this.barCount,
                this.beatsPerBar,
                this.secondsPerBeat
            );
            self.postMessage({ type: 'solo_score', data: { score: soloScore }});
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
                Scheduler.sampleRate = data.sampleRate;
                // Since this worker doesn't do audio processing, we just acknowledge.
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

    
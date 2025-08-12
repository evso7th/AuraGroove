

/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture. Each musical
 * component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  Scheduler: The central "conductor". It wakes up at regular intervals,
 *     determines what musical data is needed, and coordinates the other entities.
 *
 * 2.  Instrument Generators (Drum, Bass, Solo, Accompaniment): "Composers" that
 *     return a "score" (an array of note events) for a given time slice.
 *
 * 3.  PatternProvider: The "music sheet library". A data store for rhythmic and
 *     melodic patterns queried by the generators.
 *
 * Data Flow on Start:
 * - Main thread sends 'init' with samples and settings.
 * - Scheduler starts its loop.
 * - In each loop:
 *   - Scheduler asks the appropriate generators for their scores.
 *   - Generators ask PatternProvider for patterns if needed.
 *   - Generators create scores and return them.
 *   - Scheduler posts the scores back to the main thread for audio rendering.
 *
 * This architecture ensures that changing one part (e.g., a drum pattern)
 * does not break another (e.g., the bassline generation).
 */


// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 },
            { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 },
            { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 },
            { sample: 'kick', time: 0.75 }, { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 }, { sample: 'kick', time: 2 },
            { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 },
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
    },
    melodicPatterns: {
        // Simple scale patterns
        majorScale: [0, 2, 4, 5, 7, 9, 11, 12],
        minorScale: [0, 2, 3, 5, 7, 8, 10, 12],
    },
    harmonyPatterns: {
        // Chord progressions (in scale degrees, e.g., I-V-vi-IV)
        pachelbel: ['E', 'B', 'C#', 'G#', 'A', 'E', 'A', 'B'],
    },
    
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },

    getMelody(name) {
        return this.melodicPatterns[name] || this.melodicPatterns.minorScale;
    },
    
    getHarmony(name) {
        return this.harmonyPatterns[name] || this.harmonyPatterns.pachelbel;
    }
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
     static createScore(rootNote = 'E', barNumber = 0, beatsPerBar = 4) {
        // Simple bassline: root note on the first beat of the bar
        const score = [
            { note: `${rootNote}2`, time: 0, duration: beatsPerBar, velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static createScore(rootNote = 'E', barNumber = 0, beatsPerBar = 4) {
        const score = [];
        const scale = PatternProvider.getMelody('minorScale');
        
        // Simple generative logic: play a few notes from the scale
        for (let i = 0; i < 2; i++) {
             const noteIndex = Math.floor(Math.random() * scale.length);
             const noteTime = i * 2 + (Math.random() > 0.5 ? 0.5 : 0);
             const noteDuration = Math.random() > 0.5 ? '8n' : '4n';
             const finalNote = `${rootNote}${3 + Math.floor(noteIndex / 8)}`
             
             score.push({
                 notes: finalNote,
                 duration: noteDuration,
                 time: noteTime,
             })
        }
        return score;
    }
}

class AccompanimentGenerator {
    static createScore(rootNote = 'E', barNumber = 0, beatsPerBar = 4) {
        // Generates a simple arpeggio based on the root note
        const chord = [`${rootNote}3`, `${rootNote}4`, `${rootNote}5`]; 
        const score = [];
        for (let i = 0; i < beatsPerBar; i++) {
            score.push({
                notes: chord[i % chord.length],
                duration: '8n',
                time: i,
            });
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
    bpm: 100,
    instruments: {},
    drumSettings: {},
    scoreName: 'generative',

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
        // Using a loop with timeouts for better accuracy over long periods
        const loop = () => {
            if (!this.isRunning) return;
            this.tick();
            this.intervalId = setTimeout(loop, this.barDuration * 1000);
        };
        this.intervalId = setTimeout(loop, this.barDuration * 1000);

        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        clearTimeout(this.intervalId);
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
    },

    tick() {
        if (!this.isRunning) return;
        
        const harmony = PatternProvider.getHarmony('pachelbel');
        const rootNote = harmony[this.barCount % harmony.length];

        // 1. Ask generators for their scores
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(rootNote, this.barCount);
            self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }

        if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore(rootNote, this.barCount);
            self.postMessage({ type: 'solo_score', data: { score: soloScore } });
        }

        if (this.instruments.accompaniment !== 'none') {
            const accompanimentScore = AccompanimentGenerator.createScore(rootNote, this.barCount);
            self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
        }

        this.barCount++;
    }
};


// --- MessageBus (The entry point) ---
self.onmessage = async (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                // Note: SampleBank is no longer in the worker.
                // Initialization is mainly for setting the sample rate from Tone.js context.
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

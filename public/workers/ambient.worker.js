
/**
 * @file AuraGroove Ambient Music Worker
 * This worker generates musical scores for various instruments and sends them
 * to the main thread for playback. It operates on a fixed-tick loop synchronized
 * to a specific BPM.
 *
 * Architecture:
 * 1.  MessageBus (self.onmessage): Entry point for commands from the main thread.
 * 2.  Scheduler: The central "conductor" that triggers score generation every bar.
 * 3.  Instrument Generators (e.g., DrumGenerator, BassGenerator): Stateless composers
 *     that create musical data for a single bar.
 * 4.  PatternProvider: A library of musical patterns used by the generators.
 * 5.  SampleBank: Manages decoded audio samples for use by generators (though rendering
 *     happens on the main thread).
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
    chordProgressions: {
        // Basic I-V-vi-IV in C major
        major_pop: [ 'C4', 'G4', 'A4', 'F4' ],
        // A common minor progression
        minor_moody: [ 'Am', 'G', 'C', 'F' ],
        // More ambient/jazzy progression
        ambient_jazz: [ 'Cmaj7', 'Fmaj7', 'Dm7', 'G7' ],
    },
    melodies: {
        simple_pentatonic: [
            { note: 'C4', duration: '8n' }, { note: 'D4', duration: '8n' },
            { note: 'E4', duration: '4n' }, { note: 'G4', duration: '4n' },
            { note: 'A4', duration: '2n' },
        ],
    },

    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
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
    static getRootNote(chord) {
        if (typeof chord !== 'string') return 'C';
        return chord.replace(/maj7|m7|7/,'').slice(0, -1); // 'Cmaj7' -> 'C', 'Am' -> 'A'
    }

     static createScore(barNumber, chordProgression) {
        const chord = chordProgression[barNumber % chordProgression.length];
        const rootNote = this.getRootNote(chord);

        const score = [
            { note: `${rootNote}2`, time: 0, duration: '1n', velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static createScore(barNumber, melody, chord) {
        // A very simple generator: plays one note from the melody per bar
        const note = melody[barNumber % melody.length];
        return [
            { notes: note.note, duration: note.duration, time: 1.5 }
        ];
    }
}

class AccompanimentGenerator {
     static createScore(barNumber, chordProgression) {
        const chord = chordProgression[barNumber % chordProgression.length];
        return [
            { notes: chord, duration: '1n', time: 0 }
        ];
    }
}

// --- 3. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {}, // { kick: Float32Array, ... }
    isInitialized: false,

    async init(rawSamples, sampleRate) {
        // This is a placeholder for any logic that might need the decoded samples
        // inside the worker in the future. Currently, decoding is handled on the main thread.
        this.isInitialized = true;
    },
};

// --- 4. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    sampleRate: 44100,
    bpm: 120,
    instruments: { solo: 'none', accompaniment: 'none', bass: 'none' },
    drumSettings: { enabled: false, pattern: 'basic', volume: 0.8 },
    score: 'generative',


    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
        
        // Generate the first chunk immediately and schedule subsequent ticks
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
        if (settings.score) this.score = settings.score;
    },

    tick() {
        if (!this.isRunning) return;
        
        if (this.score === 'promenade') {
            // For promenade, we don't generate, we just trigger it once
            // This logic would be handled differently in a real scenario
            // (e.g., sending the whole score at once)
            // For now, we'll just stop to prevent looping.
             this.stop();
             return;
        }

        // --- Score Generation ---
        const chordProgression = PatternProvider.chordProgressions.minor_moody;

        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(this.barCount, chordProgression);
            self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }

        if (this.instruments.accompaniment !== 'none') {
            const accompanimentScore = AccompanimentGenerator.createScore(this.barCount, chordProgression);
            self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
        }
        
        if (this.instruments.solo !== 'none') {
            const melody = PatternProvider.melodies.simple_pentatonic;
            const currentChord = chordProgression[this.barCount % chordProgression.length];
            const soloScore = SoloGenerator.createScore(this.barCount, melody, currentChord);
            self.postMessage({ type: 'solo_score', data: { score: soloScore } });
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

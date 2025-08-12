
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
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
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        const score = [...pattern];

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber > 0 && barNumber % 4 === 0) {
             const existingNote = score.findIndex(note => note.time === 0);
             if (existingNote !== -1) {
                score.splice(existingNote, 1);
             }
             score.unshift({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        
        return score.map(note => ({
            ...note,
            time: note.time * Scheduler.secondsPerBeat
        }));
    }
}

class BassGenerator {
    static getNextNote(barCount, scale) {
        // Simple predictable pattern based on the bar count
        const noteIndex = (barCount % 8) < 4 ? 0 : 2; // E for 4 bars, G for 4 bars
        return scale[noteIndex];
    }

    static createScore(barCount) {
        const rootNote = 'E'; // E Aeolian scale (E, F#, G, A, B, C, D)
        const scale = ['E2', 'F#2', 'G2', 'A2', 'B2', 'C3', 'D3'];
        const score = [];
        const beatsPerBar = 4;

        // Create a bass note on the first and third beat
        const note1 = this.getNextNote(barCount, scale);
        score.push({ note: note1, time: 0, duration: Scheduler.secondsPerBeat * 2, velocity: 0.7 });
        
        const note2 = this.getNextNote(barCount + 1, scale); // Look ahead for variation
        score.push({ note: note2, time: Scheduler.secondsPerBeat * 2, duration: Scheduler.secondsPerBeat * 2, velocity: 0.7 });
        
        return score;
    }
}

class SoloGenerator {
    static getNextNotes(barCount, scale) {
         // More complex pattern for solo
        const phraseLength = 8; // A full melodic idea spans 8 bars
        const currentPositionInPhrase = barCount % phraseLength;

        // Simple arpeggio-like patterns
        if (currentPositionInPhrase < 2) { // Bar 0, 1
            return [scale[0], scale[2], scale[4]]; // E, G, B
        } else if (currentPositionInPhrase < 4) { // Bar 2, 3
            return [scale[1], scale[3], scale[5]]; // F#, A, C
        } else if (currentPositionInPhrase < 6) { // Bar 4, 5
            return [scale[2], scale[4], scale[6]]; // G, B, D
        } else { // Bar 6, 7
            return [scale[3], scale[5], scale[0]]; // A, C, E (next octave)
        }
    }
    
    static createScore(barCount) {
        const rootNote = 'E'; // E Aeolian scale (E, F#, G, A, B, C, D)
        const scale = ['E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5'];
        const score = [];
        
        const phrase = this.getNextNotes(barCount, scale);

        // Add a few notes per bar
        score.push({ notes: phrase[0], time: 0, duration: '8n' });
        score.push({ notes: phrase[1], time: Scheduler.secondsPerBeat * 1.5, duration: '8n' });
        score.push({ notes: phrase[2], time: Scheduler.secondsPerBeat * 3, duration: '8n' });
        
        return score;
    }
}


// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    sampleRate: 44100,
    bpm: 100,
    instruments: { solo: 'none', accompaniment: 'none', bass: 'none' },
    drumSettings: { enabled: false, pattern: 'basic', volume: 0.8 },

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },
    get lookahead() { return this.barDuration * 2; }, // Schedule 2 bars ahead


    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;
        
        this.tick(); // Generate first event immediately
        this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
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
        
        // If BPM changes, we need to restart the interval to match the new timing
        if (this.isRunning) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        }
    },

    tick() {
        if (!this.isRunning) return;

        // 1. Generate Drum Score
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }
        
        // 2. Generate Bass Score
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(this.barCount);
            self.postMessage({ type: 'bass_score', data: { score: bassScore }});
        }

        // 3. Generate Solo Score
        if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore(this.barCount);
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
                // The 'init' signal now just confirms the worker is alive.
                // Sample loading is handled by the main thread.
                // We receive the sample rate to ensure timing is correct.
                Scheduler.sampleRate = data.sampleRate;
                self.postMessage({ type: 'initialized' });
                break;
            
            case 'start':
                Scheduler.updateSettings(data);
                Scheduler.start();
                self.postMessage({ type: 'started' });
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

    
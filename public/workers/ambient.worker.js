
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
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
     soloPatterns: {
        organ: [
            // Simple ascending phrase
            { notes: ['C4', 'E4', 'G4'], duration: '4n', time: 0 },
            { notes: 'B4', duration: '8n', time: 1 },
            { notes: 'A4', duration: '8n', time: 1.5 },
            { notes: 'G4', duration: '4n', time: 2 },
            { notes: 'E4', duration: '4n', time: 3 },
        ],
    },
    getSoloPattern(name) {
        return this.soloPatterns[name];
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
            score.unshift({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
    static createScore(barCount) {
        // Simple generative logic for bass
        // Using a pentatonic scale for a consonant feel
        const scale = ['E2', 'F#2', 'G2', 'A2', 'B2', 'C3', 'D3'];
        const score = [];
        const beatsPerBar = 4;
        let currentTime = 0;

        for (let i = 0; i < 2; i++) { // Generate 2 notes per bar
            const noteIndex = Math.floor(Math.random() * scale.length);
            const duration = (Math.random() > 0.5 ? 1 : 2); // 1 or 2 beats
            const velocity = Math.random() * 0.3 + 0.5; // 0.5 to 0.8

            if (currentTime < beatsPerBar) {
                score.push({
                    note: scale[noteIndex],
                    time: currentTime,
                    duration: duration,
                    velocity: velocity
                });
            }
            currentTime += duration;
        }
        
        return score;
    }
}

class SoloGenerator {
    static createScore(instrumentName, barCount) {
        if (instrumentName === 'none') return [];
        
        // Simple generative logic for the solo instrument
        // Let's use a scale that complements the bassline
        const scale = ['E4', 'G4', 'A4', 'B4', 'D5'];
        const score = [];
        const beatsPerBar = 4;
        let currentTime = 0;

        // Generate a few notes per bar
        const numberOfNotes = Math.floor(Math.random() * 3) + 2; // 2 to 4 notes

        for (let i = 0; i < numberOfNotes; i++) {
            if (currentTime >= beatsPerBar) break;

            const noteIndex = Math.floor(Math.random() * scale.length);
            // Notes can be eighths or quarters
            const duration = Math.random() > 0.6 ? '8n' : '4n'; 
            
            score.push({
                notes: scale[noteIndex],
                duration: duration,
                time: currentTime
            });

            // Increment time by the duration of the note in beats
            currentTime += (duration === '8n' ? 0.5 : 1);
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
    instruments: { solo: 'none', accompaniment: 'none', bass: 'none' },
    drumSettings: { enabled: false, pattern: 'basic', volume: 0.8 },

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
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
    },

    tick() {
        if (!this.isRunning) return;
        
        // 1. Ask generators for their scores for the current bar
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            if (drumScore && drumScore.length > 0) {
                 self.postMessage({ type: 'drum_score', data: { score: drumScore } });
            }
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(this.barCount);
             if (bassScore && bassScore.length > 0) {
                self.postMessage({ type: 'bass_score', data: { score: bassScore } });
            }
        }
        
        if (this.instruments.solo !== 'none') {
             const soloScore = SoloGenerator.createScore(this.instruments.solo, this.barCount);
             if (soloScore && soloScore.length > 0) {
                self.postMessage({ type: 'solo_score', data: { score: soloScore } });
            }
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
                // The worker no longer needs to decode samples, just acknowledge readiness.
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

    
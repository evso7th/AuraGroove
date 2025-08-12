/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  Scheduler: The central "conductor". It wakes up at regular intervals (ticks)
 *     based on BPM and coordinates the other entities.
 *
 * 2.  Instrument Generators (e.g., DrumGenerator, BassGenerator): "Composers"
 *     that create a "score" (an array of note events) for a specific time slice.
 *     They are stateless and query the PatternProvider for musical data.
 *
 * 3.  PatternProvider: The "music sheet library". It holds all rhythmic, melodic,
 *     and harmonic patterns.
 */

// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 }, { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'kick', time: 0.75 }, { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 }, { sample: 'kick', time: 2 }, { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 }, { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 }, { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 }, { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 }, { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ],
    },
    scales: {
        C_MAJOR: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
        E_MINOR_PENTATONIC: ['E', 'G', 'A', 'B', 'D'],
    },
    progressions: {
        generative: ['Em', 'C', 'G', 'D'], // i-VI-III-VII in G major, or Em
        promenade: ['Em', 'C', 'G', 'D'], // Same as generative for now
    },

    getDrumPattern(name) { return this.drumPatterns[name] || this.drumPatterns.basic; },
    getScale(name) { return this.scales[name] || this.scales.E_MINOR_PENTATONIC; },
    getProgression(name) { return this.progressions[name] || this.progressions.generative; },
};


// --- 2. Note & Chord Selector Utility ---
const NoteSelector = {
    // Selects a chord from a progression based on the bar number
    getChordForBar(progressionName, barNumber) {
        const progression = PatternProvider.getProgression(progressionName);
        return progression[barNumber % progression.length];
    },

    // A very simple random note selector from a scale
    getRandomNote(scaleName, octave) {
        const scale = PatternProvider.getScale(scaleName);
        const note = scale[Math.floor(Math.random() * scale.length)];
        return `${note}${octave}`;
    },
    
     // Gets the root note of a chord symbol
    getChordRoot(chord) {
        if (chord.length > 1 && (chord[1] === '#' || chord[1] === 'b')) {
            return chord.substring(0, 2);
        }
        return chord.substring(0, 1);
    },
};


// --- 3. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0); // Avoid conflict with kick
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
    static createScore(progressionName, barNumber, beatsPerBar = 4) {
        const chord = NoteSelector.getChordForBar(progressionName, barNumber);
        const rootNote = NoteSelector.getChordRoot(chord);
        return [{ note: `${rootNote}1`, time: 0, duration: beatsPerBar, velocity: 0.9 }];
    }
}

class AccompanimentGenerator {
     static createScore(progressionName, barNumber, beatsPerBar = 4) {
        const chord = NoteSelector.getChordForBar(progressionName, barNumber);
        // Simple arpeggio
        const root = NoteSelector.getChordRoot(chord);
        return [
            { notes: [`${root}2`, `${root}3`], duration: '4n', time: 0 },
            { notes: `${root}3`, duration: '8n', time: 1 },
            { notes: `${root}2`, duration: '8n', time: 1.5 },
            { notes: [`${root}2`, `${root}3`], duration: '4n', time: 2 },
            { notes: `${root}3`, duration: '8n', time: 3 },
            { notes: `${root}2`, duration: '8n', time: 3.5 },
        ];
    }
}


class SoloGenerator {
    static createScore(scaleName, barNumber, beatsPerBar = 4) {
        // Generate a simple, sparse melody
        const score = [];
        if (Math.random() > 0.3) { // 70% chance to play a note
            const time = Math.floor(Math.random() * beatsPerBar * 2) / 2; // on any 8th note position
            const note = NoteSelector.getRandomNote(scaleName, 3);
             score.push({
                notes: note,
                duration: '8n',
                time: time,
            });
        }
        if (barNumber % 4 === 3 && Math.random() > 0.5) { // higher chance for a note at the end of a phrase
            const note = NoteSelector.getRandomNote(scaleName, 4);
             score.push({
                notes: note,
                duration: '4n',
                time: 3,
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
    sampleRate: 44100,
    bpm: 100,
    instruments: { solo: 'none', accompaniment: 'none', bass: 'none'},
    drumSettings: { enabled: false, pattern: 'basic' },
    score: 'generative',

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },

    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
        
        // Generate the first chunk immediately to reduce latency
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
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
        // If already running, we need to restart the interval with the new BPM
        if(this.isRunning) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        }
    },

    tick() {
        if (!this.isRunning) return;

        // For 'promenade' score, we use pre-defined notes. For now, we only implement 'generative'.
        const progressionName = this.score === 'promenade' ? 'promenade' : 'generative';
        const scaleName = 'E_MINOR_PENTATONIC'; // Fixed for now

        // 1. Ask generators for their scores
        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            if (drumScore.length > 0) self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(progressionName, this.barCount);
            if (bassScore.length > 0) self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }
        
        if (this.instruments.accompaniment !== 'none') {
            const accompanimentScore = AccompanimentGenerator.createScore(progressionName, this.barCount);
            if (accompanimentScore.length > 0) self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
        }
        
        if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore(scaleName, this.barCount);
            if (soloScore.length > 0) self.postMessage({ type: 'solo_score', data: { score: soloScore } });
        }

        this.barCount++;
    }
};


// --- MessageBus (The entry point) ---
let isInitialized = false;
self.onmessage = async (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                // Note: SampleBank is removed. Main thread handles samples.
                Scheduler.sampleRate = data.sampleRate;
                isInitialized = true;
                self.postMessage({ type: 'initialized' });
                break;
            
            case 'start':
                if (!isInitialized) throw new Error("Worker not initialized.");
                Scheduler.updateSettings(data);
                Scheduler.start();
                break;
            
            case 'update_settings':
                 if (!isInitialized) return; // Don't update if not ready
                 Scheduler.updateSettings(data);
                 break;

            case 'stop':
                Scheduler.stop();
                break;
        }
    } catch (e) {
        self.postMessage({ type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
};

    
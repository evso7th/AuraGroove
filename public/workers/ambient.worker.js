
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication between the main thread and the worker.
 * 2.  Scheduler: The central "conductor" or "event loop." It coordinates the generators.
 * 3.  Instrument Generators: Composers for different parts (drums, bass, solo, accompaniment).
 * 4.  PatternProvider: The "music sheet library" for rhythmic and melodic patterns.
 * 5.  NoteProvider: Provides musical scales and chord progressions.
 */
import * as Tone from 'tone';

// --- NoteProvider (Musical Scales and Chords) ---
const NoteProvider = {
    scales: {
        minor: ["C", "D", "D#", "F", "G", "G#", "A#"],
        major: ["C", "D", "E", "F", "G", "A", "B"],
        promenade: ["E", "F#", "G", "A", "B", "C", "D"] // E minor scale for promenade
    },
    getScale(rootNote: string, scaleName: 'minor' | 'major' | 'promenade'): string[] {
        const baseScale = this.scales[scaleName];
        const rootIndex = Tone.Frequency(rootNote).toMidi() - Tone.Frequency(`${baseScale[0]}3`).toMidi();
        return baseScale.map(note => Tone.Frequency(`${note}3`).transpose(rootIndex).toNote());
    },
    getChordProgression(scoreName: 'generative' | 'promenade'): string[] {
        if (scoreName === 'promenade') {
            return ["E4", "C4", "G4", "D4"];
        }
        // Generative progression
        return ["A#3", "G3", "D#3", "D3"];
    }
};


// --- PatternProvider (The Music Sheet Library) ---
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
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'kick', time: 0.75 },
            { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 }, { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 }, { sample: 'hat', time: 3.5 },
        ],
        slow: [ { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 }, { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 }, ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 },
            { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 },
            { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ],
    },
    soloPatterns: {
        // time is in beats, duration is in Tone.js Time notation
        generative_1: [
            { time: 0.5, duration: '8n'}, { time: 1.5, duration: '8n'},
            { time: 2.5, duration: '4n'}
        ],
        promenade_1: [
            { time: 0.5, duration: '8n'}, { time: 1.5, duration: '8n'},
            { time: 2.5, duration: '4n'},
        ]
    },
    getDrumPattern(name: string) {
        return this.drumPatterns[name as keyof typeof this.drumPatterns] || this.drumPatterns.basic;
    },
    getSoloPattern(name: 'generative_1' | 'promenade_1') {
        return this.soloPatterns[name] || this.soloPatterns.generative_1;
    }
};

// --- Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName: string, barNumber: number) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        if (barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.unshift({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
    static createScore(progression: string[], barNumber: number) {
        const rootNote = progression[barNumber % progression.length];
        const score = [
            { note: rootNote.replace(/\d/, '1'), time: 0, duration: 4, velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static createScore(scale: string[], barNumber: number, patternName: 'generative_1' | 'promenade_1') {
        const pattern = PatternProvider.getSoloPattern(patternName);
        const score = pattern.map(p => {
            const noteIndex = Math.floor(Math.random() * scale.length);
            return {
                notes: scale[noteIndex],
                time: p.time,
                duration: p.duration
            };
        });
        return score;
    }
}

class AccompanimentGenerator {
    static createScore(progression: string[], barNumber: number) {
        const rootNote = progression[barNumber % progression.length];
        // Create a simple minor triad arpeggio
        const chord = Tone.Frequency(rootNote).toMidi();
        const third = Tone.Frequency(chord + 3, 'midi').toNote();
        const fifth = Tone.Frequency(chord + 7, 'midi').toNote();

        const score = [
            { notes: rootNote, time: 0, duration: '8n' },
            { notes: third, time: 0.5, duration: '8n' },
            { notes: fifth, time: 1, duration: '8n' },
            { notes: third, time: 1.5, duration: '8n' },
            { notes: rootNote, time: 2, duration: '8n' },
            { notes: third, time: 2.5, duration: '8n' },
            { notes: fifth, time: 3, duration: '8n' },
            { notes: third, time: 3.5, duration: '8n' },
        ];
        return score;
    }
}


// --- Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null as any,
    isRunning: false,
    barCount: 0,

    // Settings
    sampleRate: 44100,
    bpm: 120,
    instruments: { solo: 'none', accompaniment: 'none', bass: 'none' },
    drumSettings: { enabled: false, pattern: 'basic', volume: 0.8 },
    score: 'generative',

    // Calculated
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

    updateSettings(data: any) {
        if (data.instruments) this.instruments = data.instruments;
        if (data.drumSettings) this.drumSettings = data.drumSettings;
        if (data.bpm) this.bpm = data.bpm;
        if (data.score) this.score = data.score;
    },

    tick() {
        if (!this.isRunning) return;
        
        const isGenerative = this.score === 'generative';
        const chordProgression = NoteProvider.getChordProgression(this.score);

        // 1. Generate scores
        if (this.drumSettings.enabled && isGenerative) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }

        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(chordProgression, this.barCount);
            self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }
        
        if (this.instruments.accompaniment !== 'none') {
            const accompanimentScore = AccompanimentGenerator.createScore(chordProgression, this.barCount);
            self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
        }

        if (this.instruments.solo !== 'none') {
             const scale = NoteProvider.getScale(chordProgression[0], this.score === 'promenade' ? 'promenade' : 'minor');
             const patternName = this.score === 'promenade' ? 'promenade_1' : 'generative_1';
             const soloScore = SoloGenerator.createScore(scale, this.barCount, patternName);
             self.postMessage({ type: 'solo_score', data: { score: soloScore } });
        }

        this.barCount++;
    }
};


// --- MessageBus (Entry Point) ---
self.onmessage = async (event: MessageEvent) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                // Note: SampleBank and AudioRenderer removed as they are not used.
                // The main thread now handles all audio rendering with Tone.js.
                Scheduler.sampleRate = data.sampleRate;
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

    
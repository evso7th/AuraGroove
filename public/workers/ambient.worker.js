/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication between the main thread and the worker.
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals,
 *     determines what musical data is needed, and coordinates the other entities.
 * 3.  Instrument Generators (Drum, Bass, Solo, etc.): The "composers". They return a "score"
 *     (an array of note events). They are stateless.
 * 4.  PatternProvider: The "music sheet library". It holds all rhythmic and melodic patterns.
 * 5.  SampleBank: A repository for decoded audio samples.
 */
import { promenadeScore } from '@/lib/scores/promenade';

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
    // musical contexts: chord progressions & scales
    contexts: {
        major: {
            scale: [0, 2, 4, 5, 7, 9, 11], // Major scale intervals
            chords: [ // degrees of the scale for triads
                [0, 2, 4], // I
                [1, 3, 5], // ii
                [2, 4, 6], // iii
                [3, 5, 0], // IV (inverted)
                [4, 6, 1], // V (inverted)
                [5, 0, 2], // vi (inverted)
                [6, 1, 3], // vii° (inverted)
            ],
            progression: [0, 3, 4, 5], // I-IV-V-vi
        },
        minor: {
            scale: [0, 2, 3, 5, 7, 8, 10], // Natural minor scale
            chords: [
                [0, 2, 4], // i
                [1, 3, 5], // ii°
                [2, 4, 6], // III
                [3, 5, 0], // iv (inverted)
                [4, 6, 1], // v (inverted)
                [5, 0, 2], // VI (inverted)
                [6, 1, 3], // VII (inverted)
            ],
             progression: [0, 5, 3, 6], // i-VI-iv-VII
        }
    },

    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },

    getMusicalContext(rootNote = 'E3', mode = 'minor') {
        const rootMidi = this.noteToMidi(rootNote);
        const context = this.contexts[mode];
        
        const scale = context.scale.map(interval => rootMidi + interval);
        const chordProgression = context.progression.map(degree => {
            const chordRoot = scale[degree];
            return context.chords[degree].map(interval => this.midiToNote(chordRoot + context.scale[interval]));
        });

        return { scale, chordProgression };
    },

    noteToMidi(note) {
        const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
        const octave = parseInt(note.slice(-1));
        const key = note.slice(0, -1);
        return noteMap[key] + (octave + 1) * 12;
    },
    
    midiToNote(midi) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const note = notes[midi % 12];
        return note + octave;
    }
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName, barNumber) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score = [...pattern];

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber > 0 && barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.unshift({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        return score;
    }
}

class BassGenerator {
    static createScore(barNumber, context) {
        const { chordProgression } = context;
        const chord = chordProgression[barNumber % chordProgression.length];
        const rootNote = chord[0];
        
        // Simple bassline: root note of the current chord on the first beat
        const score = [
            { note: `${rootNote.slice(0, -1)}1`, time: 0, duration: 4, velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static createScore(barNumber, context) {
        const { scale } = context;
        const score = [];
        const numNotes = Math.floor(Math.random() * 4) + 2; // 2 to 5 notes per bar

        for(let i = 0; i < numNotes; i++) {
            const noteIndex = Math.floor(Math.random() * scale.length);
            const note = PatternProvider.midiToNote(scale[noteIndex]);
            const time = i * (4 / numNotes) + (Math.random() * 0.5 - 0.25); // Add some timing variation
            const duration = Math.random() > 0.6 ? '4n' : '8n';
            if (time >= 0 && time < 4) {
                 score.push({ notes: note, time: `${time.toFixed(2)}`, duration });
            }
        }
        return score;
    }
}

class AccompanimentGenerator {
    static createScore(barNumber, context) {
        const { chordProgression } = context;
        const chord = chordProgression[barNumber % chordProgression.length];
        const score = [];
        const pattern = Math.random();

        if (pattern < 0.5) { // Arpeggio
            for (let i = 0; i < chord.length; i++) {
                score.push({ notes: chord[i], time: i * 0.5, duration: '8n' });
            }
        } else { // Block chord
            score.push({ notes: chord, time: 0, duration: '2n' });
        }
        return score;
    }
}


// --- 3. SampleBank (Decoded Audio Storage) ---
const SampleBank = {
    samples: {},
    isInitialized: false,

    async init(samples, sampleRate) {
        if (this.isInitialized) return;
        const tempAudioContext = new OfflineAudioContext(1, 1, sampleRate);
        for (const key in samples) {
             if (samples[key].byteLength > 0) {
                try {
                    const audioBuffer = await tempAudioContext.decodeAudioData(samples[key].slice(0));
                    this.samples[key] = audioBuffer.getChannelData(0);
                } catch(e) {
                    self.postMessage({ type: 'error', error: `Failed to decode sample ${key}: ${e instanceof Error ? e.message : String(e)}` });
                }
            }
        }
        this.isInitialized = true;
    },

    getSample(name) {
        return this.samples[name];
    }
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
    drumSettings: { enabled: true, pattern: 'basic', volume: 0.8 },
    scoreName: 'generative',

    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) return;
        this.reset();
        this.isRunning = true;
        
        // Use a lookahead for scheduling
        this.scheduleAheadTime = this.barDuration * 2;
        this.nextBarTime = 0; // use worker's internal clock
        
        // tick immediately
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
        if (settings.score) this.scoreName = settings.score;
        
        // If already running, the interval will pick up the new settings
        if(this.isRunning) {
            clearInterval(this.intervalId);
            this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        }
    },

    tick() {
        if (!this.isRunning) return;

        if (this.scoreName === 'promenade') {
            const barStart = this.barCount * this.beatsPerBar;
            const barEnd = barStart + this.beatsPerBar;

            const filterScore = (score) => score.filter(note => note.time >= barStart && note.time < barEnd).map(note => ({ ...note, time: note.time - barStart }));

            self.postMessage({ type: 'drum_score', data: { score: filterScore(promenadeScore.drums) } });
            self.postMessage({ type: 'bass_score', data: { score: filterScore(promenadeScore.bass) } });
            self.postMessage({ type: 'solo_score', data: { score: filterScore(promenadeScore.solo) } });
            self.postMessage({ type: 'accompaniment_score', data: { score: filterScore(promenadeScore.accompaniment) } });

            const totalDurationInBeats = Math.max(...promenadeScore.drums.map(n => n.time), ...promenadeScore.bass.map(n => n.time));
            if (barEnd >= totalDurationInBeats) {
                this.barCount = 0; // Loop
            } else {
                 this.barCount++;
            }
            return;
        }

        // Generative part
        const musicalContext = PatternProvider.getMusicalContext('E3', 'minor');

        if (this.drumSettings.enabled) {
            const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
            self.postMessage({ type: 'drum_score', data: { score: drumScore }});
        }
        
        if (this.instruments.bass !== 'none') {
            const bassScore = BassGenerator.createScore(this.barCount, musicalContext);
            self.postMessage({ type: 'bass_score', data: { score: bassScore }});
        }
        
        if (this.instruments.solo !== 'none') {
            const soloScore = SoloGenerator.createScore(this.barCount, musicalContext);
            self.postMessage({ type: 'solo_score', data: { score: soloScore }});
        }

        if (this.instruments.accompaniment !== 'none') {
            const accompanimentScore = AccompanimentGenerator.createScore(this.barCount, musicalContext);
             self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore }});
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

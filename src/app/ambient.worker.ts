
import * as Tone from 'tone';

// --- Type Definitions ---
type DrumSettings = {
    enabled: boolean;
    pattern: 'basic' | 'breakbeat' | 'slow' | 'heavy';
    volume: number;
};

type Instruments = {
    solo: 'synthesizer' | 'piano' | 'organ' | 'none';
    accompaniment: 'synthesizer' | 'piano' | 'organ' | 'none';
    bass: 'bass guitar' | 'none';
};

type NoteEvent = {
    time: string;
    note: string;
    duration: string;
    velocity: number;
}

// --- Musician: Bassist ---
class BassGenerator {
    synth: Tone.PolySynth;
    part: Tone.Part<NoteEvent> | null = null;
    
    constructor() {
        this.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'fatsawtooth' },
            envelope: {
                attack: 0.01,
                decay: 0.4,
                sustain: 0.1,
                release: 0.8,
            },
        }).toDestination();
        this.synth.volume.value = -6; // Initial volume
    }

    createPart(patternName: string, beatsPerBar = 4): NoteEvent[] {
        // Simple bassline, plays root and fifth on C2/G2. Occasionally drops to C1.
        const score: NoteEvent[] = [];
        for (let i = 0; i < beatsPerBar; i++) {
           const note = i % 2 === 0 ? 'C2' : 'G2';
           // Occasionally drop to 1st octave
           const finalNote = (i === 0 && Math.random() < 0.25) ? 'C1' : note;
           score.push({ time: `${i}`, note: finalNote, duration: '4n', velocity: 0.9 });
        }
        return score;
    }
    
    start(pattern: string) {
        if (this.part) {
            this.part.stop(0);
            this.part.dispose();
        }
        const partData = this.createPart(pattern);
        this.part = new Tone.Part<NoteEvent>((time, value) => {
            this.synth.triggerAttackRelease(value.note, value.duration, time, value.velocity);
        }, partData).start(0);
        this.part.loop = true;
        this.part.loopEnd = '1m'; // Loop every measure
    }

    stop() {
        this.part?.stop(0);
    }
    
    setVolume(decibels: number) {
        this.synth.volume.value = decibels;
    }

    setEnabled(enabled: boolean) {
        this.setVolume(enabled ? -6 : -Infinity);
    }
}

// --- Musician: Drummer ---
class DrumGenerator {
    sampler: Tone.Sampler | null = null;
    part: Tone.Part | null = null;
    isLoaded = false;
    
    private patterns = {
       basic: [
            { time: "0:0", note: "C1" }, { time: "0:2", note: "C1" }, // Kick
            { time: "0:1", note: "D1" }, { time: "0:3", note: "D1" }, // Snare
            { time: "0:0", note: "E1" }, { time: "0:1", note: "E1" }, { time: "0:2", note: "E1" }, { time: "0:3", note: "E1" } // Hat
        ],
        breakbeat: [
            { time: "0:0", note: "C1" }, { time: "0:0:3", note: "C1" }, { time: "0:2", note: "C1" }, // Kick
            { time: "0:1", note: "D1" }, { time: "0:2:2", note: "D1" }, { time: "0:3:1", note: "D1" }, // Snare
            { time: "0:0", note: "E1" }, { time: "0:1", note: "E1" }, { time: "0:2", note: "E1" }, { time: "0:3", note: "E1" }, // Hat
        ],
        slow: [
            { time: "0:0", note: "C1" }, { time: "0:2", note: "D1" }, // Kick, Snare
            { time: "0:0", note: "F1" }, { time: "0:1", note: "F1" }, { time: "0:2", note: "F1" }, { time: "0:3", note: "F1" } // Ride
        ],
        heavy: [
            { time: "0:0", note: "C1" }, { time: "0:2", note: "C1" }, // Kick
            { time: "0:1", note: "D1" }, { time: "0:3", note: "D1" }, // Snare
            { time: "0:0", note: "F1" }, { time: "0:1", note: "F1" }, { time: "0:2", note: "F1" }, { time: "0:3", note: "F1" }, // Ride
            { time: "0:3:2", note: "G1"}, { time: "0:3:3", note: "H1"}, // Toms
        ],
    };
    
    private fills = [
        [ { time: "0:3:0", note: "D1" }, { time: "0:3:1", note: "G1" }, { time: "0:3:2", note: "H1" }, { time: "0:3:3", note: "I1" }],
        [ { time: "0:3:0", note: "G1" }, { time: "0:3:1", note: "G1" }, { time: "0:3:2", note: "H1" }, { time: "0:3:3", note: "I1" }],
    ];
    
    private barCount = 0;

    constructor(sampleUrls: Record<string, string>, onLoad: () => void) {
        this.sampler = new Tone.Sampler({
            urls: {
                C1: sampleUrls.kick, D1: sampleUrls.snare, E1: sampleUrls.hat,
                F1: sampleUrls.ride, A1: sampleUrls.crash,
                G1: sampleUrls.tom1, H1: sampleUrls.tom2, I1: sampleUrls.tom3,
            },
            onload: () => {
                this.isLoaded = true;
                onLoad();
            }
        }).toDestination();
    }

    createPart(patternName: keyof typeof this.patterns, bar: number) {
        let basePattern = this.patterns[patternName] || this.patterns.basic;
        
        // Every 4th bar, add fill and crash
        if (bar > 0 && bar % 4 === 0) {
            const fill = this.fills[Math.floor(bar / 4) % this.fills.length];
            // Filter out notes from base pattern in the last beat to make room for fill
            const patternWithoutLastBeat = basePattern.filter(note => !note.time.startsWith('0:3'));
            return [{ time: "0:0", note: "A1" }, ...patternWithoutLastBeat, ...fill];
        }
        
        return basePattern;
    }

    start(pattern: keyof typeof this.patterns) {
        if (!this.sampler || !this.isLoaded) return;
        
        if (this.part) {
            this.part.stop(0);
            this.part.dispose();
        }

        // We use a loop to manually schedule parts per bar, allowing for fills.
        Tone.Transport.scheduleRepeat(time => {
            const currentPartData = this.createPart(pattern, this.barCount);
            
            // Schedule all notes for the current bar
            currentPartData.forEach(note => {
                this.sampler?.triggerAttack(note.note, Tone.Transport.toSeconds(note.time) + time);
            });

            this.barCount++;
        }, '1m'); // Repeat every measure
    }

    stop() {
        this.part?.stop(0);
        Tone.Transport.cancel(); // Clear all scheduled events
        this.barCount = 0;
    }

    setVolume(decibels: number) {
        if(this.sampler) this.sampler.volume.value = decibels;
    }

    setEnabled(enabled: boolean) {
        this.setVolume(enabled ? 0 : -Infinity);
    }
}


// --- Conductor (Scheduler) ---
const Conductor = {
    drummer: null as DrumGenerator | null,
    bassist: new BassGenerator(),
    isInitialized: false,
    
    init(sampleUrls: Record<string, string>) {
        this.drummer = new DrumGenerator(sampleUrls, () => {
            this.isInitialized = true;
            self.postMessage({ type: 'initialized' });
        });
    },

    start(drumSettings: DrumSettings, instruments: Instruments) {
        if (!this.isInitialized || !this.drummer) return;
        
        this.update(drumSettings, instruments);
        
        Tone.Transport.start();
        self.postMessage({ type: 'started' });
    },

    stop() {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.drummer?.stop();
        this.bassist.stop();
    },

    update(drumSettings: DrumSettings, instruments: Instruments) {
        if (!this.isInitialized || !this.drummer) return;

        Tone.Transport.bpm.value = 100; // Let's fix BPM for now for simplicity

        // Update Drummer
        this.drummer.setEnabled(drumSettings.enabled);
        this.drummer.start(drumSettings.pattern);

        // Update Bassist
        this.bassist.setEnabled(instruments.bass !== 'none');
        if (instruments.bass !== 'none') {
             this.bassist.start(drumSettings.pattern);
        }
    },
    
    setDrums(drumSettings: DrumSettings) {
        if (!this.drummer) return;
        this.drummer.setEnabled(drumSettings.enabled);
        if (drumSettings.enabled) {
            this.drummer.start(drumSettings.pattern);
        } else {
            this.drummer.stop();
        }
    },

    setInstruments(instruments: Instruments) {
       this.bassist.setEnabled(instruments.bass !== 'none');
       if (instruments.bass !== 'none' && Tone.Transport.state === 'started') {
           this.bassist.start('basic'); // restart with current pattern
       } else {
           this.bassist.stop();
       }
    }
};

// --- MessageBus ---
self.onmessage = async (event: MessageEvent) => {
    const { command, data } = event.data;
    
    try {
        switch (command) {
            case 'init':
                await Tone.start(); // AudioContext must be started by user gesture
                Conductor.init(data.sampleUrls);
                break;
            
            case 'start':
                 if (!Conductor.isInitialized) {
                   throw new Error("Worker is not initialized with samples yet. Call 'init' first.");
                }
                Conductor.start(data.drumSettings, data.instruments);
                break;

            case 'stop':
                Conductor.stop();
                break;
            
            case 'set_instruments':
                Conductor.setInstruments(data);
                break;

            case 'set_drums':
                 Conductor.setDrums(data);
                break;
        }
    } catch (e) {
        self.postMessage({ type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
};

// This worker no longer renders audio itself. Tone.js handles output to destination.
// The main thread is responsible for connecting Tone's output to the AudioContext destination.


/// <reference lib="webworker" />

import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName, WorkletNote, DrumNote } from '@/types/music';

// --- Evolution Engine (New) ---
class EvolutionEngine {
    private barCount: number;
    private chordProgression: string[][];
    private noteIdCounter: number;

    constructor() {
        this.barCount = 0;
        // I-V-vi-IV progression in C Major
        this.chordProgression = [
            ['C4', 'E4', 'G4'], // I: C Major
            ['G4', 'B4', 'D5'], // V: G Major
            ['A4', 'C5', 'E5'], // vi: A Minor
            ['F4', 'A4', 'C5']  // IV: F Major
        ];
        this.noteIdCounter = 0;
    }

    setBar(bar: number) {
        this.barCount = bar;
    }

    private getNextNoteId() {
        return this.noteIdCounter++;
    }

    getCurrentChord(): string[] {
        const chordIndex = Math.floor(this.barCount / 2) % this.chordProgression.length;
        return this.chordProgression[chordIndex];
    }

    generateAccompanimentScore(preset: any, volume: number, barDuration: number): WorkletNote[] {
        if (this.barCount % 2 !== 0) {
            return []; // Play chord only on even bars
        }
    
        const currentChord = this.getCurrentChord();
        return currentChord.map(note => ({
            id: this.getNextNoteId(),
            part: 'accompaniment',
            freq: noteToFreq(note),
            attack: preset.attack,
            decay: preset.decay,
            sustain: preset.sustain,
            release: preset.release,
            oscType: preset.oscType,
            startTime: 0, 
            duration: barDuration, // Play for one bar, not two
            velocity: volume / 3 
        }));
    }

    generateDrumScore(volume: number, secondsPerBeat: number): DrumNote[] {
       const score: DrumNote[] = [];
       if (this.barCount % 1 === 0) {
            score.push({ sample: 'kick', velocity: volume, beat: 0, time: 0 });
            score.push({ sample: 'snare', velocity: volume * 0.8, beat: 2, time: 2 * secondsPerBeat });
       }
       return score;
    }
}


// Presets define the sound characteristics for our synth worklet
const PRESETS = {
    'synthesizer_solo': { attack: 0.1, decay: 0.5, sustain: 0.7, release: 1.0, oscType: 'fatsine' },
    'piano_solo': { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.8, oscType: 'sine' },
    'organ_solo': { attack: 0.2, decay: 0.4, sustain: 0.8, release: 1.5, oscType: 'fatsawtooth' },
    
    'synthesizer_accompaniment': { attack: 0.2, decay: 0.3, sustain: 0.8, release: 0.8, oscType: 'fatsine' },
    'piano_accompaniment': { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.8, oscType: 'sine' },
    'organ_accompaniment': { attack: 0.3, decay: 0.5, sustain: 0.9, release: 1.0, oscType: 'fatsawtooth' },

    'bass_synth_bass': { attack: 0.1, decay: 0.3, sustain: 0.9, release: 1.0, oscType: 'sawtooth' },
    'bassGuitar_bass': { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.5, oscType: 'fmsquare' },

    'piu_effects': { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5, oscType: 'sine' },
    'bell_effects': { attack: 0.01, decay: 1.4, sustain: 0, release: 2.5, oscType: 'fmsquare' }, // Using fmsquare for metallic sound
};

// --- Helper to get frequency from a note string like "A4" ---
function noteToFreq(note: string) {
    const A4 = 440;
    const noteMap: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
    const octave = parseInt(note.slice(-1));
    const key = note.slice(0, -1);
    const semitone = noteMap[key] + (octave - 4) * 12;
    return A4 * Math.pow(2, semitone / 12);
}

const DrumPatterns: Record<string, Omit<DrumNote, 'time'>[]> = {
    'ambient_beat': [
        { sample: 'kick', velocity: 1.0, beat: 0 },
        { sample: 'hat', velocity: 0.3, beat: 0.5 },
        { sample: 'snare', velocity: 0.8, beat: 1.0 },
        { sample: 'hat', velocity: 0.3, beat: 1.5 },
        { sample: 'kick', velocity: 0.9, beat: 2.0 },
        { sample: 'hat', velocity: 0.3, beat: 2.5 },
        { sample: 'snare', velocity: 0.7, beat: 3.0 },
        { sample: 'hat', velocity: 0.3, beat: 3.5 },
    ]
};

// --- The main composer logic ---
const Composer = {
    isRunning: false,
    barCount: 0,
    evolutionEngine: new EvolutionEngine(),
    
    // Settings from main thread
    bpm: 75,
    instrumentSettings: {
        solo: { name: 'none', volume: 0.8 },
        accompaniment: { name: 'synthesizer', volume: 0.7 },
        bass: { name: 'none', volume: 0.9 },
    } as InstrumentSettings,
    drumSettings: { pattern: 'none', volume: 0.7 } as DrumSettings,
    effectsSettings: { mode: 'none', volume: 0.7 } as EffectsSettings,
    score: 'promenade' as ScoreName,


    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    
    reset() {
        console.log("[WORKER_TRACE] Composer state reset.");
        this.barCount = 0;
        this.evolutionEngine.setBar(0);
    },

    start(settings: any) {
        if (this.isRunning) return;
        this.reset();
        this.updateSettings(settings);
        this.isRunning = true;
        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        self.postMessage({ type: 'stopped' });
    },
    
    updateSettings(settings: any) {
        if (settings.instrumentSettings) this.instrumentSettings = settings.instrumentSettings;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.effectsSettings) this.effectsSettings = settings.effectsSettings;
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
    },

    generateStaticDrumScoreForBar(): DrumNote[] {
        if (this.drumSettings.pattern === 'none' || !DrumPatterns[this.drumSettings.pattern]) {
            return [];
        }
        const pattern = DrumPatterns[this.drumSettings.pattern];
        
        return pattern.map(note => ({
            ...note,
            time: note.beat * this.secondsPerBeat,
            velocity: note.velocity * this.drumSettings.volume,
        }));
    },

    // --- Note Generation ---
    generateNotesForBar(bar: number): { solo: WorkletNote[], accompaniment: WorkletNote[], bass: WorkletNote[] } {
        const soloNotes: WorkletNote[] = [];
        let accompanimentNotes: WorkletNote[] = [];
        const bassNotes: WorkletNote[] = [];
        
        this.evolutionEngine.setBar(bar);

        if (this.instrumentSettings.accompaniment.name !== 'none') {
             const presetKey = `${this.instrumentSettings.accompaniment.name}_accompaniment` as keyof typeof PRESETS;
             const preset = PRESETS[presetKey];
             if (preset) {
                const barDuration = this.beatsPerBar * this.secondsPerBeat;
                accompanimentNotes = this.evolutionEngine.generateAccompanimentScore(preset, this.instrumentSettings.accompaniment.volume, barDuration);
             }
        }
        
        return { solo: soloNotes, accompaniment: accompanimentNotes, bass: bassNotes };
    },

    generateChunk(chunkDurationInBars: number) {
        console.log(`[WORKER_TRACE] generateChunk called for ${chunkDurationInBars} bars.`);
        if (!this.isRunning) return;

        let synthScore: { solo: WorkletNote[], accompaniment: WorkletNote[], bass: WorkletNote[], effects: WorkletNote[] } = { solo: [], accompaniment: [], bass: [], effects: [] };
        let drumScore: DrumNote[] = [];
        
        const barDuration = this.beatsPerBar * this.secondsPerBeat;

        for (let i = 0; i < chunkDurationInBars; i++) {
            const currentBar = this.barCount + i;
            const barStartTime = i * barDuration;

            const { solo, accompaniment, bass } = this.generateNotesForBar(currentBar);
            
            accompaniment.forEach(n => { n.startTime += barStartTime; synthScore.accompaniment.push(n); });

            if (this.drumSettings.pattern === 'composer') {
                const barDrumNotes = this.evolutionEngine.generateDrumScore(this.drumSettings.volume, this.secondsPerBeat);
                barDrumNotes.forEach(n => { 
                    n.time += barStartTime; 
                    drumScore.push(n); 
                });
            } else {
                const barDrumNotes = this.generateStaticDrumScoreForBar();
                barDrumNotes.forEach(n => { 
                    n.time += barStartTime; 
                    drumScore.push(n); 
                });
            }
        }
        
        this.barCount += chunkDurationInBars;
        
        const totalSynthNotes = synthScore.solo.length + synthScore.accompaniment.length + synthScore.bass.length + synthScore.effects.length;
        console.log(`[WORKER_TRACE] Generated score. Synth notes: ${totalSynthNotes}, Drum notes: ${drumScore.length}`);
        console.log("[WORKER_TRACE] Posting 'score_ready' message back to UI.");
        self.postMessage({ type: 'score_ready', synthScore, drumScore });
    }
};


// --- MessageBus ---
self.onmessage = async (event: MessageEvent) => {
    const { command, data } = event.data;
    console.log(`[WORKER_TRACE] Received command: ${command}`, data);

    try {
        switch (command) {
            case 'init':
                self.postMessage({ type: 'initialized' });
                break;
            case 'start':
                Composer.start(data);
                break;
            case 'stop':
                Composer.stop();
                break;
            case 'update_settings':
                Composer.updateSettings(data);
                break;
            case 'request_new_score':
                Composer.generateChunk(data.chunkDurationInBars);
                break;
        }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        self.postMessage({ type: 'error', error });
    }
};

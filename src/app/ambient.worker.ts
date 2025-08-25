
/// <reference lib="webworker" />

import { promenadeScore } from '@/lib/scores/promenade';
import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName, WorkletNote, DrumNote } from '@/types/music';

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
    
    start(settings: any) {
        if (this.isRunning) return;
        this.updateSettings(settings);
        this.barCount = 0;
        this.isRunning = true;
        self.postMessage({ type: 'started' });
        console.log("[WORKER_TRACE] Composer started.");
    },

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        self.postMessage({ type: 'stopped' });
        console.log("[WORKER_TRACE] Composer stopped.");
    },
    
    updateSettings(settings: any) {
        if (settings.instrumentSettings) this.instrumentSettings = settings.instrumentSettings;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.effectsSettings) this.effectsSettings = settings.effectsSettings;
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
        console.log("[WORKER_TRACE] Settings updated:", { settings });
    },

    generateDrumScoreForBar(): DrumNote[] {
        if (this.drumSettings.pattern === 'none' || !DrumPatterns[this.drumSettings.pattern]) {
            return [];
        }
        const pattern = DrumPatterns[this.drumSettings.pattern];
        
        return pattern.map(note => ({
            ...note,
            time: note.beat * this.secondsPerBeat, // Convert beat time to seconds
            velocity: note.velocity * this.drumSettings.volume,
        }));
    },

    // --- Note Generation ---
    // This is a simplified placeholder for the generative logic.
    // In a real scenario, this would house EvolveEngine or MandelbrotEngine.
    generateNotesForBar(bar: number): { solo: WorkletNote[], accompaniment: WorkletNote[], bass: WorkletNote[] } {
        const soloNotes: WorkletNote[] = [];
        const accompanimentNotes: WorkletNote[] = [];
        const bassNotes: WorkletNote[] = [];
        
        // --- Accompaniment (The only active musician for now) ---
        if (this.instrumentSettings.accompaniment.name !== 'none') {
             const presetKey = `${this.instrumentSettings.accompaniment.name}_accompaniment` as keyof typeof PRESETS;
             const preset = PRESETS[presetKey];
             if (preset) {
                // Generate a simple C Major chord every 2 bars
                if (bar % 2 === 0) {
                    ['C4', 'E4', 'G4'].forEach((note, index) => {
                         accompanimentNotes.push({
                            part: 'accompaniment',
                            freq: noteToFreq(note),
                            attack: preset.attack,
                            decay: preset.decay,
                            sustain: preset.sustain,
                            release: preset.release,
                            oscType: preset.oscType,
                            startTime: 0 + (index * 0.05),
                            duration: this.secondsPerBeat * 4, // 1 bar duration
                            velocity: this.instrumentSettings.accompaniment.volume / 3 // Prevent clipping
                        });
                    });
                }
             }
        }
        
        return { solo: soloNotes, accompaniment: accompanimentNotes, bass: bassNotes };
    },

    generateChunk(chunkDurationInBars: number) {
        if (!this.isRunning) return;
        console.log(`[WORKER_TRACE] Generating chunk for ${chunkDurationInBars} bars.`);

        let synthScore: { solo: WorkletNote[], accompaniment: WorkletNote[], bass: WorkletNote[], effects: WorkletNote[] } = { solo: [], accompaniment: [], bass: [], effects: [] };
        let drumScore: DrumNote[] = [];
        
        const barDuration = this.beatsPerBar * this.secondsPerBeat;

        for (let i = 0; i < chunkDurationInBars; i++) {
            const currentBar = this.barCount + i;
            const barStartTime = i * barDuration;

            const { solo, accompaniment, bass } = this.generateNotesForBar(currentBar);
            
            accompaniment.forEach(n => { n.startTime += barStartTime; synthScore.accompaniment.push(n); });
            // solo and bass are intentionally left empty for this test

            if (this.drumSettings.pattern !== 'none') {
                const barDrumNotes = this.generateDrumScoreForBar();
                barDrumNotes.forEach(n => { 
                    n.time += barStartTime; 
                    drumScore.push(n); 
                });
            }
        }
        
        this.barCount += chunkDurationInBars;

        self.postMessage({ type: 'score_ready', synthScore, drumScore });
        console.log("[WORKER_TRACE] Dispatched 'score_ready' with new score.", {synthScore, drumScore});
    }
};


// --- MessageBus ---
self.onmessage = async (event: MessageEvent) => {
    const { command, data } = event.data;

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

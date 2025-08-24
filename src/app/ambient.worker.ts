
/// <reference lib="webworker" />

import { promenadeScore } from '@/lib/scores/promenade';
import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName, WorkletNote } from '@/types/music';

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

// --- The main composer logic ---
const Composer = {
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    bpm: 75,
    instrumentSettings: {
        solo: { name: 'synthesizer', volume: 0.8 },
        accompaniment: { name: 'synthesizer', volume: 0.7 },
        bass: { name: 'bass_synth', volume: 0.9 },
    } as InstrumentSettings,
    drumSettings: { pattern: 'ambient-beat', volume: 0.7 } as DrumSettings,
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

    // --- Note Generation ---
    // This is a simplified placeholder for the generative logic.
    // In a real scenario, this would house EvolveEngine or MandelbrotEngine.
    generateNotesForBar(bar: number): { solo: WorkletNote[], accompaniment: WorkletNote[], bass: WorkletNote[] } {
        const soloNotes: WorkletNote[] = [];
        const accompanimentNotes: WorkletNote[] = [];
        const bassNotes: WorkletNote[] = [];
        const secondsPerBar = this.beatsPerBar * this.secondsPerBeat;

        // --- Bass ---
        if (this.instrumentSettings.bass.name !== 'none') {
            const presetKey = `${this.instrumentSettings.bass.name}_bass` as keyof typeof PRESETS;
            const preset = PRESETS[presetKey];
            if (preset) {
                bassNotes.push({
                    part: 'bass',
                    freq: noteToFreq('E1'),
                    attack: preset.attack,
                    decay: preset.decay,
                    sustain: preset.sustain,
                    release: preset.release,
                    oscType: preset.oscType,
                    startTime: 0,
                    duration: secondsPerBar,
                    velocity: this.instrumentSettings.bass.volume
                });
            }
        }
        
        // --- Accompaniment ---
        if (this.instrumentSettings.accompaniment.name !== 'none') {
             const presetKey = `${this.instrumentSettings.accompaniment.name}_accompaniment` as keyof typeof PRESETS;
             const preset = PRESETS[presetKey];
             if (preset) {
                ['E3', 'G3', 'B3'].forEach((note, index) => {
                     accompanimentNotes.push({
                        part: 'accompaniment',
                        freq: noteToFreq(note),
                        attack: preset.attack,
                        decay: preset.decay,
                        sustain: preset.sustain,
                        release: preset.release,
                        oscType: preset.oscType,
                        startTime: index * 0.1, // Strumming effect
                        duration: secondsPerBar,
                        velocity: this.instrumentSettings.accompaniment.volume
                    });
                });
             }
        }
        
        // --- Solo ---
        if (this.instrumentSettings.solo.name !== 'none' && bar % 2 === 0) { // Play every other bar
            const presetKey = `${this.instrumentSettings.solo.name}_solo` as keyof typeof PRESETS;
            const preset = PRESETS[presetKey];
            if (preset) {
                soloNotes.push({
                    part: 'solo',
                    freq: noteToFreq('B4'),
                    attack: preset.attack,
                    decay: preset.decay,
                    sustain: preset.sustain,
                    release: preset.release,
                    oscType: preset.oscType,
                    startTime: secondsPerBar * 0.5,
                    duration: secondsPerBar * 0.5,
                    velocity: this.instrumentSettings.solo.volume
                });
            }
        }

        return { solo: soloNotes, accompaniment: accompanimentNotes, bass: bassNotes };
    },

    generateChunk(chunkDurationInBars: number) {
        if (!this.isRunning) return;
        console.log(`[WORKER_TRACE] Generating chunk for ${chunkDurationInBars} bars.`);

        let score: { solo: WorkletNote[], accompaniment: WorkletNote[], bass: WorkletNote[], effects: WorkletNote[] } = { solo: [], accompaniment: [], bass: [], effects: [] };
        
        const barDuration = this.beatsPerBar * this.secondsPerBeat;

        for (let i = 0; i < chunkDurationInBars; i++) {
            const currentBar = this.barCount + i;
            const barStartTime = i * barDuration;

            const { solo, accompaniment, bass } = this.generateNotesForBar(currentBar);
            
            solo.forEach(n => { n.startTime += barStartTime; score.solo.push(n); });
            accompaniment.forEach(n => { n.startTime += barStartTime; score.accompaniment.push(n); });
            bass.forEach(n => { n.startTime += barStartTime; score.bass.push(n); });
        }
        
        this.barCount += chunkDurationInBars;

        self.postMessage({ type: 'score_ready', score });
        console.log("[WORKER_TRACE] Dispatched 'score_ready' with new score.", score);
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

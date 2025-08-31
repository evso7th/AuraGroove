

// This imports the full type definition for the Tone.js library.
// It's a heavy import, so we only use it in type-checking, not runtime.
import type * as Tone from 'tone';

export type ToneJS = typeof Tone;

export type AudioProfile = 'desktop' | 'mobile';

// --- Types for Worker -> Main Thread Communication ---
export type AudioChunk = {
    chunk: Float32Array;
    startTime: number; // Absolute time from audioContext.currentTime
    duration: number;
};


// --- Types for Main Thread -> Worker Communication ---
export type WorkerSettings = {
    bpm: number;
    score: ScoreName;
    drumSettings: Omit<DrumSettings, 'volume'> & { enabled: boolean, volume: number };
    instrumentSettings: InstrumentSettings;
};

export type WorkerCommand = 
| { command: 'update_settings', data: Partial<WorkerSettings> }
| { command: 'init' }
| { command: 'reset' }
| { command: 'tick' };


// --- Types for internal Worker logic ---
export type DrumSampleName = 'kick' | 'snare' | 'hat' | 'crash' | 'ride';

export type DrumNote = {
    sample: DrumSampleName;
    time: number; // in beats, relative to the start of the bar
    velocity: number;
};

export type SynthNote = {
    note: string | string[]; // Can be a single note or an array for a chord
    duration: number; // in beats
    time: number; // in beats, relative to the start of the bar
    velocity: number;
};


// --- UI Types ---
export type InstrumentSettings = {
  solo: {
      name: 'synthesizer' | 'piano' | 'organ' | 'mellotron' | 'portamento' | 'none';
      volume: number; // 0-1
  };
  bass: {
      name: 'bassGuitar' | 'BassGroove' | 'portamento' | 'portamentoMob' | 'BassGrooveMob' | 'none';
      volume: number; // 0-1
  };
};

export type DrumSettings = {
    pattern: 'ambient_beat' | 'composer' | 'none';
    volume: number;
};

export type EffectsSettings = {
    mode: 'none' | 'piu' | 'bell' | 'mixed';
    volume: number;
};

export type ScoreName = 'evolve' | 'omega' | 'promenade';

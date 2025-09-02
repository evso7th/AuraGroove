
// This imports the full type definition for the Tone.js library.
// It's a heavy import, so we only use it in type-checking, not runtime.
import type * as Tone from 'tone';

export type ToneJS = typeof Tone;

export type AudioProfile = 'desktop' | 'mobile';

// --- Types for Worker -> Main Thread Communication ---
export type AudioChunk = {
    chunk: Float32Array;
    duration: number; // in seconds
    startTime: number; // absolute time from AudioContext
};

export type ComposerWorkerMessage = {
  type: 'audio_chunk';
  data: Omit<AudioChunk, 'startTime'>; // startTime is determined by the player
} | {
  type: 'error';
  error?: string;
} | {
  type: 'worker_ready' | 'worker_started';
} | {
  type: 'log';
  message: string;
};


// --- Types for Main Thread -> Worker Communication ---
export type WorkerSettings = {
    bpm: number;
    score: ScoreName;
    drumSettings: Omit<DrumSettings, 'volume'> & { enabled: boolean };
    instrumentSettings: InstrumentSettings;
};

export type WorkerCommand = 
| { command: 'update_settings', data: Partial<WorkerSettings> }
| { command: 'init', data: { sampleRate: number } }
| { command: 'start' }
| { command: 'stop' };


// --- Types for Main Thread <-> Iframe Communication (DEPRECATED but kept for reference) ---
export type RhythmFrameCommand = {
    command: 'init' | 'start' | 'stop' | 'schedule' | 'set_param';
    payload?: any;
}
export type RhythmFrameMessage = {
    type: 'request_score' | 'rhythm_frame_ready' | 'error';
    error?: string;
}


// --- Types for internal Worker logic ---
export type DrumSampleName = 'kick' | 'snare' | 'hat' | 'crash' | 'ride';

export type DrumNote = {
    sample: DrumSampleName;
    time: number; // in beats, relative to the start of the bar
    velocity: number;
};

export type SynthNote = {
    note: string | string[]; // Can be a single note or an array for a chord
    duration: number | string; // in Tone.js Time format
    time: number; // in beats, relative to the start of the bar
    velocity: number;
    voiceIndex?: number; // Optional: specifies which synth voice to use
};


// --- UI Types ---
export type BassInstrument = 'bassGuitar' | 'BassGroove' | 'portamento' | 'portamentoMob' | 'BassGrooveMob' | 'none';
export type MelodyInstrument = 'synth' | 'none';
export type MelodyTechnique = 'arpeggio' | 'portamento' | 'glissando';


export type InstrumentSettings = {
  bass: {
      name: BassInstrument;
      volume: number; // 0-1
  };
  melody: {
      name: MelodyInstrument;
      volume: number; // 0-1
      technique: MelodyTechnique;
  };
};

export type DrumSettings = {
    pattern: 'ambient_beat' | 'composer' | 'none';
    volume: number;
};

export type EffectsSettings = {
    enabled: boolean;
};

export type ScoreName = 'evolve' | 'omega' | 'promenade';

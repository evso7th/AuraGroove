
// This imports the full type definition for the Tone.js library.
// It's a heavy import, so we only use it in type-checking, not runtime.
import type * as Tone from 'tone';

export type ToneJS = typeof Tone;

export type AudioProfile = 'desktop' | 'mobile';

// --- Types for Worker -> Main Thread Communication ---
export type ComposerWorkerMessage = {
  type: 'score';
  data: {
    drumScore: DrumNote[];
    bassScore: SynthNote[];
    melodyScore: SynthNote[];
    barDuration: number;
  };
} | {
  type: 'error';
  error?: string;
};


// --- Types for Main Thread -> Worker Communication ---
export type WorkerSettings = {
    bpm: number;
    score: ScoreName;
    drumSettings: Omit<DrumSettings, 'volume'> & { enabled: boolean };
    instrumentSettings: InstrumentSettings;
};

export type WorkerCommand = 
| { command: 'set_param', data: { key: string, value: any } }
| { command: 'init' }
| { command: 'reset' }
| { command: 'tick' };


// --- Types for Main Thread <-> Iframe Communication ---
export type RhythmFrameCommand = {
    command: 'init' | 'start' | 'stop' | 'schedule' | 'set_param';
    payload?: any;
}
export type RhythmFrameMessage = {
    type: 'request_score' | 'rhythm_frame_ready';
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
    duration: number; // in beats
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

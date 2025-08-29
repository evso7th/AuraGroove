
// This imports the full type definition for the Tone.js library.
// It's a heavy import, so we only use it in type-checking, not runtime.
import type * as Tone from 'tone';

export type ToneJS = typeof Tone;

export type InstrumentPart = 'solo' | 'accompaniment' | 'bass' | 'effects' | 'drums';
export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'fatsine' | 'fatsawtooth' | 'fmsquare';

export type WorkletNote = {
    id: number; // Unique ID for each note event
    part: InstrumentPart;
    freq: number;
    velocity: number;
    // ADSR
    attack: number;
    decay: number;
    sustain: number; // level
    release: number;
    // Timing
    startTime: number; // in seconds, relative to the start of the score chunk
    duration: number; // in seconds
    // Sound
    oscType: OscillatorType;
};

export type DrumSample = 'kick' | 'snare' | 'hat' | 'crash' | 'ride';

export type DrumNote = {
    sample: DrumSample;
    time: number; // in seconds, relative to the start of the score chunk
    velocity: number;
    beat: number; // beat position within the bar
};


export type InstrumentSettings = {
  solo: {
      name: 'synthesizer' | 'piano' | 'organ' | 'none';
      volume: number; // 0-1
  };
  accompaniment: {
      name: 'synthesizer' | 'piano' | 'organ' | 'none';
      volume: number; // 0-1
  };
  bass: {
      name: 'bass_synth' | 'bassGuitar' | 'none';
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

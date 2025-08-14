
import type * as Tone from 'tone';

export type Instruments = {
  solo: 'synthesizer' | 'piano' | 'organ' | 'none';
  accompaniment: 'synthesizer' | 'piano' | 'organ' | 'none';
  bass: 'bass synth' | 'none';
};

export type DrumSettings = {
    pattern: 'basic' | 'breakbeat' | 'slow' | 'heavy' | 'none';
    volume: number;
};

export type EffectsSettings = {
    mode: 'none' | 'piu' | 'bell' | 'mixed';
    volume: number;
};

export type BassNote = {
    note: string;
    time: number;
    duration: Tone.Unit.Time;
    velocity: number;
}

export type SoloNote = {
    notes: string | string[];
    time: Tone.Unit.Time;
    duration: Tone.Unit.Time;
}

export type AccompanimentNote = {
    notes: string | string[];
    time: Tone.Unit.Time;
    duration: Tone.Unit.Time;
}

export type DrumNote = {
    sample: string;
    time: number; // time in beats from the start of the loop
    velocity?: number;
}

export type EffectNote = {
    type: 'piu' | 'bell';
    time: number; // time in beats
    note: string; // pitch of the effect
    duration?: Tone.Unit.Time; // optional duration
}

export type ScoreName = 'generative' | 'promenade';

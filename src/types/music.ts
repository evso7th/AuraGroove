
import type * as Tone from 'tone';

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
      name: 'bass synth' | 'bassGuitar' | 'none';
      volume: number; // 0-1
  };
};

export type DrumSettings = {
    pattern: 'basic' | 'breakbeat' | 'slow' | 'heavy' | 'none' | 'ambient-beat';
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
    isFirst?: boolean; // For special handling of the first note in a sequence
    velocity?: number; // Optional velocity for the note
}

export type ScoreName = 'evolve' | 'omega' | 'promenade';

// Obsolete, replaced by InstrumentSettings
export type Instruments = {
  solo: 'synthesizer' | 'piano' | 'organ' | 'none';
  accompaniment: 'synthesizer' | 'piano' | 'organ' | 'none';
  bass: 'bass synth' | 'bassGuitar' | 'none';
};

    

    
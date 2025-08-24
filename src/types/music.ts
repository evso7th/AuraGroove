
export type InstrumentPart = 'solo' | 'accompaniment' | 'bass' | 'effects';
export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'fatsine' | 'fatsawtooth' | 'fmsquare';

export type WorkletNote = {
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

export type ScoreName = 'evolve' | 'omega' | 'promenade';

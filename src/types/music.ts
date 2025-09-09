

// A musical note to be played by a synthesizer.
export type Note = {
    midi: number;         // MIDI note number (e.g., 60 for C4).
    time: number;         // When to play it, in seconds, relative to the start of the audio chunk.
    duration: number;     // How long the note should last, in seconds.
    velocity?: number;    // How loud to play it (0-1), optional.
    part?: 'spark';       // Optional identifier for special notes
};

// A note for the sampler, identified by a string name.
export type SamplerNote = {
    note: string;         // Note name corresponding to the sampler mapping (e.g., 'C4' for kick).
    time: number;         // When to play it, in seconds, relative to the start of the audio chunk.
    velocity?: number;    // How loud to play it (0-1), optional.
};

export type DrumsScore = SamplerNote[];
export type EffectsScore = SamplerNote[];

// A score is an object containing arrays of notes for each part.
export type Score = {
    bass?: Note[];
    melody?: Note[];
    accompaniment?: Note[];
    drums?: DrumsScore;
    effects?: EffectsScore;
    sparkle?: boolean; // Command to play a sparkle
    pad?: string; // Command to change pad
};

// --- UI Types ---
export type BassInstrument = 'classicBass' | 'glideBass' | 'ambientDrone' | 'resonantGliss' | 'hypnoticDrone' | 'livingRiff' | 'none';
export type MelodyInstrument = 'synth' | 'organ' | 'mellotron' | 'theremin' | 'none';
export type AccompanimentInstrument = MelodyInstrument;
export type InstrumentPart = 'bass' | 'melody' | 'accompaniment' | 'drums' | 'effects' | 'sparkles' | 'pads';
export type BassTechnique = 'arpeggio' | 'portamento' | 'glissando' | 'glide' | 'pulse';


export type InstrumentSettings = {
  bass: {
      name: BassInstrument;
      volume: number; // 0-1
      technique: BassTechnique;
  };
  melody: {
      name: MelodyInstrument;
      volume: number; // 0-1
  };
  accompaniment: {
      name: AccompanimentInstrument;
      volume: number; // 0-1
  };
};

export type DrumSettings = {
    pattern: 'ambient_beat' | 'composer' | 'none';
    volume: number;
};

export type EffectsSettings = {
    enabled: boolean;
};

export type TextureSettings = {
    sparkles: {
        enabled: boolean;
        volume: number;
    };
    pads: {
        enabled: boolean;
        volume: number;
    };
};

export type TimerSettings = {
    duration: number; // in seconds
    timeLeft: number;
    isActive: boolean;
};

export type ScoreName = 'evolve' | 'omega' | 'journey' | 'dreamtales' | 'multeity';

// Settings sent from the UI to the main engine/worker.
export type WorkerSettings = {
    bpm: number;
    score: ScoreName;
    drumSettings: Omit<DrumSettings, 'volume'> & { enabled: boolean };
    instrumentSettings: InstrumentSettings;
    textureSettings: Omit<TextureSettings, 'volume'>;
    density: number; // Controls musical density, 0 to 1
};

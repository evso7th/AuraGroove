

// A musical note to be played by a synthesizer.
export type Note = {
    midi: number;         // MIDI note number (e.g., 60 for C4).
    time: number;         // When to play it, in seconds, relative to the start of the audio chunk.
    duration: number;     // How long the note should last, in seconds.
    velocity?: number;    // How loud to play it (0-1), optional.
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
};

// --- UI Types ---
export type BassInstrument = 'portamento' | 'none';
export type MelodyInstrument = 'synth' | 'none';
export type AccompanimentInstrument = 'poly_synth' | 'none';
export type InstrumentPart = 'bass' | 'melody' | 'accompaniment' | 'drums' | 'effects';


export type InstrumentSettings = {
  bass: {
      name: BassInstrument;
      volume: number; // 0-1
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

export type ScoreName = 'evolve' | 'omega' | 'promenade' | 'dreamtales';

// Settings sent from the UI to the main engine/worker.
export type WorkerSettings = {
    bpm: number;
    score: ScoreName;
    drumSettings: Omit<DrumSettings, 'volume'> & { enabled: boolean };
    instrumentSettings: InstrumentSettings;
    density: number; // Controls musical density, 0 to 1
};

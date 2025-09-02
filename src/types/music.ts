
// A musical note to be played by a synthesizer.
export type Note = {
    midi: number;         // MIDI note number (e.g., 60 for C4).
    time: number;         // When to play it, in seconds, relative to the start of the audio chunk.
    duration: number;     // How long the note should last, in seconds.
    velocity?: number;    // How loud to play it (0-1), optional.
};

// A score is an array of notes representing a piece of music for a time slice.
export type Score = Note[];

// --- UI Types ---
export type BassInstrument = 'portamento' | 'bassGuitar' | 'BassGroove' | 'portamentoMob' | 'BassGrooveMob' | 'none';

export type InstrumentSettings = {
  bass: {
      name: BassInstrument;
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

export type ScoreName = 'evolve' | 'omega' | 'promenade';

// Settings sent from the UI to the main engine/worker.
export type WorkerSettings = {
    bpm: number;
    score: ScoreName;
    drumSettings: Omit<DrumSettings, 'volume'> & { enabled: boolean };
    instrumentSettings: InstrumentSettings;
    density: number; // Controls musical density, 0 to 1
};

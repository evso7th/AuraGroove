
// A simple pseudo-random number generator for deterministic sequences
function lcg(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}

// --- Basic Note Generation (Placeholders) ---

const PENTATONIC_SCALE = [0, 2, 4, 7, 9]; // C Major Pentatonic offsets

function getRandomNote(scale: number[], octave: number, random: () => number): number {
    const noteIndex = Math.floor(random() * scale.length);
    return 60 + octave * 12 + scale[noteIndex]; // 60 is C4
}

export function generateSimpleSolo(random: () => number): number[] {
    const shouldPlay = random() > 0.95; // Play very infrequently
    if (!shouldPlay) return [];
    return [getRandomNote(PENTATONIC_SCALE, 1, random)];
}

export function generateSimpleAccompaniment(random: () => number): number[] {
    const shouldPlay = random() > 0.9; // Play infrequently
    if (!shouldPlay) return [];
    const root = getRandomNote(PENTATONIC_SCALE, 0, random);
    return [root, root + 4]; // simple interval
}

export function generateSimpleBass(random: () => number): number[] {
    const shouldPlay = random() > 0.8; // Play a bit more often
    if (!shouldPlay) return [];
    return [getRandomNote(PENTATONIC_SCALE, -1, random)];
}

// --- Drum Patterns ---

export type DrumStep = {
    sample: 'kick' | 'snare' | 'hat';
    time: number; // 0 to 1 (percentage of a beat)
};

export const BEATS_PER_BAR = 4;

// The simplest possible pattern to ensure no logic errors.
export const simpleDrumPattern: DrumStep[][] = [
    // Beat 1
    [{ sample: 'kick', time: 0 }, { sample: 'hat', time: 0 }],
    // Beat 2
    [{ sample: 'hat', time: 0 }],
    // Beat 3
    [{ sample: 'snare', time: 0 }, { sample: 'hat', time: 0 }],
    // Beat 4
    [{ sample: 'hat', time: 0 }],
];

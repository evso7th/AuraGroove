
// A simple pseudo-random number generator for deterministic sequences
function lcg(seed: number) {
  return () => (seed = (seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}

// --- Basic Note Generation ---

const PENTATONIC_SCALE = [0, 2, 4, 7, 9]; // C Major Pentatonic offsets

function getRandomNote(scale: number[], octave: number, random: () => number): number {
    const noteIndex = Math.floor(random() * scale.length);
    return 60 + octave * 12 + scale[noteIndex]; // 60 is C4
}

// --- Placeholder Generators ---

export function generateSimpleSolo(random: () => number): number[] {
    const shouldPlay = random() > 0.8;
    if (!shouldPlay) return [];
    
    return [getRandomNote(PENTATONIC_SCALE, 1, random)];
}

export function generateSimpleAccompaniment(random: () => number): number[] {
    const shouldPlay = random() > 0.5;
    if (!shouldPlay) return [];

    // Simple major chord
    const root = getRandomNote(PENTATONIC_SCALE, 0, random);
    return [root, root + 4, root + 7];
}

export function generateSimpleBass(random: () => number): number[] {
    const shouldPlay = random() > 0.2;
    if (!shouldPlay) return [];
    
    return [getRandomNote(PENTATONIC_SCALE, -1, random)];
}

// --- Simple Stable Drum Pattern ---

export type DrumStep = {
    sample: 'kick' | 'snare' | 'hat';
    time: number; // 0 to 1 (percentage of a beat)
};

const BEATS_PER_BAR = 4;
const BARS = 4;
export const TOTAL_BEATS = BEATS_PER_BAR * BARS;

// A simple, stable 4-bar pattern
export const drumPattern: DrumStep[][] = Array(TOTAL_BEATS).fill(null).map((_, beatIndex) => {
    const steps: DrumStep[] = [];
    
    // Kick on every beat
    steps.push({ sample: 'kick', time: 0 });

    // Snare on 2 and 4 of every bar
    if ((beatIndex + 1) % 2 === 0) {
        steps.push({ sample: 'snare', time: 0 });
    }

    // Hi-hat on every beat
    steps.push({ sample: 'hat', time: 0 });
    
    return steps;
});

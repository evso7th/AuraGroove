

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
    const shouldPlay = random() > 0.8;
    if (!shouldPlay) return [];
    return [getRandomNote(PENTATONIC_SCALE, 1, random)];
}

export function generateSimpleAccompaniment(random: () => number): number[] {
    const shouldPlay = random() > 0.6;
    if (!shouldPlay) return [];
    const root = getRandomNote(PENTATONIC_SCALE, 0, random);
    return [root, root + 4]; // simple interval
}

export function generateSimpleBass(random: () => number): number[] {
    const shouldPlay = random() > 0.5;
    if (!shouldPlay) return [];
    return [getRandomNote(PENTATONIC_SCALE, -1, random)];
}

// --- Drum Patterns ---

export type DrumStep = {
    sample: 'kick' | 'snare' | 'hat';
    time: number; // 0 to 1 (percentage of a beat)
};

const BEATS_PER_BAR = 4;
const BARS = 4;
export const TOTAL_BEATS_IN_PATTERN = BEATS_PER_BAR * BARS; // 16 beats

// Pattern A: Basic, sparse rhythm
export const drumPatternA: DrumStep[][] = Array(TOTAL_BEATS_IN_PATTERN).fill(null).map((_, beatIndex) => {
    const steps: DrumStep[] = [];
    const bar = Math.floor(beatIndex / BEATS_PER_BAR);
    const beatInBar = beatIndex % BEATS_PER_BAR;

    // Kick on the first beat of each bar
    if (beatInBar === 0) {
        steps.push({ sample: 'kick', time: 0 });
    }
    
    // Snare on the third beat of each bar (beat 2 in 0-indexed)
    if (beatInBar === 2) {
        steps.push({ sample: 'snare', time: 0 });
    }

    // Hi-hat on every beat
    steps.push({ sample: 'hat', time: 0 });
    
    return steps;
});

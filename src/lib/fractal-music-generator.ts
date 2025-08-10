
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
    const shouldPlay = random() > 0.9;
    if (!shouldPlay) return [];
    return [getRandomNote(PENTATONIC_SCALE, 1, random)];
}

export function generateSimpleAccompaniment(random: () => number): number[] {
    const shouldPlay = random() > 0.7;
    if (!shouldPlay) return [];
    const root = getRandomNote(PENTATONIC_SCALE, 0, random);
    return [root, root + 4, root + 7];
}

export function generateSimpleBass(random: () => number): number[] {
    const shouldPlay = random() > 0.5;
    if (!shouldPlay) return [];
    return [getRandomNote(PENTATONIC_SCALE, -1, random)];
}

// --- Drum Patterns ---

export type DrumStep = {
    sample: 'kick' | 'snare' | 'snare_ghost_note' | 'closed_hi_hat_ghost' | 'hat' | string; // Allow more sample types
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

// Pattern B: Slightly more complex, with ghost notes
export const drumPatternB: DrumStep[][] = Array(TOTAL_BEATS_IN_PATTERN).fill(null).map((_, beatIndex) => {
    const steps: DrumStep[] = [];
    const bar = Math.floor(beatIndex / BEATS_PER_BAR);
    const beatInBar = beatIndex % BEATS_PER_BAR;
    
    // Kick on beats 1 and 3
    if (beatInBar === 0 || beatInBar === 2) {
        steps.push({ sample: 'kick', time: 0 });
    }
    
    // Snare on beat 3
    if (beatInBar === 2) {
        steps.push({ sample: 'snare', time: 0 });
    }

    // Add a ghost snare on the last 16th note of beat 4 in the last bar
    if (bar === 3 && beatInBar === 3) {
        steps.push({ sample: 'snare_ghost_note', time: 0.75 });
    }

    // Hi-hats
    steps.push({ sample: 'hat', time: 0 });
    if (beatIndex % 2 !== 0) { // Add off-beat hats
        steps.push({ sample: 'closed_hi_hat_ghost', time: 0.5 });
    }
    
    return steps;
});

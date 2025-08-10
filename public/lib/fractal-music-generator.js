
// This file is designed to be imported by a Web Worker.
// It contains simple, safe, and computationally inexpensive functions
// to generate musical notes, ensuring the worker thread is never blocked.

/**
 * A simple pseudo-random number generator for deterministic sequences.
 * This ensures that the music is reproducible if needed, but still sounds random.
 * @param {number} seed - The initial seed for the generator.
 * @returns {() => number} A function that returns a new random number each time it's called.
 */
function lcg(seed) {
  return () => (seed = (seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}

// --- Basic Note Generation (Placeholders) ---

// Using C Major Pentatonic scale as a safe and pleasant-sounding default.
// Offsets from the root note C.
const PENTATONIC_SCALE = [0, 2, 4, 7, 9];

/**
 * Generates a single random MIDI note from a given scale and octave.
 * @param {number[]} scale - The scale to choose notes from (as MIDI offsets).
 * @param {number} octave - The octave for the note.
 * @param {() => number} random - The random number generator function.
 * @returns {number} A MIDI note number.
 */
function getRandomNote(scale, octave, random) {
    const noteIndex = Math.floor(random() * scale.length);
    // 60 is MIDI for C4 (Middle C)
    return 60 + octave * 12 + scale[noteIndex];
}

/**
 * Generates a note for the solo part. Very sparse to keep it ambient.
 * @param {() => number} random - The random number generator function.
 * @returns {number[]} An array containing a single note, or an empty array.
 */
function generateSimpleSolo(random) {
    // Only play a note 5% of the time.
    const shouldPlay = random() > 0.95;
    if (!shouldPlay) return [];
    return [getRandomNote(PENTATONIC_SCALE, 1, random)];
}

/**
 * Generates notes for the accompaniment part. Also sparse.
 * @param {() => number} random - The random number generator function.
 * @returns {number[]} An array containing a simple two-note interval, or an empty array.
 */
function generateSimpleAccompaniment(random) {
    // Only play notes 10% of the time.
    const shouldPlay = random() > 0.9;
    if (!shouldPlay) return [];
    const root = getRandomNote(PENTATONIC_SCALE, 0, random);
    // A simple, consonant interval (a major third).
    return [root, root + 4];
}

/**
 * Generates a note for the bass part.
 * @param {() => number} random - The random number generator function.
 * @returns {number[]} An array containing a single bass note, or an empty array.
 */
function generateSimpleBass(random) {
    // Play a bass note 20% of the time.
    const shouldPlay = random() > 0.8;
    if (!shouldPlay) return [];
    // Play in a lower octave.
    return [getRandomNote(PENTATONIC_SCALE, -1, random)];
}


// --- Drum Patterns ---

const BEATS_PER_BAR = 4;

// The simplest possible drum pattern. This is guaranteed not to have complex logic
// that could cause infinite loops or performance issues.
// This is an array of beats. Each beat is an array of drum steps.
const simpleDrumPattern = [
    // Beat 1
    [{ sample: 'kick', time: 0 }, { sample: 'hat', time: 0 }],
    // Beat 2
    [{ sample: 'hat', time: 0 }],
    // Beat 3
    [{ sample: 'snare', time: 0 }, { sample: 'hat', time: 0 }],
    // Beat 4
    [{ sample: 'hat', time: 0 }],
];

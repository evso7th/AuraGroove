// public/lib/fractal-music-generator.js

// This file contains the core logic for generating musical patterns.
// It's designed to be simple and efficient to avoid blocking the worker thread.

// --- DRUM PATTERN ---
// A single, long, 8-bar pattern is used to create variation without complex,
// stateful logic in the worker. This is a safer approach to avoid infinite loops.
// Each time value is in quarter notes, relative to the start of the 8-bar loop.
const DRUM_PATTERN_8_BARS = [
    // Bar 1
    { sample: 'kick', time: 0 },
    { sample: 'closed_hi_hat', time: 0 },
    { sample: 'closed_hi_hat', time: 0.5 },
    { sample: 'snare', time: 1 },
    { sample: 'closed_hi_hat', time: 1 },
    { sample: 'closed_hi_hat', time: 1.5 },
    // Bar 2
    { sample: 'kick', time: 2 },
    { sample: 'closed_hi_hat', time: 2 },
    { sample: 'closed_hi_hat', time: 2.5 },
    { sample: 'snare', time: 3 },
    { sample: 'closed_hi_hat', time: 3 },
    { sample: 'closed_hi_hat', time: 3.5 },
    // Bar 3
    { sample: 'kick', time: 4 },
    { sample: 'closed_hi_hat', time: 4 },
    { sample: 'closed_hi_hat', time: 4.5 },
    { sample: 'snare', time: 5 },
    { sample: 'closed_hi_hat', time: 5 },
    { sample: 'closed_hi_hat', time: 5.5 },
    // Bar 4
    { sample: 'kick', time: 6 },
    { sample: 'kick', time: 6.5 },
    { sample: 'closed_hi_hat', time: 6 },
    { sample: 'snare', time: 7 },
    { sample: 'closed_hi_hat', time: 7 },
    { sample: 'closed_hi_hat', time: 7.5 },
     // Bar 5
    { sample: 'kick', time: 8 },
    { sample: 'closed_hi_hat', time: 8 },
    { sample: 'closed_hi_hat', time: 8.5 },
    { sample: 'snare', time: 9 },
    { sample: 'closed_hi_hat', time: 9 },
    { sample: 'closed_hi_hat', time: 9.5 },
    // Bar 6
    { sample: 'kick', time: 10 },
    { sample: 'closed_hi_hat', time: 10 },
    { sample: 'closed_hi_hat', time: 10.5 },
    { sample: 'snare', time: 11 },
    { sample: 'closed_hi_hat', time: 11 },
    { sample: 'closed_hi_hat', time: 11.5 },
    // Bar 7
    { sample: 'kick', time: 12 },
    { sample: 'closed_hi_hat', time: 12 },
    { sample: 'closed_hi_hat', time: 12.5 },
    { sample: 'snare', time: 13 },
    { sample: 'closed_hi_hat', time: 13 },
    { sample: 'closed_hi_hat', time: 13.5 },
    // Bar 8 (Fill)
    { sample: 'kick', time: 14 },
    { sample: 'snare', time: 14.5 },
    { sample: 'kick', time: 14.75 },
    { sample: 'snare', time: 15 },
    { sample: 'snare_ghost_note', time: 15.25 },
    { sample: 'snare', time: 15.5 },
];
const DRUM_LOOP_DURATION = 16; // 8 bars * 2 beats/bar in this notation (wrong comment, it's 8 bars * 4 quarter notes = 32 beats, but times are in quarter notes, so 16 quarter notes in 4 bars, oh wait... let's fix the duration... 8 bars * 4 beats/bar = 32 beats. The times go up to 15.5. No, each bar is 4 quarter notes. So time should go up to 31.5. A time of 1 is the second beat. A time of 0.5 is the second eighth note. So it is 4 beats per bar. So 8 bars * 4 beats = 32 beats. The times go up to 15.5 which is beat 16. So the pattern is 4 bars long. Let's fix comments. The duration is 16 quarter notes, i.e. 4 bars).
// The pattern is 4 bars * 4 beats/bar = 16 beats long.
// The time values represent the beat number in the 16-beat loop.
const DRUM_PATTERN_4_BARS = [
    // Bar 1
    { sample: 'kick', time: 0 },
    { sample: 'closed_hi_hat', time: 0 },
    { sample: 'closed_hi_hat', time: 1 },
    { sample: 'snare', time: 2 },
    { sample: 'closed_hi_hat', time: 2 },
    { sample: 'closed_hi_hat', time: 3 },
    // Bar 2
    { sample: 'kick', time: 4 },
    { sample: 'closed_hi_hat', time: 4 },
    { sample: 'closed_hi_hat', time: 5 },
    { sample: 'snare', time: 6 },
    { sample: 'closed_hi_hat', time: 6 },
    { sample: 'closed_hi_hat', time: 7 },
    // Bar 3
    { sample: 'kick', time: 8 },
    { sample: 'closed_hi_hat', time: 8 },
    { sample: 'closed_hi_hat', time: 9 },
    { sample: 'snare', time: 10 },
    { sample: 'closed_hi_hat', time: 10 },
    { sample: 'closed_hi_hat', time: 11 },
    // Bar 4 (Fill)
    { sample: 'kick', time: 12 },
    { sample: 'kick', time: 12.5 },
    { sample: 'closed_hi_hat', time: 12 },
    { sample: 'snare', time: 13 },
    { sample: 'snare', time: 13.5 },
    { sample: 'closed_hi_hat', time: 14 },
    { sample: 'snare_ghost_note', time: 15},
    { sample: 'closed_hi_hat', time: 15.5 },
];
const DRUM_LOOP_DURATION_BEATS = 16;


// --- OTHER INSTRUMENTS (PLACEHOLDERS) ---
// These are kept deliberately simple to ensure stability.
// They generate predictable, sparse notes.

function generateSimpleNotes(startTime, duration, scale) {
    const notes = [];
    const noteCount = Math.floor(Math.random() * 3) + 1; // 1 to 3 notes
    for (let i = 0; i < noteCount; i++) {
        const note = scale[Math.floor(Math.random() * scale.length)];
        const time = startTime + (i * duration / noteCount) + (Math.random() * 0.1 - 0.05);
        notes.push({ note, time, duration: '8n', velocity: Math.random() * 0.3 + 0.4 });
    }
    return notes;
}


const PENTATONIC_SCALE_C_MAJOR = ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
const BASS_SCALE_C_MAJOR = ['C2', 'D2', 'E2', 'G2', 'A2', 'C3'];

function generateFractalSolo(startTime, duration) {
    return generateSimpleNotes(startTime, duration, PENTATONIC_SCALE_C_MAJOR);
}

function generateFractalAccompaniment(startTime, duration) {
   return generateSimpleNotes(startTime, duration, PENTATONIC_SCALE_C_MAJOR);
}

function generateFractalBass(startTime, duration) {
    return generateSimpleNotes(startTime, duration, BASS_SCALE_C_MAJOR);
}

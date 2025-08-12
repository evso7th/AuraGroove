
import type { DrumNote, BassNote, SoloNote, AccompanimentNote } from '@/types/music';

/**
 * "Promenade" - A musical score capturing a moment of generated music.
 * This score can be played back by the worker.
 */

export const promenadeScore: {
    drums: DrumNote[],
    bass: BassNote[],
    solo: SoloNote[],
    accompaniment: AccompanimentNote[],
} = {
    drums: [
        // Bar 1
        { sample: 'kick', time: 0 },
        { sample: 'hat', time: 0.5 },
        { sample: 'snare', time: 1 },
        { sample: 'hat', time: 1.5 },
        { sample: 'kick', time: 2 },
        { sample: 'hat', time: 2.5 },
        { sample: 'snare', time: 3 },
        { sample: 'hat', time: 3.5 },
        // Bar 2
        { sample: 'kick', time: 4 },
        { sample: 'hat', time: 4.5 },
        { sample: 'snare', time: 5 },
        { sample: 'hat', time: 5.5 },
        { sample: 'kick', time: 6 },
        { sample: 'hat', time: 6.5 },
        { sample: 'snare', time: 7 },
        { sample: 'hat', time: 7.5 },
        // Bar 3
        { sample: 'kick', time: 8 },
        { sample: 'hat', time: 8.5 },
        { sample: 'snare', time: 9 },
        { sample: 'hat', time: 9.5 },
        { sample: 'kick', time: 10 },
        { sample: 'hat', time: 10.5 },
        { sample: 'snare', time: 11 },
        { sample: 'hat', time: 11.5 },
        // Bar 4 (with crash)
        { sample: 'crash', time: 12, velocity: 0.8 },
        { sample: 'hat', time: 12.5 },
        { sample: 'snare', time: 13 },
        { sample: 'hat', time: 13.5 },
        { sample: 'kick', time: 14 },
        { sample: 'hat', time: 14.5 },
        { sample: 'snare', time: 15 },
        { sample: 'hat', time: 15.5 },
    ],
    bass: [
        // 4 bars of a simple E minor progression
        { note: 'E1', time: 0, duration: 4, velocity: 0.9 },
        { note: 'C1', time: 4, duration: 4, velocity: 0.85 },
        { note: 'G1', time: 8, duration: 4, velocity: 0.88 },
        { note: 'D1', time: 12, duration: 4, velocity: 0.86 },
    ],
    solo: [
        // A simple melodic phrase over 4 bars
        { notes: 'B3', duration: '8n', time: 0.5 },
        { notes: 'G3', duration: '8n', time: 1.5 },
        { notes: 'A3', duration: '4n', time: 2.5 },
        { notes: 'G3', duration: '8n', time: 4.5 },
        { notes: 'E3', duration: '8n', time: 5.5 },
        { notes: 'C3', duration: '4n', time: 6.5 },
        { notes: 'D3', duration: '2n', time: 8.5 },
        { notes: 'E3', duration: '8n', time: 12.5 },
        { notes: 'G3', duration: '8n', time: 13.5 },
        { notes: 'B3', duration: '4n', time: 14.5 },
    ],
    accompaniment: [
        // Chords for the progression
        { notes: ['E2', 'G2', 'B2'], duration: '1n', time: 0 },
        { notes: ['C2', 'E2', 'G2'], duration: '1n', time: 4 },
        { notes: ['G2', 'B2', 'D3'], duration: '1n', time: 8 },
        { notes: ['D2', 'F#2', 'A2'], duration: '1n', time: 12 },
    ]
};

    
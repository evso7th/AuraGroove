
import type * as Tone from 'tone';

export type BassNote = {
    note: string;
    time: number;
    duration: number;
    velocity: number;
}

export type SoloNote = {
    notes: string | string[];
    time: Tone.Unit.Time;
    duration: Tone.Unit.Time;
}

export type DrumNote = {
    sample: string;
    time: number; // time in beats from the start of the loop
    velocity?: number;
}

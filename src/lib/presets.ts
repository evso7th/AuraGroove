
import type { Note, MelodyInstrument } from "@/types/music";

const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|WebOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

type PresetParams = {
    type: 'noteOn';
    frequency: number;
    velocity: number;
    attack: number;
    release: number;
    portamento: number;
    filterCutoff: number;
    q: number;
    oscType: 'sine' | 'triangle' | 'sawtooth' | 'square' | 'fatsine';
} | null;

const PRESETS: Record<MelodyInstrument, Omit<PresetParams, 'type' | 'frequency' | 'velocity'>> = {
    none: {} as any, // Should not be used
    organ: {
        attack: 0.2,
        release: 1.0,
        portamento: 0,
        filterCutoff: 600,
        q: 0.7,
        oscType: 'triangle', // sine + лёгкая triangle => using triangle as a simple approximation
    },
    mellotron: {
        attack: 0.3,
        release: 1.5,
        portamento: 0.01, // For "pitch wobble"
        filterCutoff: 500,
        q: 0.5,
        oscType: 'fatsine', // "fatsine" can simulate the detuned/chorus effect
    },
    synth: {
        attack: 0.15,
        release: 1.0,
        portamento: 0.03,
        filterCutoff: 700,
        q: 1,
        oscType: 'triangle', // triangle (основа), sine (подложка) -> triangle is a good fit
    },
    theremin: {
        attack: 0.3,
        release: 1.5,
        portamento: 0.08, // Higher portamento for glide effect
        filterCutoff: 600,
        q: 0.6,
        oscType: 'sine',
    },
     portamento: { // Bass instrument
        attack: 0.1,
        release: isMobile() ? 2.0 : 4.0,
        portamento: 0.05,
        filterCutoff: 1000,
        q: 1,
        oscType: 'triangle'
    },
};


export const getPresetParams = (instrumentName: MelodyInstrument | 'portamento', note: Note): PresetParams => {
    let freq = 0;
    try {
        freq = 440 * Math.pow(2, (note.midi - 69) / 12);
    } catch(e) {
        console.error("Failed to calculate frequency for note:", note, e);
        return null;
    }

    if (isNaN(freq)) {
        console.error("Calculated frequency is NaN for note:", note);
        return null;
    }

    const preset = PRESETS[instrumentName];
    if (!preset) return null;

    return {
        type: 'noteOn',
        frequency: freq,
        velocity: note.velocity || 0.7,
        ...preset,
    };
};

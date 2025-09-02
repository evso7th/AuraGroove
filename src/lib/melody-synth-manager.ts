
import type { ToneJS, SynthNote, MelodyInstrument } from '@/types/music';

/**
 * Manages the melody synthesizers.
 * This version is updated to handle complex, layered presets like the "Pluck Lead".
 */
export class MelodySynthManager {
    private Tone: ToneJS;
    public channel: Tone.Channel;
    private presets: Record<string, any>;
    private activeInstrument: MelodyInstrument = 'synth';
    
    // Using a PolySynth to handle multiple overlapping notes from the score gracefully.
    private polySynth: any; 

    constructor(Tone: ToneJS, channel: Tone.Channel) {
        this.Tone = Tone;
        this.channel = channel;
        
        // Define presets for the synths
        this.presets = {
             // This is a softer, richer version of the analog-style lead.
             // It uses a "fat" sawtooth wave to create a thick, chorus-like effect.
             // The filter is set lower and the envelope is less aggressive to avoid harshness.
            pluckLead: {
                oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
                envelope: { 
                    attack: 0.02, 
                    decay: 0.7, 
                    sustain: 0.7, 
                    release: 2.0,
                    releaseCurve: 'exponential' // This creates the "parabolic" falloff
                },
                filter: { type: 'lowpass', Q: 2, rolloff: -12 },
                filterEnvelope: { attack: 0.03, decay: 0.4, sustain: 0.5, release: 1.2, baseFrequency: 250, octaves: 3.4 }
            },
            // The 'synth' preset now maps to our new detailed sound
            synth: 'pluckLead' 
        };

        // Initialize the PolySynth. It can handle multiple voices.
        this.polySynth = new this.Tone.PolySynth(this.Tone.Synth, {
            maxPolyphony: 8,
        }).connect(this.channel);

        this.setInstrument('synth'); // Set default instrument
    }

    public setInstrument(name: MelodyInstrument) {
        this.activeInstrument = name;

        if (name === 'none') {
            this.stopAll();
            return;
        }

        let presetName = this.presets[name];
        // Handle aliases (like 'synth' pointing to 'pluckLead')
        if (typeof presetName === 'string') {
            presetName = this.presets[presetName];
        }

        if (presetName) {
            // Set the new options for all voices in the PolySynth
            this.polySynth.set(presetName);
        }
    }

    public schedule(score: SynthNote[], time: number) {
        if (this.activeInstrument === 'none' || score.length === 0) {
            return;
        }
        
        score.forEach(note => {
            const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
            const noteName = note.note as string | string[];
            const duration = this.Tone.Time(note.duration, 'n');
            
            // PolySynth handles multiple notes gracefully.
            this.polySynth.triggerAttackRelease(noteName, duration, scheduledTime, note.velocity);
        });
    }

    public stopAll() {
        this.polySynth?.releaseAll();
    }
}

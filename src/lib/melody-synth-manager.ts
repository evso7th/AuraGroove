
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
    
    // We now have two synths to create a layered sound.
    private synth1: any; 
    private synth2: any;

    constructor(Tone: ToneJS, channel: Tone.Channel) {
        this.Tone = Tone;
        this.channel = channel;
        
        // Define presets for the synths
        this.presets = {
            pluckLead: {
                synth1: { // Sawtooth Lead
                    oscillator: { type: 'sawtooth' },
                    envelope: { attack: 0.01, decay: 0.7, sustain: 0.7, release: 0.4 },
                    filter: { type: 'lowpass', Q: 1, rolloff: -12 },
                    filterEnvelope: { attack: 0.01, decay: 0.7, sustain: 0.1, release: 0.8, baseFrequency: 300, octaves: 4 }
                },
                synth2: { // Square Sub-Oscillator
                    oscillator: { type: 'square' },
                    envelope: { attack: 0.01, decay: 0.7, sustain: 0.7, release: 0.4 },
                    volume: -10 // Quieter than the lead
                }
            },
            // The 'synth' preset now maps to our new detailed sound
            synth: 'pluckLead' 
        };

        // Initialize placeholder synths. They will be configured by setInstrument.
        this.synth1 = new this.Tone.Synth().connect(this.channel);
        this.synth2 = new this.Tone.Synth().connect(this.channel);

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
            this.synth1.set(presetName.synth1);
            if (presetName.synth2) {
                this.synth2.set(presetName.synth2);
            } else {
                // If the new preset doesn't have a second layer, silence the old one
                this.synth2.set({ volume: -Infinity });
            }
        }
    }

    public schedule(score: SynthNote[], time: number) {
        if (this.activeInstrument === 'none' || score.length === 0) {
            return;
        }
        
        const presetName = this.presets[this.activeInstrument];
        const hasSecondLayer = typeof presetName === 'object' && presetName.synth2;

        score.forEach(note => {
            const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
            const noteName = note.note as string;
            const duration = this.Tone.Time(note.duration, 'n');
            
            // Trigger the main synth
            this.synth1.triggerAttackRelease(noteName, duration, scheduledTime, note.velocity);

            // Trigger the second layer if it exists for the current preset
            if (hasSecondLayer) {
                const subOctaveNote = this.Tone.Frequency(noteName).transpose(-12).toNote();
                this.synth2.triggerAttackRelease(subOctaveNote, duration, scheduledTime, note.velocity);
            }
        });
    }

    public stopAll() {
        this.synth1?.releaseAll();
        this.synth2?.releaseAll();
    }
}

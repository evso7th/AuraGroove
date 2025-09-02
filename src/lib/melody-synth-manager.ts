
import type { ToneJS, SynthNote, MelodyInstrument } from '@/types/music';

/**
 * Manages the melody synthesizers.
 * This version is updated to handle complex, layered presets.
 */
export class MelodySynthManager {
    private Tone: ToneJS;
    public channel: Tone.Channel;
    private presets: Record<string, any>;
    private activeInstrument: MelodyInstrument = 'synth';
    
    private polySynth: any; 

    constructor(Tone: ToneJS, channel: Tone.Channel) {
        this.Tone = Tone;
        this.channel = channel;
        
        this.presets = {
            pluckLead: {
                oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
                envelope: { 
                    attack: 0.08, 
                    decay: 0.7, 
                    sustain: 0.7, 
                    release: 2.0,
                    releaseCurve: 'exponential'
                },
                filter: { type: 'lowpass', Q: 2, rolloff: -12 },
                filterEnvelope: { attack: 0.03, decay: 0.4, sustain: 0.5, release: 1.2, baseFrequency: 250, octaves: 3.4 }
            },
            reversedString: {
                oscillator: {
                    type: 'fatsawtooth',
                    count: 3,
                    spread: 30
                },
                envelope: {
                    attack: 0.05,
                    decay: 1.5,
                    sustain: 0, // Percussive envelope
                    release: 0.8
                },
                filter: {
                    type: 'lowpass',
                    Q: 2,
                    rolloff: -12
                },
                filterEnvelope: {
                    attack: 1.2, // Slow filter attack
                    decay: 0.1,
                    sustain: 1,
                    release: 0.5,
                    baseFrequency: 150, // Start dark
                    octaves: 4, // End bright
                    exponent: 2
                }
            },
            synth: 'pluckLead' 
        };

        this.polySynth = new this.Tone.PolySynth(this.Tone.Synth, {
            maxPolyphony: 8,
        }).connect(this.channel);

        this.setInstrument('synth');
    }

    public setInstrument(name: MelodyInstrument) {
        this.activeInstrument = name;

        if (name === 'none') {
            this.stopAll();
            return;
        }

        let presetNameOrObject = this.presets[name];
        if (typeof presetNameOrObject === 'string') {
            presetNameOrObject = this.presets[presetNameOrObject];
        }

        if (presetNameOrObject) {
            this.polySynth.set(presetNameOrObject);
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
            
            this.polySynth.triggerAttackRelease(noteName, duration, scheduledTime, note.velocity);
        });
    }

    public stopAll() {
        this.polySynth?.releaseAll();
    }
}

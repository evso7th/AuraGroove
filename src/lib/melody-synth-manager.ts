
import type { ToneJS, SynthNote, MelodyInstrument } from '@/types/music';

/**
 * A simplified manager for a single melody synth.
 * This is designed to be a clean slate for building a new sound.
 */
export class MelodySynthManager {
    private Tone: ToneJS;
    private channel: Tone.Channel;
    private synth: any; // A single Tone.MonoSynth
    private activeInstrument: MelodyInstrument = 'synth';
    private presets: Record<Exclude<MelodyInstrument, 'none'>, any>;


    constructor(Tone: ToneJS, channel: Tone.Channel) {
        this.Tone = Tone;
        this.channel = channel;
        
        this.presets = {
            synth: { oscillator: { type: 'fatsine', spread: 40, count: 4 }, envelope: { attack: 0.04, decay: 0.5, sustain: 0.8, release: 0.7 } },
        };

        this.synth = new this.Tone.MonoSynth().connect(this.channel);
        this.setInstrument('synth'); // Set default instrument
    }

    public setInstrument(name: MelodyInstrument) {
        this.activeInstrument = name;

        if (name === 'none') return;
        
        const preset = this.presets[name];
        if (preset) {
            this.synth.set(preset);
        }
    }

    public schedule(score: SynthNote[], time: number) {
        if (this.activeInstrument === 'none' || score.length === 0) {
            return;
        }

        score.forEach(note => {
            const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
            const noteName = note.note as string;
            const duration = this.Tone.Time(note.duration, 'n');
            
            this.synth.triggerAttackRelease(noteName, duration, scheduledTime, note.velocity);
        });
    }

    public stopAll() {
        this.synth?.releaseAll();
    }
}

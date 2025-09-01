
import type { ToneJS, SynthNote, MelodyInstrument } from '@/types/music';

/**
 * A manager for melody synths that handles portamento correctly.
 */
export class MelodySynthManager {
    private Tone: ToneJS;
    private channel: Tone.Channel;
    private synth: any; // A single Tone.MonoSynth
    private isPlaying = false;
    private activeInstrument: MelodyInstrument = 'synth';
    private presets: Record<MelodyInstrument, any>;


    constructor(Tone: ToneJS, channel: Tone.Channel) {
        this.Tone = Tone;
        this.channel = channel;
        
        this.presets = {
            synth: { oscillator: { type: 'fatsine', spread: 40, count: 4 }, envelope: { attack: 0.2, decay: 0.5, sustain: 0.8, release: 2.5 } },
            organ: { oscillator: { type: 'fatsawtooth', count: 3, spread: 20 }, envelope: { attack: 0.4, decay: 0.2, sustain: 0.7, release: 3.2 } },
            piano: { type: 'FMSynth', harmonicity: 3.01, modulationIndex: 14, envelope: { attack: 0.01, decay: 1.5, sustain: 0.1, release: 2.5 } },
            mellotron: { type: 'FMSynth', harmonicity: 2, modulationIndex: 0.8, envelope: { attack: 0.3, decay: 0.5, sustain: 0.4, release: 2.8 } },
            theremin: { oscillator: { type: 'sine' }, envelope: { attack: 0.1, decay: 0.1, sustain: 0.9, release: 0.8 } },
            none: {}, // Empty preset for 'none' case
        };

        this.synth = new this.Tone.MonoSynth({
             portamento: 0.1, 
        }).connect(this.channel);
        this.synth.volume.value = -9;
        this.setInstrument('synth'); // Set default instrument
    }

    public setInstrument(name: MelodyInstrument) {
        if(this.isPlaying) {
            this.synth.triggerRelease();
            this.isPlaying = false;
        }
        this.activeInstrument = name;

        if (name === 'none') return;
        
        const preset = this.presets[name];
        if (preset) {
            this.synth.set(preset);
        }
    }

    public schedule(score: SynthNote[], time: number) {
        if (this.activeInstrument === 'none') {
            if(this.isPlaying) {
                this.synth.triggerRelease(time);
                this.isPlaying = false;
            }
            return;
        }

        if (score.length === 0) {
            if (this.isPlaying) {
                this.synth.triggerRelease(time);
                this.isPlaying = false;
            }
            return;
        }

        score.forEach(note => {
            const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
            const noteName = note.note as string;

            // Portamento logic: use triggerAttack and setNote for continuous sound
            if (!this.isPlaying) {
                this.synth.triggerAttack(noteName, scheduledTime, note.velocity);
                this.isPlaying = true;
            } else {
                this.synth.setNote(noteName, scheduledTime);
            }
        });
    }

    public stopAll() {
        if (this.isPlaying) {
            this.synth?.triggerRelease();
            this.isPlaying = false;
        }
    }
}

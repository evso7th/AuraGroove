
import type { ToneJS, SynthNote } from '@/types/music';

export class BassSynthManager {
    private Tone: ToneJS;
    private synth: any;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.synth = new this.Tone.MonoSynth({
            oscillator: {
                type: 'fmsine'
            },
            envelope: {
                attack: 0.05,
                decay: 0.3,
                sustain: 0.4,
                release: 0.8
            },
            filterEnvelope: {
                attack: 0.06,
                decay: 0.2,
                sustain: 0.5,
                release: 2,
                baseFrequency: 200,
                octaves: 7,
            }
        }).toDestination();
    }

    public schedule(score: SynthNote[], time: number) {
        if (score.length === 0) return;

        score.forEach(note => {
            this.synth.triggerAttackRelease(
                note.note,
                this.Tone.Time(note.duration, 'n'),
                time + (note.time * this.Tone.Time('4n').toSeconds()),
                note.velocity
            );
        });
    }
}

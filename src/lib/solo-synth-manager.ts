
import type { ToneJS, SynthNote } from '@/types/music';

export class SoloSynthManager {
    private Tone: ToneJS;
    private synth: any; // Using 'any' to avoid complex Tone.js types in this context

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        // A basic polyphonic synth for solo parts.
        // It's less likely to cause issues than accompaniment chords.
        this.synth = new this.Tone.PolySynth(this.Tone.Synth, {
             envelope: {
                attack: 0.02,
                decay: 0.1,
                sustain: 0.3,
                release: 1
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

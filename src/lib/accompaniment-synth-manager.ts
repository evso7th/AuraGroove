
import type { ToneJS, SynthNote } from '@/types/music';

export class AccompanimentSynthManager {
    private Tone: ToneJS;
    private synth: any; 

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        // Using PolySynth for simplicity, as our new arpeggio logic avoids simultaneous attacks.
        this.synth = new this.Tone.PolySynth(this.Tone.Synth, {
            oscillator: {
                type: 'fatsine'
            },
            envelope: {
                attack: 0.1,
                decay: 0.2,
                sustain: 0.5,
                release: 1.2
            }
        }).toDestination();
         this.synth.volume.value = -6; // Lower volume for accompaniment
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

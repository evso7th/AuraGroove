
import type { ToneJS, SynthNote, MelodyInstrument } from '@/types/music';

/**
 * A manager for melody synths that handles portamento correctly.
 */
export class MelodySynthManager {
    private Tone: ToneJS;
    private synth: any; // A single Tone.MonoSynth
    private isPlaying = false;
    private activeInstrument: MelodyInstrument = 'portamento';


    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.synth = new this.Tone.MonoSynth({
             portamento: 0.2, 
            oscillator: { type: 'sine' },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.8, release: 1.5 },
        }).toDestination();
        this.synth.volume.value = -9;
    }

    public setInstrument(name: MelodyInstrument) {
        if(this.isPlaying) {
            this.synth.triggerRelease();
            this.isPlaying = false;
        }
        this.activeInstrument = name;
        // In a real scenario, we would change synth presets here.
        // For now, we use one synth for simplicity.
    }

    public schedule(score: SynthNote[], time: number) {
        console.log(`[MELODY MANAGER] Schedule called. Time: ${time}, Score:`, score);

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

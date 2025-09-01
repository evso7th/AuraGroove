
import type { ToneJS, SynthNote, MelodyInstrument } from '@/types/music';

/**
 * A simplified manager for our "Hurdy-Gurdy" test.
 * It controls a single, persistent MonoSynth.
 */
export class MelodySynthManager {
    private Tone: ToneJS;
    private synth: any; // A single Tone.MonoSynth

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        
        // Create one synth and keep it.
        this.synth = new this.Tone.MonoSynth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.8 },
        }).toDestination();
        this.synth.volume.value = -6; // A reasonable default volume
    }

    // The setInstrument method is now a no-op as we only have one sound.
    public setInstrument(name: MelodyInstrument) {
        // Does nothing in this simplified version.
    }

    public schedule(score: SynthNote[], time: number) {
        console.log(`[MELODY MANAGER] Schedule called. Time: ${time}, Score:`, score);

        if (score.length === 0) return;

        score.forEach(note => {
            const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
            // In Tone.js notation, '4n' (a quarter note) corresponds to a duration of 1 beat in a 4/4 signature.
            // We use 'n' notation to be explicit with Tone's transport time.
            const durationInNotation = `${note.duration}n`; 
            
            // Use the single, persistent synth to play the note.
            this.synth.triggerAttackRelease(note.note, durationInNotation, scheduledTime, note.velocity);
        });
    }

    public stopAll() {
        // Release any currently playing note.
        this.synth?.triggerRelease();
    }
}

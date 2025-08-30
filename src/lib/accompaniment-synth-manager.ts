
import type { SynthNote, ToneJS } from '@/types/music';

export class AccompanimentSynthManager {
    private synth: any; // Tone.PolySynth
    private Tone: ToneJS;

    constructor(tone: ToneJS, outputChannel: any) {
        this.Tone = tone;
        this.synth = new this.Tone.PolySynth(this.Tone.Synth, {
            oscillator: {
                type: 'fatsine4',
                spread: 40,
                count: 4,
            },
            envelope: {
                attack: 0.2,
                decay: 0.5,
                sustain: 0.8,
                release: 1.2,
            },
        }).connect(outputChannel);
    }
    
    public scheduleAccompaniment(score: SynthNote[], startTime: number) {
        console.log('[ACCOMP_TRACE] AccompanimentSynthManager received score:', score);
        if (!score || score.length === 0) return;

        score.forEach(note => {
            try {
                this.synth.triggerAttackRelease(note.note, note.duration, startTime + note.time, note.velocity);
            } catch(e) {
                console.error(`[ACCOMP_TRACE] Error scheduling accompaniment note ${note.note}. Error: ${e}`);
            }
        });
    }

    public setVolume(db: number) {
        this.synth.volume.value = db;
    }

    public stopAll() {
        this.synth.releaseAll();
    }
}

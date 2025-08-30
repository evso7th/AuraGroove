
import type { ToneJS, SynthNote } from '@/types/music';

// A placeholder manager for future special effects.
export class EffectsSynthManager {
    private Tone: ToneJS;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
    }

    public schedule(score: SynthNote[], time: number) {
        if (score.length === 0) return;
        
        // Future logic for handling effects will go here.
        // For now, it does nothing.
    }
}

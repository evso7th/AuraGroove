
import * as Tone from 'tone';
import type { FxBus } from './fx-bus';
import type { EffectNote } from '@/types/music';

/**
 * Manages the lifecycle and triggering of SFX synthesizers.
 */
export class EffectsSynthManager {
    private piuSynth: Tone.Synth;
    private bellSynth: Tone.MetalSynth;
    private fxBus: FxBus;

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;

        // Configure the "piu" synth
        this.piuSynth = new Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: {
                attack: 0.01,
                decay: 0.2,
                sustain: 0.1,
                release: 0.5,
            },
            volume: -10,
        }).connect(this.fxBus.effectsInput);
        this.piuSynth.envelope.attackCurve = 'exponential';

        // Configure the "bell" synth
        this.bellSynth = new Tone.MetalSynth({
            frequency: 250,
            envelope: {
                attack: 0.001,
                decay: 1.4,
                release: 0.2,
            },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5,
            volume: -15,
        }).connect(this.fxBus.effectsInput);
    }

    public trigger(effect: EffectNote, time: Tone.Unit.Time) {
        switch (effect.type) {
            case 'piu':
                // The "piu" sound is created with a fast pitch envelope
                this.piuSynth.triggerAttack(effect.note, time);
                this.piuSynth.frequency.rampTo(Tone.Frequency(effect.note).toFrequency() * 0.5, 0.2, time as number);
                this.piuSynth.triggerRelease(time as number + 0.3);
                break;
            case 'bell':
                this.bellSynth.triggerAttackRelease(effect.note, effect.duration || '8n', time);
                break;
        }
    }

    public dispose() {
        this.piuSynth.dispose();
        this.bellSynth.dispose();
    }
}

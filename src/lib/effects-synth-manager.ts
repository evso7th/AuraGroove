
import * as Tone from 'tone';
import type { FxBus } from './fx-bus';
import type { EffectNote, EffectsSettings } from '@/types/music';

type EffectMode = EffectsSettings['mode'];

const DEFAULT_BELL_ATTACK = 0.01;
const FIRST_NOTE_BELL_ATTACK = 0.2;

/**
 * Manages the lifecycle and triggering of SFX synthesizers.
 */
export class EffectsSynthManager {
    private piuSynth: Tone.Synth;
    private bellSynth: Tone.MetalSynth;
    private fxBus: FxBus;
    private currentMode: EffectMode = 'none';

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

        // Configure the "bell" synth for a "wind chime" sound
        this.bellSynth = new Tone.MetalSynth({
            frequency: 440,
            envelope: {
                attack: DEFAULT_BELL_ATTACK,
                decay: 1.4,
                release: 2.5, // Longer release for airiness
            },
            harmonicity: 8.5, // More complex, chime-like harmonics
            modulationIndex: 20,
            resonance: 3500, // Slightly less sharp resonance
            octaves: 1.5,
            volume: -18, // A bit quieter to blend in
        }).connect(this.fxBus.effectsInput);
    }
    
    public setMode(mode: EffectMode) {
        this.currentMode = mode;
    }

    public setVolume(volume: number) { // volume is linear 0-1
        if (this.currentMode === 'none' || volume < 0.01) {
            this.fxBus.effectsInput.volume.value = -Infinity;
        } else {
            const volumeInDb = Tone.gainToDb(volume);
            this.fxBus.effectsInput.volume.value = volumeInDb;
        }
    }

    public trigger(effect: EffectNote, time: Tone.Unit.Time) {
        if (this.currentMode === 'none') return;
        
        switch (effect.type) {
            case 'piu':
                 if (this.currentMode === 'piu' || this.currentMode === 'mixed') {
                    this.piuSynth.triggerAttack(effect.note, time);
                    this.piuSynth.frequency.rampTo(Tone.Frequency(effect.note).toFrequency() * 0.5, 0.2, time as number);
                    this.piuSynth.triggerRelease(time as number + 0.3);
                }
                break;
            case 'bell':
                if (this.currentMode === 'bell' || this.currentMode === 'mixed') {
                    // Specific logic for the first note of a chime sequence
                    if (effect.isFirst) {
                        this.bellSynth.envelope.attack = FIRST_NOTE_BELL_ATTACK;
                    }

                    this.bellSynth.triggerAttackRelease(effect.note, effect.duration || '2n', time);

                    // Reset attack to default for subsequent notes
                    if (effect.isFirst) {
                        // Schedule the reset shortly after the attack phase
                         this.bellSynth.envelope.attack = DEFAULT_BELL_ATTACK;
                    }
                }
                break;
        }
    }

    public dispose() {
        this.piuSynth.dispose();
        this.bellSynth.dispose();
    }
}

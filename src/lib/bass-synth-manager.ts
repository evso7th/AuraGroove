
import * as Tone from 'tone';
import type { Instruments } from '@/components/aura-groove';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['bass'];

/**
 * Manages the lifecycle of the bass instrument synthesizer.
 */
export class BassSynthManager {
    private currentSynth: Tone.MonoSynth | null = null;
    private currentInstrument: InstrumentName | null = null;
    private isSynthCreated = false;
    private fxBus: FxBus;

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
    }

    public setInstrument(name: InstrumentName) {
        if (name === this.currentInstrument && this.isSynthCreated) {
            return;
        }
        
        this.dispose(); 
        this.currentInstrument = name;

        if (name === 'none') {
            return;
        }

        this.currentSynth = this.createSynth(name);
        this.isSynthCreated = true;
    }

    private createSynth(name: InstrumentName): Tone.MonoSynth | null {
        switch (name) {
            case 'bass synth':
                return new Tone.MonoSynth({
                    oscillator: {
                        type: 'sine'
                    },
                    envelope: {
                        attack: 0.1,
                        decay: 0.3,
                        sustain: 0.4,
                        release: 1.5,
                    },
                    volume: 0, // Adjusted for better presence
                }).connect(this.fxBus.bassInput); // Connect to the correct mixer channel
            default:
                return null;
        }
    }
    
    public triggerAttackRelease(note: string, duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        if (this.currentSynth) {
            this.currentSynth.triggerAttackRelease(note, duration, time, velocity);
        }
    }

    public releaseAll() {
        if (this.currentSynth) {
            try {
                this.currentSynth.triggerRelease();
            } catch (e) {
                 // Ignore errors if the context is already closed
            }
        }
    }

    public dispose() {
        if (this.currentSynth) {
            this.currentSynth.dispose();
            this.currentSynth = null;
        }
        this.isSynthCreated = false;
    }
}


import * as Tone from 'tone';
import type { Instruments } from '@/components/aura-groove';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['accompaniment'];

/**
 * Manages the lifecycle of accompaniment instrument synthesizers.
 */
export class AccompanimentSynthManager {
    private currentSynth: Tone.PolySynth | null = null;
    private currentInstrument: InstrumentName = 'none';
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

        this.createSynth(name);
        this.isSynthCreated = true;
    }
    
    private createSynth(name: InstrumentName) {
        switch (name) {
            case 'organ':
                this.currentSynth = new Tone.PolySynth(Tone.Synth, {
                     polyphony: 4,
                     oscillator: {
                        type: 'sawtooth',
                    },
                    envelope: {
                        attack: 0.16,
                        decay: 0.15,
                        sustain: 0.9,
                        release: 0.4,
                    },
                     volume: -18,
                }).connect(this.fxBus.accompanimentInput); // Connect to the correct mixer channel
                break;
            default:
                this.currentSynth = null;
        }
    }
    
    public triggerAttackRelease(notes: string | string[], duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        if (this.currentSynth) {
            this.currentSynth.triggerAttackRelease(notes, duration, time, velocity);
        }
    }

    public releaseAll() {
        this.currentSynth?.releaseAll();
    }
    
    public fadeOut(duration: number) {
        if (this.currentSynth) {
            try {
                this.currentSynth.volume.rampTo(-Infinity, duration);
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

    

import * as Tone from 'tone';
import type { Instruments } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['solo'];
const DEFAULT_VOLUME = -9;

/**
 * Manages the lifecycle of solo instrument synthesizers.
 */
export class SoloSynthManager {
    private currentSynth: Tone.PolySynth | null = null;
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private readonly defaultVolume: number;

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
        this.defaultVolume = DEFAULT_VOLUME;
    }

    public setInstrument(name: InstrumentName) {
        if (name === this.currentInstrument && this.currentSynth) {
            if (this.currentSynth.volume.value === -Infinity) {
                this.fadeIn(0.1);
            }
            return;
        }

        this.dispose(); 
        this.currentInstrument = name;

        if (name === 'none') {
            return;
        }

        this.createSynth(name);
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
                     volume: this.defaultVolume,
                 }).connect(this.fxBus.soloInput);
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
            } catch(e) {
                // Ignore error if context is already closed
            }
        }
    }

    public fadeIn(duration: number) {
        if (this.currentSynth) {
            try {
                this.currentSynth.volume.rampTo(this.defaultVolume, duration);
            } catch (e) {
                // Ignore errors if context is already closed
            }
        }
    }

    public dispose() {
        if (this.currentSynth) {
            this.currentSynth.dispose();
            this.currentSynth = null;
        }
    }
}

    
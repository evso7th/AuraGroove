
import * as Tone from 'tone';
import type { Instruments } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['bass'];
const DEFAULT_VOLUME = 0;

/**
 * Manages the lifecycle of the bass instrument synthesizer.
 */
export class BassSynthManager {
    private currentSynth: Tone.MonoSynth | null = null;
    private currentInstrument: InstrumentName | null = null;
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

        this.currentSynth = this.createSynth(name);
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
                    volume: this.defaultVolume,
                }).connect(this.fxBus.bassInput);
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
    
    public fadeOut(duration: number) {
        if (this.currentSynth) {
            try {
                this.currentSynth.volume.rampTo(-Infinity, duration);
            } catch (e) {
                // Ignore errors if the context is already closed
            }
        }
    }

    public fadeIn(duration: number) {
        if (this.currentSynth) {
            try {
                this.currentSynth.volume.rampTo(this.defaultVolume, duration);
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
    }
}

    
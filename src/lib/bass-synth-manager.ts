
import * as Tone from 'tone';
import type { Instruments } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['bass'];
const DEFAULT_VOLUME = 0;

const instrumentPresets: Record<Exclude<InstrumentName, 'none'>, Tone.MonoSynthOptions> = {
    'bass synth': {
        oscillator: {
            type: 'sine'
        },
        envelope: {
            attack: 0.1,
            decay: 0.3,
            sustain: 0.4,
            release: 1.5,
        },
    }
};

/**
 * Manages the lifecycle of the bass instrument synthesizer.
 * The synth is created lazily on first use and reconfigured on instrument change.
 */
export class BassSynthManager {
    private currentSynth: Tone.MonoSynth | null = null;
    private isInitialized = false;
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private readonly defaultVolume: number;

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
        this.defaultVolume = DEFAULT_VOLUME;
    }

    private initializeSynth() {
        if (this.isInitialized) return;
        
        console.log("BASS: Lazily creating MonoSynth.");
        this.currentSynth = new Tone.MonoSynth({ volume: -Infinity }).connect(this.fxBus.bassInput);
        this.isInitialized = true;
    }

    public setInstrument(name: InstrumentName) {
        this.initializeSynth();
        if (!this.currentSynth) return;

        if (name === 'none') {
            this.fadeOut(0.1);
            this.currentInstrument = 'none';
            return;
        }

        if (name === this.currentInstrument) {
            if (this.currentSynth.volume.value === -Infinity) {
                this.fadeIn(0.1);
            }
            return;
        }
        
        console.log(`BASS: Setting instrument to ${name}`);
        const preset = instrumentPresets[name];
        this.currentSynth.set(preset);
        this.fadeIn(0.01);

        this.currentInstrument = name;
    }
    
    public triggerAttackRelease(note: string, duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        if (this.currentSynth && this.currentInstrument !== 'none') {
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
        if (this.currentSynth && this.currentInstrument !== 'none') {
            try {
                this.currentSynth.volume.rampTo(this.defaultVolume, duration);
            } catch (e) {
                // Ignore errors if the context is already closed
            }
        }
    }

    public dispose() {
        if (this.currentSynth) {
            console.log("BASS: Disposing MonoSynth.");
            this.currentSynth.dispose();
            this.currentSynth = null;
            this.isInitialized = false;
        }
    }
}

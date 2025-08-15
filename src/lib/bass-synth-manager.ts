
import * as Tone from 'tone';
import type { Instruments } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['bass'];
const DEFAULT_VOLUME = -6;

const instrumentPresets: Record<Exclude<InstrumentName, 'none'>, Tone.MonoSynthOptions> = {
    'bass synth': {
        oscillator: {
            type: 'sawtooth'
        },
        filter: {
            type: 'lowpass',
            rolloff: -24,
        },
        filterEnvelope: {
            attack: 0.04,
            decay: 0.2,
            sustain: 0.5,
            release: 0.8,
            baseFrequency: 40,
            octaves: 2.5,
        },
        envelope: {
            attack: 0.04,
            decay: 0.5,
            sustain: 0.8,
            release: 0.7,
        },
        portamento: 0.5,
    }
};

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

    private ensureSynthInitialized() {
        if (this.isInitialized) return;
        
        console.log("BASS: Lazily creating MonoSynth.");
        this.currentSynth = new Tone.MonoSynth({ volume: -Infinity }).connect(this.fxBus.bassInput);
        this.isInitialized = true;
    }

    public setInstrument(name: InstrumentName) {
        this.ensureSynthInitialized();
        if (!this.currentSynth) return;

        if (name === 'none') {
            this.fadeOut(0.1);
            this.currentInstrument = 'none';
            return;
        }

        if (name === this.currentInstrument) return;
        
        console.log(`BASS: Setting instrument to ${name}`);
        const preset = instrumentPresets[name];
        this.currentSynth.set(preset);
        this.fadeIn(0.01);
        this.currentInstrument = name;
    }
    
    public triggerAttackRelease(note: string, duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        this.ensureSynthInitialized();
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


import * as Tone from 'tone';
import type { Instruments } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['accompaniment'];

const DEFAULT_VOLUME = -12;
let instanceCounter = 0;

/**
 * Manages the lifecycle of accompaniment instrument synthesizers.
 */
export class AccompanimentSynthManager {
    private currentSynth: Tone.PolySynth | null = null;
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private readonly defaultVolume: number;
    private instanceId: number;


    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
        this.defaultVolume = DEFAULT_VOLUME;
        this.instanceId = ++instanceCounter;
        console.log(`[AccompManager] CONSTRUCTOR: New instance created, ID: ${this.instanceId}`);
    }

    public setInstrument(name: InstrumentName) {
        if (name === this.currentInstrument && this.currentSynth) {
            // If the synth exists but might be silenced, "wake it up"
            if (this.currentSynth.volume.value === -Infinity) {
                this.fadeIn(0.1);
            }
            return;
        }

        this.dispose(); 
        this.currentInstrument = name;

        if (name === 'none') {
            console.log(`[AccompManager ID: ${this.instanceId}] setInstrument: Instrument set to 'none'.`);
            return;
        }

        this.createSynth(name);
    }
    
    private createSynth(name: InstrumentName) {
        console.log(`[AccompManager ID: ${this.instanceId}] CREATE_SYNTH: Creating new PolySynth for instrument: ${name}`);
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
                }).connect(this.fxBus.accompanimentInput);
                break;
            default:
                this.currentSynth = null;
        }
    }
    
    public triggerAttackRelease(notes: string | string[], duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        if (this.currentSynth) {
            const noteCount = Array.isArray(notes) ? notes.length : 1;
            console.log(`[AccompManager ID: ${this.instanceId}] triggerAttackRelease: Received ${noteCount} notes to play.`, { notes, time });
            this.currentSynth.triggerAttackRelease(notes, duration, time, velocity);
        }
    }

    public releaseAll() {
        this.currentSynth?.releaseAll();
    }
    
    public fadeOut(duration: number) {
        if (this.currentSynth) {
            console.log(`[AccompManager ID: ${this.instanceId}] fadeOut: Fading out over ${duration}s.`);
            try {
                this.currentSynth.volume.rampTo(-Infinity, duration);
            } catch (e) {
                // Ignore errors if the context is already closed
            }
        }
    }
    
    public fadeIn(duration: number) {
        if (this.currentSynth) {
            console.log(`[AccompManager ID: ${this.instanceId}] fadeIn: Fading in over ${duration}s to ${this.defaultVolume}dB.`);
            try {
                this.currentSynth.volume.rampTo(this.defaultVolume, duration);
            } catch (e) {
                // Ignore errors if the context is already closed
            }
        }
    }

    public dispose() {
        if (this.currentSynth) {
            console.log(`[AccompManager ID: ${this.instanceId}] DISPOSE: Disposing of current synth.`);
            this.currentSynth.dispose();
            this.currentSynth = null;
        }
    }
}

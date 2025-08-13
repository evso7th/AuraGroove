
import * as Tone from 'tone';
import type { Instruments } from '@/components/aura-groove';

type InstrumentName = Instruments['bass'];

/**
 * Manages the lifecycle of the bass instrument synthesizer.
 * This class ensures that synths are created, configured, and disposed of correctly,
 * preventing memory leaks and audio glitches.
 */
export class BassSynthManager {
    private currentSynth: Tone.MonoSynth | null = null;
    private currentInstrument: InstrumentName | null = null;

    constructor() {}

    /**
     * Sets the active bass instrument. If the instrument is different from the current one,
     * it disposes of the old synth and creates a new one.
     * @param name The name of the instrument to activate.
     */
    public setInstrument(name: InstrumentName) {
        if (name === this.currentInstrument && this.currentSynth) {
            return;
        }
        
        this.dispose(); 
        this.currentInstrument = name;

        if (name === 'none') {
            return;
        }

        this.currentSynth = this.createSynth(name);
    }

    /**
     * Creates a synth instance based on the instrument name.
     * @param name The name of the instrument.
     * @returns A Tone.MonoSynth instance or null if the name is not recognized.
     */
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
                    volume: 4,
                }).toDestination();
            default:
                return null;
        }
    }
    
    public triggerAttackRelease(note: string, duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        if (this.currentSynth) {
            this.currentSynth.triggerAttackRelease(note, duration, time, velocity);
        }
    }

    /**
     * Releases all currently playing notes on the active synth.
     * Essential for stopping sound immediately.
     */
    public releaseAll() {
        if (this.currentSynth) {
            try {
                this.currentSynth.triggerRelease();
            } catch (e) {
                 // Ignore errors if the context is already closed
            }
        }
    }

    /**
     * Disposes of the current synth to free up resources.
     * This is crucial for preventing memory leaks when switching instruments or stopping playback.
     */
    public dispose() {
        if (this.currentSynth) {
            this.currentSynth.dispose();
            this.currentSynth = null;
        }
        this.currentInstrument = null;
    }
}

    
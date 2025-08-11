
import * as Tone from 'tone';
import type { Instruments } from '@/components/aura-groove';

type InstrumentName = Instruments['solo'];

/**
 * Manages the lifecycle of solo instrument synthesizers.
 * This class ensures that synths are created, configured, and disposed of correctly,
 * preventing memory leaks and audio glitches.
 */
export class SoloSynthManager {
    private currentSynth: Tone.PolySynth | null = null;
    private currentInstrument: InstrumentName = 'none';

    constructor() {}

    /**
     * Sets the active solo instrument. If the instrument is different from the current one,
     * it disposes of the old synth and creates a new one.
     * @param name The name of the instrument to activate ('organ', 'none', etc.).
     */
    public setInstrument(name: InstrumentName) {
        if (name === this.currentInstrument) {
            return;
        }

        this.dispose(); // Clean up the previous synth
        this.currentInstrument = name;

        if (name === 'none') {
            return;
        }

        this.currentSynth = this.createSynth(name);
        if (this.currentSynth) {
            this.currentSynth.toDestination();
        }
    }

    /**
     * Creates a synth instance based on the instrument name.
     * @param name The name of the instrument.
     * @returns A Tone.PolySynth instance or null if the name is not recognized.
     */
    private createSynth(name: InstrumentName): Tone.PolySynth | null {
        switch (name) {
            case 'organ':
                return new Tone.PolySynth(Tone.Synth, {
                    oscillator: {
                        type: 'fmsquare',
                        modulationType: 'sine',
                        harmonicity: 0.5,
                        modulationIndex: 3.5,
                    },
                    envelope: {
                        attack: 0.01,
                        decay: 0.1,
                        sustain: 0.9,
                        release: 0.1,
                    },
                     volume: -12, // Organs can be loud, reduce volume
                });
            // Future instruments can be added here
            // case 'piano':
            //     return new Tone.PolySynth(...);
            default:
                return null;
        }
    }
    
    public triggerAttackRelease(notes: string | string[], duration: Tone.Unit.Time, time?: Tone.Unit.Time) {
        if (this.currentSynth) {
            this.currentSynth.triggerAttackRelease(notes, duration, time);
        }
    }

    /**
     * Releases all currently playing notes on the active synth.
     * Essential for stopping sound immediately.
     */
    public releaseAll() {
        this.currentSynth?.releaseAll();
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
    }
}

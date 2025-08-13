
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
    private distortion: Tone.Distortion | null = null;
    private tremolo: Tone.Tremolo | null = null;

    constructor() {}

    /**
     * Sets the active solo instrument. If the instrument is different from the current one,
     * it disposes of the old synth and creates a new one.
     * @param name The name of the instrument to activate ('organ', 'none', etc.).
     */
    public setInstrument(name: InstrumentName) {
        if (name === this.currentInstrument && this.currentSynth) {
            return;
        }

        this.dispose(); // Clean up the previous synth
        this.currentInstrument = name;

        if (name === 'none') {
            return;
        }

        this.currentSynth = this.createSynth(name);
    }
    
    public startEffects() {
       if (this.currentInstrument === 'organ' && !this.distortion) {
            this.distortion = new Tone.Distortion(0.05);
            this.tremolo = new Tone.Tremolo(2, 0.2).toDestination();
            this.currentSynth?.chain(this.distortion, this.tremolo);
            this.tremolo.start();
        }
    }
    
    public stopEffects() {
        if (this.tremolo) {
            this.tremolo.stop();
            this.tremolo.dispose();
            this.tremolo = null;
        }
        if (this.distortion) {
            this.distortion.dispose();
            this.distortion = null;
        }
    }


    /**
     * Creates a synth instance based on the instrument name.
     * @param name The name of the instrument.
     * @returns A Tone.PolySynth instance or null if the name is not recognized.
     */
    private createSynth(name: InstrumentName): Tone.PolySynth | null {
        let synth;
        switch (name) {
            case 'organ':
                synth = new Tone.PolySynth(Tone.Synth, {
                     oscillator: {
                        type: 'sawtooth',
                    },
                    envelope: {
                        attack: 0.16,
                        decay: 0.15,
                        sustain: 0.9,
                        release: 0.4,
                    },
                     volume: -15,
                });
                break;
            default:
                return null;
        }
        synth.toDestination();
        return synth;
    }
    
    public triggerAttackRelease(notes: string | string[], duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        if (this.currentSynth) {
            this.currentSynth.triggerAttackRelease(notes, duration, time, velocity);
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
        this.stopEffects();
        if (this.currentSynth) {
            this.currentSynth.dispose();
            this.currentSynth = null;
        }
        this.currentInstrument = 'none';
    }
}

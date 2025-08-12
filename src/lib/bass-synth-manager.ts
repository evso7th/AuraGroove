
import * as Tone from 'tone';
import type { Instruments } from '@/components/aura-groove';

type InstrumentName = Instruments['bass'];

/**
 * Manages the lifecycle of the bass instrument synthesizer.
 * This class ensures that synths are created, configured, and disposed of correctly,
 * preventing memory leaks and audio glitches.
 */
export class BassSynthManager {
    private currentSynth: Tone.PolySynth | null = null;
    private currentInstrument: InstrumentName | null = null; // Изменено для лучшего сброса

    constructor() {}

    /**
     * Sets the active bass instrument. If the instrument is different from the current one,
     * it disposes of the old synth and creates a new one.
     * @param name The name of the instrument to activate.
     */
    public setInstrument(name: InstrumentName) {
        console.log('BassSynthManager: setInstrument called with', name); // Добавьте эту строку
        this.dispose(); // Clean up the previous synth
        this.currentInstrument = name;

        if (name === 'none') {
            console.log('BassSynthManager: Instrument set to none, disposing.'); // Добавьте эту строку
            return;
        }

        this.currentSynth = this.createSynth(name);
        if (this.currentSynth) {
            console.log('BassSynthManager: Synth created and connected to destination.'); // Добавьте эту строку
            this.currentSynth.toDestination();
        } else {
             console.log('BassSynthManager: Failed to create synth for', name); // Добавьте эту строку
        }
    }

    /**
     * Creates a synth instance based on the instrument name.
     * @param name The name of the instrument.
     * @returns A Tone.PolySynth instance or null if the name is not recognized.
     */
    private createSynth(name: InstrumentName): Tone.PolySynth | null {
        switch (name) {
            case 'bass synth':
                return new Tone.PolySynth(Tone.Synth, {
                    oscillator: {
                        type: 'sawtooth', // Попробуйте 'sawtooth' или 'square'
                    },
                    envelope: {
                        attack: 0.01,
                        decay: 0.1,
                        sustain: 0.9,
                        release: 0.2,
                    },
                    volume: 3, // Увеличьте громкость для теста
                });
            default:
                return null;
        }
    }
    
    public triggerAttackRelease(notes: string | string[], duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        console.log('BassSynthManager: triggerAttackRelease called with', notes, duration, time, velocity); // Добавьте эту строку
        if (this.currentSynth) {
            this.currentSynth.triggerAttackRelease(notes, duration, time, velocity);
        } else {
             console.log('BassSynthManager: triggerAttackRelease called but currentSynth is null.'); // Добавьте эту строку
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

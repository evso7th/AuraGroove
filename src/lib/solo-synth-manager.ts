
import * as Tone from 'tone';
import type { Instruments } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['solo'];
const DEFAULT_VOLUME = -9;
const NUM_VOICES = 2; // 2 voices for solo instrument

/**
 * Manages the lifecycle of solo instrument synthesizers using a pool of mono synths.
 */
export class SoloSynthManager {
    private voices: Tone.Synth[] = [];
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private readonly defaultVolume: number;
    private nextVoiceIndex = 0;

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
        this.defaultVolume = DEFAULT_VOLUME;
    }

    private initializeVoices(name: InstrumentName) {
        this.disposeVoices();

        if (name === 'none') return;

        console.log(`SOLO: Creating pool of ${NUM_VOICES} voices for ${name}`);
        let synthOptions: Tone.SynthOptions;

        switch (name) {
            case 'organ':
                 synthOptions = {
                     oscillator: { type: 'sawtooth' },
                     envelope: {
                         attack: 0.16,
                         decay: 0.15,
                         sustain: 0.9,
                         release: 0.4,
                     },
                     volume: this.defaultVolume,
                 };
                 break;
            default:
                synthOptions = {
                     oscillator: { type: 'sine' },
                     envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.8 },
                     volume: this.defaultVolume,
                 };
        }

        this.voices = Array.from({ length: NUM_VOICES }, () => 
            new Tone.Synth(synthOptions).connect(this.fxBus.soloInput)
        );
    }


    public setInstrument(name: InstrumentName) {
        if (name === this.currentInstrument) {
            if (this.voices.length > 0 && this.voices[0].volume.value === -Infinity) {
                this.fadeIn(0.1);
            }
            return;
        }

        this.currentInstrument = name;
        this.initializeVoices(name);
    }
    
    public triggerAttackRelease(notes: string | string[], duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        if (!this.voices.length) return;

        const notesToPlay = Array.isArray(notes) ? notes : [notes];
        const scheduledTime = time || Tone.now();

        notesToPlay.forEach(note => {
            const voice = this.voices[this.nextVoiceIndex];
            voice.triggerAttack(note, scheduledTime, velocity);

            const releaseTime = scheduledTime + Tone.Time(duration).toSeconds();
            voice.triggerRelease(releaseTime);

            this.nextVoiceIndex = (this.nextVoiceIndex + 1) % this.voices.length;
        });
    }

    public releaseAll() {
        this.voices.forEach(voice => voice.triggerRelease());
    }

    private setVolume(volume: number, duration: number) {
        this.voices.forEach(voice => {
            try {
                voice.volume.rampTo(volume, duration);
            } catch (e) {
                 // Ignore error if context is already closed
            }
        });
    }

    public fadeOut(duration: number) {
        this.setVolume(-Infinity, duration);
    }

    public fadeIn(duration: number) {
        this.setVolume(this.defaultVolume, duration);
    }
    
    private disposeVoices() {
        if (this.voices.length > 0) {
            console.log("SOLO: Disposing all voices");
            this.voices.forEach(voice => voice.dispose());
            this.voices = [];
        }
    }

    public dispose() {
       this.disposeVoices();
    }
}

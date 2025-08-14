
import * as Tone from 'tone';
import type { Instruments } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['accompaniment'];

const DEFAULT_VOLUME = -12;
const NUM_VOICES = 4; // 4 voices for accompaniment chords

const instrumentPresets: Record<Exclude<InstrumentName, 'none'>, Tone.SynthOptions> = {
    'organ': {
        oscillator: { type: 'sawtooth' },
        envelope: {
            attack: 0.16,
            decay: 0.15,
            sustain: 0.9,
            release: 0.4,
        },
    },
    'synthesizer': {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 },
    },
    'piano': { // Example preset, as it's disabled in UI
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.8 },
    }
};

export class AccompanimentSynthManager {
    private voices: Tone.Synth[] = [];
    private isInitialized = false;
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private readonly defaultVolume: number;
    private nextVoiceIndex = 0;

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
        this.defaultVolume = DEFAULT_VOLUME;
    }

    private ensureSynthsInitialized() {
        if (this.isInitialized) return;
        
        console.log(`ACCOMPANIMENT: Lazily creating pool of ${NUM_VOICES} voices.`);
        this.voices = Array.from({ length: NUM_VOICES }, () => 
            new Tone.Synth({ volume: -Infinity }).connect(this.fxBus.accompanimentInput)
        );
        this.isInitialized = true;
    }

    public setInstrument(name: InstrumentName) {
        this.ensureSynthsInitialized();

        if (name === 'none') {
            this.fadeOut(0.1);
            this.currentInstrument = 'none';
            return;
        }
        
        if (name === this.currentInstrument) return;

        console.log(`ACCOMPANIMENT: Setting instrument to ${name}`);
        const preset = instrumentPresets[name];
        this.voices.forEach(voice => {
            voice.set(preset);
        });
        
        this.fadeIn(0.01);
        this.currentInstrument = name;
    }
    
    public triggerAttackRelease(notes: string | string[], duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        this.ensureSynthsInitialized();
        if (this.currentInstrument === 'none' || !this.voices.length) return;

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
        if (!this.isInitialized) return;
        this.voices.forEach(voice => voice.triggerRelease());
    }
    
    private setVolume(volume: number, duration: number) {
        if (!this.isInitialized) return;
        this.voices.forEach(voice => {
            try {
                voice.volume.rampTo(volume, duration);
            } catch (e) {
                // Ignore errors if context is closed
            }
        });
    }

    public fadeOut(duration: number) {
        this.setVolume(-Infinity, duration);
    }
    
    public fadeIn(duration: number) {
        if (this.currentInstrument !== 'none') {
            this.setVolume(this.defaultVolume, duration);
        }
    }
    
    public dispose() {
        if (this.voices.length > 0) {
            console.log("ACCOMPANIMENT: Disposing all voices");
            this.voices.forEach(voice => voice.dispose());
            this.voices = [];
            this.isInitialized = false;
        }
    }
}

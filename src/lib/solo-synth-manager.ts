
import * as Tone from 'tone';
import type { InstrumentSettings } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = InstrumentSettings['solo']['name'];

const MOBILE_VOLUME_DB = -8; // Base volume for all devices
const NUM_VOICES = 2; // 2 voices for solo instrument

const instrumentPresets: Record<Exclude<InstrumentName, 'none'>, Tone.SynthOptions> = {
    'organ': {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
        envelope: {
            attack: 0.2,
            decay: 0.4,
            sustain: 0.8,
            release: 1.5, // Safe release time
        },
    },
    'synthesizer': {
        oscillator: { type: 'fatsine', count: 4, spread: 40 },
        envelope: { 
            attack: 0.1, 
            decay: 0.5, 
            sustain: 0.7, 
            release: 1.0 // Safe release time
        },
    },
    'piano': { // Example preset, as it's disabled in UI
         oscillator: { type: 'sine' }, // Simplified
         envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.8 },
    }
};

export class SoloSynthManager {
    private voices: Tone.Synth[] = [];
    private isInitialized = false;
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private userVolume: number = 0.7; // Linear gain (0-1)
    private nextVoiceIndex = 0;

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
    }

    private ensureSynthsInitialized() {
        if (this.isInitialized) return;
        
        this.voices = Array.from({ length: NUM_VOICES }, () => 
            new Tone.Synth({ volume: MOBILE_VOLUME_DB }).connect(this.fxBus.soloInput)
        );
        this.isInitialized = true;
    }

    public setInstrument(name: InstrumentName) {
        this.ensureSynthsInitialized();

        if (name === 'none') {
            this.currentInstrument = 'none';
            this.fadeOut(0.01);
            return;
        }

        if (name === this.currentInstrument) return;

        const preset = instrumentPresets[name];
        this.voices.forEach(voice => {
            voice.set(preset);
        });

        this.currentInstrument = name;
        this.updateVolume();
        this.fadeIn(0.01);
    }
    
    public setVolume(volume: number) { // volume is linear 0-1
        this.userVolume = volume;
        this.updateVolume();
    }

    private updateVolume(rampTime: Tone.Unit.Time = 0.05) {
        if (!this.isInitialized || this.currentInstrument === 'none') return;
        
        const userVolumeDb = Tone.gainToDb(this.userVolume);
        const targetVolume = MOBILE_VOLUME_DB + userVolumeDb;
        
        this.voices.forEach(voice => {
            try {
                voice.volume.rampTo(targetVolume, rampTime);
            } catch (e) {
                // Ignore error if context is already closed
            }
        });
    }

    public triggerAttackRelease(notes: string | string[], duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
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

    public fadeOut(duration: number) {
        this.fxBus.soloInput.volume.rampTo(-Infinity, duration);
    }

    public fadeIn(duration: number) {
         if (this.currentInstrument !== 'none') {
            this.fxBus.soloInput.volume.rampTo(0, duration);
        }
    }
    
    public dispose() {
        if (this.voices.length > 0) {
            this.voices.forEach(voice => voice.dispose());
            this.voices = [];
            this.isInitialized = false;
        }
    }
}

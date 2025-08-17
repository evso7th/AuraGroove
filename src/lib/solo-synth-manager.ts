
import * as Tone from 'tone';
import type { InstrumentSettings } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = InstrumentSettings['solo']['name'];

const MOBILE_VOLUME_DB = -8; // Base volume for all devices
const NUM_VOICES = 2; // 2 voices for solo instrument

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
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.8 },
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
    private currentBaseVolumeDb: number;
    private userVolume: number = 0.7; // Linear gain (0-1)
    private nextVoiceIndex = 0;

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
        this.currentBaseVolumeDb = MOBILE_VOLUME_DB;
    }

    private ensureSynthsInitialized() {
        if (this.isInitialized) return;
        
        console.log(`SOLO: Lazily creating pool of ${NUM_VOICES} voices.`);
        this.voices = Array.from({ length: NUM_VOICES }, () => 
            new Tone.Synth({ volume: -Infinity }).connect(this.fxBus.soloInput)
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

        console.log(`SOLO: Setting instrument to ${name}`);
        const preset = instrumentPresets[name];
        this.voices.forEach(voice => {
            voice.set(preset);
        });

        this.fadeIn(0.01);
        this.currentInstrument = name;
    }
    
    public setVolume(volume: number) { // volume is linear 0-1
        this.userVolume = volume;
        this.updateVolume();
    }

    private updateVolume(rampTime: Tone.Unit.Time = 0.05) {
        if (!this.isInitialized || this.currentInstrument === 'none') return;
        
        const isAudible = this.voices.some(v => v.volume.value > -Infinity);
        if (!isAudible) return;

        const userVolumeDb = Tone.gainToDb(this.userVolume);
        const targetVolume = this.currentBaseVolumeDb + userVolumeDb;
        
        this.voices.forEach(voice => {
            try {
                voice.volume.rampTo(targetVolume, rampTime);
            } catch (e) {
                // Ignore error if context is already closed
            }
        });
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

    private rampAllVoices(volume: number, duration: number) {
        if (!this.isInitialized) return;
        this.voices.forEach(voice => {
            try {
                voice.volume.rampTo(volume, duration);
            } catch (e) {
                 // Ignore error if context is already closed
            }
        });
    }

    public fadeOut(duration: number) {
        this.rampAllVoices(-Infinity, duration);
    }

    public fadeIn(duration: number) {
         if (this.currentInstrument !== 'none') {
             const userVolumeDb = Tone.gainToDb(this.userVolume);
             const targetVolume = this.currentBaseVolumeDb + userVolumeDb;
            this.rampAllVoices(targetVolume, duration);
        }
    }
    
    public dispose() {
        if (this.voices.length > 0) {
            console.log("SOLO: Disposing all voices");
            this.voices.forEach(voice => voice.dispose());
            this.voices = [];
            this.isInitialized = false;
        }
    }
}

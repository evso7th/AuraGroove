
import * as Tone from 'tone';
import type { InstrumentSettings } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = InstrumentSettings['solo']['name'];

const MOBILE_VOLUME_DB = -8; // Base volume for all devices
const NUM_VOICES = 2; // 2 voices for solo instrument

const instrumentPresets: Record<Exclude<InstrumentName, 'none'>, Omit<Tone.SynthOptions, 'volume'>> = {
    'organ': {
        oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
        envelope: {
            attack: 0.2,
            decay: 0.4,
            sustain: 0.8,
            release: 1.5,
        },
    },
    'synthesizer': {
        oscillator: { type: 'fatsine', count: 4, spread: 40 },
        envelope: { 
            attack: 0.1, 
            decay: 0.5, 
            sustain: 0.7, 
            release: 1.0
        },
    },
    'piano': {
         oscillator: { type: 'sine' },
         envelope: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.8 },
    }
};

export class SoloSynthManager {
    private voices: Tone.Synth[] = [];
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private userVolume: number = 0.7; // Linear gain (0-1)
    private nextVoiceIndex = 0;

    constructor(fxBus: FxBus) {
        console.log("[SOLO_SYNTH_TRACE] Constructor called.");
        this.fxBus = fxBus;
        this.voices = Array.from({ length: NUM_VOICES }, (_, i) => {
            const voice = new Tone.Synth({ volume: -Infinity }).connect(this.fxBus.soloInput);
            return voice;
        });
    }

    public setInstrument(name: InstrumentName) {
        console.log(`[SOLO_SYNTH_TRACE] setInstrument called with: ${name}`);

        if (name === 'none') {
            this.currentInstrument = 'none';
            this.fadeOut(0.01);
            return;
        }

        if (name === this.currentInstrument) return;

        const preset = instrumentPresets[name];
        this.voices.forEach(voice => {
            voice.set(preset);
            voice.volume.value = MOBILE_VOLUME_DB;
        });

        this.currentInstrument = name;
        this.updateVolume();
        this.fadeIn(0.01);
    }
    
    public setVolume(volume: number) { // volume is linear 0-1
        console.log(`[SOLO_SYNTH_TRACE] setVolume called with: ${volume}`);
        this.userVolume = volume;
        this.updateVolume();
    }

    private updateVolume(rampTime: Tone.Unit.Time = 0.05) {
        if (this.currentInstrument === 'none') return;
        
        const userVolumeDb = Tone.gainToDb(this.userVolume);
        const targetVolume = MOBILE_VOLUME_DB + userVolumeDb;
        console.log(`[SOLO_SYNTH_TRACE] Ramping synth volume to ${targetVolume} dB.`);
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
            console.log(`[SOLO_SYNTH_TRACE] FINAL_LINK_CHECK: manager=Solo, instrument=${this.currentInstrument}, voiceVolume=${voice.volume.value}, notes=${note}, duration=${duration}, time=${scheduledTime}, velocity=${velocity}`);
            voice.triggerAttackRelease(note, duration, scheduledTime, velocity);
            this.nextVoiceIndex = (this.nextVoiceIndex + 1) % this.voices.length;
        });
    }

    public releaseAll() {
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
        }
    }
}

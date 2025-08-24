
import * as Tone from 'tone';
import type { InstrumentSettings } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = InstrumentSettings['bass']['name'];
const MOBILE_VOLUME_DB = -12;

const mobilePreset: Tone.MonoSynthOptions = {
    oscillator: {
        type: 'sawtooth' 
    },
    filter: {
        type: 'lowpass',
        rolloff: -12,
        Q: 3,
    },
    filterEnvelope: {
        attack: 0.4,
        decay: 0.3,
        sustain: 0.7,
        release: 1.0,
        baseFrequency: 300,
        octaves: 1.5,
    },
    envelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.9,
        release: 1.0,
    },
    portamento: 0.05,
};


const instrumentPresets: Record<Exclude<InstrumentName, 'none'>, Tone.MonoSynthOptions> = {
    'bass synth': mobilePreset,
    'bassGuitar': mobilePreset
};

export class BassSynthManager {
    private currentSynth: Tone.MonoSynth | null = null;
    private isInitialized = false;
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private userVolume: number = 0.9;

    constructor(fxBus: FxBus) {
        console.log('[BASS_SYNTH_TRACE] Constructor called.');
        this.fxBus = fxBus;
    }

    private ensureSynthInitialized() {
        if (this.isInitialized) return;
        
        this.currentSynth = new Tone.MonoSynth({ volume: MOBILE_VOLUME_DB }).connect(this.fxBus.bassInput);
        this.isInitialized = true;
    }

    public setInstrument(name: InstrumentName) {
        console.log(`[BASS_SYNTH_TRACE] setInstrument called with: ${name}`);
        this.ensureSynthInitialized();
        if (!this.currentSynth) return;

        if (name === 'none') {
            this.currentInstrument = 'none';
            this.fadeOut(0.01);
            return;
        }
        
        if (name !== this.currentInstrument) {
            this.currentSynth.set(instrumentPresets[name]);
        }
        this.currentInstrument = name; 
        this.updateVolume();
        this.fadeIn(0.01);
    }
    
    public setVolume(volume: number) {
        console.log(`[BASS_SYNTH_TRACE] setVolume called with: ${volume}`);
        this.userVolume = volume;
        this.updateVolume();
    }

    private updateVolume(rampTime: Tone.Unit.Time = 0.05) {
        if (!this.currentSynth || this.currentInstrument === 'none') return;
        
        const userVolumeDb = Tone.gainToDb(this.userVolume);
        const targetVolume = MOBILE_VOLUME_DB + userVolumeDb;
        try {
            this.currentSynth.volume.rampTo(targetVolume, rampTime);
        } catch (e) {
            // Ignore errors
        }
    }
    
    public triggerAttackRelease(note: string, duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        console.log(`[BASS_SYNTH_TRACE] triggerAttackRelease: note=${note}, duration=${duration}, time=${time}, velocity=${velocity}`);
        if (this.currentSynth && this.currentInstrument !== 'none') {
            this.currentSynth.triggerAttackRelease(note, duration, time, velocity);
        }
    }

    public releaseAll() {
        this.currentSynth?.triggerRelease();
    }
    
    public fadeOut(duration: number) {
        this.fxBus.bassInput.volume.rampTo(-Infinity, duration);
    }

    public fadeIn(duration: number) {
        if (this.currentInstrument !== 'none') {
           this.fxBus.bassInput.volume.rampTo(0, duration);
        }
    }

    public dispose() {
        if (this.currentSynth) {
            this.currentSynth.dispose();
            this.currentSynth = null;
            this.isInitialized = false;
        }
    }
}


import * as Tone from 'tone';
import type { InstrumentSettings, MixProfile } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = InstrumentSettings['bass']['name'];
const DESKTOP_VOLUME_DB = -14; 
const MOBILE_VOLUME_DB = -8; 

const desktopPreset: Tone.MonoSynthOptions = {
    oscillator: {
        type: 'sawtooth'
    },
    filter: {
        type: 'lowpass',
        rolloff: -24,
        Q: 1,
    },
    filterEnvelope: {
        attack: 0.1,
        decay: 0.3,
        sustain: 0.6,
        release: 4.5,
        baseFrequency: 50,
        octaves: 2.5,
    },
    envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 1.0,
        release: 4.0,
    },
    portamento: 0.08,
};

const mobilePreset: Tone.MonoSynthOptions = {
    oscillator: {
        type: 'sawtooth'
    },
    filter: {
        type: 'lowpass',
        rolloff: -24,
        Q: 1,
    },
    filterEnvelope: {
        attack: 0.1,
        decay: 0.4,
        sustain: 0.7,
        release: 1.5,
        baseFrequency: 50, // Increased from 40 for more presence
        octaves: 2.5, // Increased from 2.2 for more presence
    },
    envelope: {
        attack: 0.08,
        decay: 0.4,
        sustain: 0.9,
        release: 1.5,
    },
    portamento: 0.08,
};


export class BassSynthManager {
    private currentSynth: Tone.MonoSynth | null = null;
    private isInitialized = false;
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private currentBaseVolumeDb: number;
    private userVolume: number = 0.9; // Linear gain (0-1)
    private currentProfile: MixProfile = 'desktop';

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
        this.currentBaseVolumeDb = DESKTOP_VOLUME_DB;
    }

    private ensureSynthInitialized() {
        if (this.isInitialized) return;
        
        console.log("BASS: Lazily creating MonoSynth.");
        this.currentSynth = new Tone.MonoSynth({ volume: -Infinity }).connect(this.fxBus.bassInput);
        this.isInitialized = true;
    }

    public setInstrument(name: InstrumentName) {
        this.ensureSynthInitialized();
        if (!this.currentSynth) return;

        if (name === 'none') {
            this.fadeOut(0.1);
            this.currentInstrument = 'none';
            return;
        }

        if (name === this.currentInstrument) return;
        
        console.log(`BASS: Setting instrument to ${name}`);
        this.applyProfileSettings();
        this.fadeIn(0.01);
        this.currentInstrument = name;
    }

    public setMixProfile(profile: MixProfile) {
        this.currentProfile = profile;
        this.currentBaseVolumeDb = profile === 'mobile' ? MOBILE_VOLUME_DB : DESKTOP_VOLUME_DB;
        this.applyProfileSettings(); // Re-apply settings for the new profile
        this.updateVolume();
    }
    
    public setVolume(volume: number) { // volume is linear 0-1
        this.userVolume = volume;
        this.updateVolume();
    }

    private updateVolume(rampTime: Tone.Unit.Time = 0.05) {
        if (!this.currentSynth || this.currentInstrument === 'none') return;
        
        const isAudible = this.currentSynth.volume.value > -Infinity;
        if (!isAudible) return;
        
        // Convert user volume (0-1) to dB adjustment.
        const userVolumeDb = Tone.gainToDb(this.userVolume);
        const targetVolume = this.currentBaseVolumeDb + userVolumeDb;

        try {
            this.currentSynth.volume.rampTo(targetVolume, rampTime);
        } catch (e) {
            // Ignore error
        }
    }


    private applyProfileSettings() {
        if (!this.currentSynth) return;
        const preset = this.currentProfile === 'mobile' ? mobilePreset : desktopPreset;
        this.currentSynth.set(preset);
    }
    
    public triggerAttackRelease(note: string, duration: Tone.Unit.Time, time?: Tone.Unit.Time, velocity?: number) {
        this.ensureSynthInitialized();
        if (this.currentSynth && this.currentInstrument !== 'none') {
            this.currentSynth.triggerAttackRelease(note, duration, time, velocity);
        }
    }

    public releaseAll() {
        if (this.currentSynth) {
            try {
                this.currentSynth.triggerRelease();
            } catch (e) {
                 // Ignore errors if the context is already closed
            }
        }
    }
    
    public fadeOut(duration: number) {
        if (this.currentSynth) {
            try {
                this.currentSynth.volume.rampTo(-Infinity, duration);
            } catch (e) {
                // Ignore errors if the context is already closed
            }
        }
    }

    public fadeIn(duration: number) {
        if (this.currentSynth && this.currentInstrument !== 'none') {
           this.updateVolume(duration);
        }
    }

    public dispose() {
        if (this.currentSynth) {
            console.log("BASS: Disposing MonoSynth.");
            this.currentSynth.dispose();
            this.currentSynth = null;
            this.isInitialized = false;
        }
    }
}

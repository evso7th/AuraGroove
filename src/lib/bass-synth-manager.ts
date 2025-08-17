
import * as Tone from 'tone';
import type { InstrumentSettings, MixProfile } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = InstrumentSettings['bass']['name'];
const DESKTOP_VOLUME_DB = -14;
const MOBILE_VOLUME_DB = -8;

// Heavy "Iron Man" sound for Desktop - uses sawtooth for rich harmonics
// and a low-pass filter to keep it bassy and controlled.
const ironManPreset: Tone.MonoSynthOptions = {
    oscillator: {
        type: 'sawtooth'
    },
    filter: {
        type: 'lowpass',
        rolloff: -24,
        Q: 2, // A bit of resonance for character
    },
    filterEnvelope: {
        attack: 0.01,
        decay: 0.7,
        sustain: 0.5,
        release: 1.5,
        baseFrequency: 80, // Start low
        octaves: 2.5, // Sweep over a range to create movement
    },
    envelope: {
        attack: 0.02,
        decay: 0.4,
        sustain: 0.9,
        release: 1.5,
    },
    portamento: 0.08,
};

// Adapted sound for Mobile speakers - also uses sawtooth but filter is different
// to emphasize mid-range frequencies that are audible on small speakers.
const mobilePreset: Tone.MonoSynthOptions = {
    oscillator: {
        type: 'sawtooth' 
    },
    filter: {
        type: 'lowpass', // Still a lowpass...
        rolloff: -12,
        Q: 3,         // ...but with higher Q to create a resonant peak
    },
    filterEnvelope: {
        attack: 0.4,
        decay: 0.3,
        sustain: 0.7,
        release: 1.0,
        baseFrequency: 300, // Start higher to be in the audible mobile range
        octaves: 1.5,       // Less sweep to keep it focused
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
    'bass synth': ironManPreset,
    'bassGuitar': ironManPreset
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
        
        const wasNone = this.currentInstrument === 'none';
        this.currentInstrument = name; 
        
        this.applyProfileSettings();

        if (wasNone) {
            this.fadeIn(0.01);
        }
    }

    public setMixProfile(profile: MixProfile) {
        this.currentProfile = profile;
        this.currentBaseVolumeDb = profile === 'mobile' ? MOBILE_VOLUME_DB : DESKTOP_VOLUME_DB;
        if(this.currentInstrument !== 'none') {
            this.applyProfileSettings();
        }
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
        
        const userVolumeDb = Tone.gainToDb(this.userVolume);
        const targetVolume = this.currentBaseVolumeDb + userVolumeDb;

        try {
            this.currentSynth.volume.rampTo(targetVolume, rampTime);
        } catch (e) {
            // Ignore error
        }
    }


    private applyProfileSettings() {
        if (!this.currentSynth || this.currentInstrument === 'none') return;
        
        const preset = this.currentProfile === 'mobile' 
            ? mobilePreset 
            : ironManPreset; // Use the desktop preset as the base for the selected instrument
        
        console.log(`BASS: Applying ${this.currentProfile} preset.`);
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


import * as Tone from 'tone';
import type { Instruments, MixProfile } from '@/types/music';
import type { FxBus } from './fx-bus';

type InstrumentName = Instruments['bass'];
const DESKTOP_VOLUME = -11; // Quieter on desktop
const MOBILE_VOLUME = 2; // Louder to cut through mobile speakers

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
        release: 1,
        baseFrequency: 50,
        octaves: 2.5,
    },
    envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.9,
        release: 1.2,
    },
    portamento: 0.08,
};

const mobilePreset: Tone.MonoSynthOptions = {
    ...desktopPreset,
    // On mobile, we want a deeper, less "honky" sound.
    // We achieve this by lowering the filter's start and end points.
    filterEnvelope: {
        ...desktopPreset.filterEnvelope,
        baseFrequency: 40, // Lower base frequency for a deeper sound
        octaves: 2.2,      // Less filter sweep to keep it in the bass region
    },
};


export class BassSynthManager {
    private currentSynth: Tone.MonoSynth | null = null;
    private isInitialized = false;
    private currentInstrument: InstrumentName = 'none';
    private fxBus: FxBus;
    private currentVolume: number;
    private currentProfile: MixProfile = 'desktop';

    constructor(fxBus: FxBus) {
        this.fxBus = fxBus;
        this.currentVolume = DESKTOP_VOLUME;
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
        this.currentVolume = profile === 'mobile' ? MOBILE_VOLUME : DESKTOP_VOLUME;
        
        if (this.isInitialized && this.currentSynth && this.currentInstrument !== 'none') {
            console.log(`BASS: Applying ${profile} mix profile.`);
            this.applyProfileSettings();
            
            // If already playing, ramp to the new volume
            const isAudible = this.currentSynth.volume.value > -Infinity;
            if (isAudible) {
                this.currentSynth.volume.rampTo(this.currentVolume, 0.5);
            }
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
            try {
                this.currentSynth.volume.rampTo(this.currentVolume, duration);
            } catch (e) {
                // Ignore errors if the context is already closed
            }
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

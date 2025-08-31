

import type { ToneJS, SynthNote, AudioProfile } from '@/types/music';

type InstrumentName = 'synthesizer' | 'piano' | 'organ' | 'mellotron' | 'none';

/**
 * Manages a pool of monophonic synthesizers to play the accompaniment part.
 * This manager now supports audio profiles to deliver optimized presets for
 * desktop (high-quality with effects) and mobile (performant, no effects).
 */
export class AccompanimentSynthManager {
    private Tone: ToneJS;
    private synths: any[] = [];
    private readonly voiceCount = 4;
    private nextVoiceIndex = 0;
    private currentInstrument: InstrumentName;
    private activePresets: Record<string, any>;
    private profile: AudioProfile;

    private desktopPresets: Record<string, any>;
    private mobilePresets: Record<string, any>;

    constructor(Tone: ToneJS, profile: AudioProfile) {
        this.Tone = Tone;
        this.profile = profile;
        this.currentInstrument = 'synthesizer';
        
        this.desktopPresets = this.createDesktopPresets();
        this.mobilePresets = this.createMobilePresets();

        this.activePresets = this.profile === 'desktop' ? this.desktopPresets : this.mobilePresets;
        console.log(`[AccompanimentSynthManager] Initialized with '${this.profile}' profile.`);
        
        this.createSynthPool();
    }

    private createDesktopPresets() {
        const chorus = new this.Tone.Chorus(0.5, 3.5, 0.7).toDestination();
        return {
            'synthesizer': {
                type: 'FMSynth',
                options: {
                    harmonicity: 1.2,
                    envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 2.0 },
                    modulation: { type: 'sine' },
                },
                effects: [chorus]
            },
            'organ': {
                 type: 'MonoSynth',
                 options: {
                     oscillator: { type: 'fatsawtooth', count: 3 },
                     envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 2.0 }
                 },
                 effects: []
            },
            'piano': {
                type: 'FMSynth',
                options: {
                    harmonicity: 3.01,
                    modulationIndex: 14,
                    envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 1.5 },
                },
                effects: []
            },
            'mellotron': {
                 type: 'FMSynth',
                 options: {
                    harmonicity: 3,
                    modulationIndex: 0.5,
                    oscillator: { type: "sine" },
                    envelope: { attack: 0.2, decay: 0.2, sustain: 0.4, release: 1.8 },
                    modulation: { type: "sine" },
                    modulationEnvelope: { attack: 0.3, decay: 0.5, sustain: 0.1, release: 1.8 }
                },
                effects: []
            }
        };
    }

    private createMobilePresets() {
        return {
            'synthesizer': {
                type: 'MonoSynth', // Simpler synth for mobile
                options: {
                    oscillator: { type: 'fmsine' }, // Less complex oscillator
                    envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.2 } // Shorter release
                },
                effects: []
            },
            'organ': {
                 type: 'MonoSynth',
                 options: {
                     oscillator: { type: 'fatsawtooth', count: 3 },
                     envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 1.2 }
                 },
                 effects: []
            },
            'piano': {
                type: 'FMSynth',
                options: {
                    harmonicity: 3.01,
                    modulationIndex: 14,
                    envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 1.0 }, // Shorter release
                },
                effects: []
            },
            'mellotron': {
                 type: 'FMSynth',
                 options: {
                    harmonicity: 3,
                    modulationIndex: 0.5,
                    oscillator: { type: "sine" },
                    envelope: { attack: 0.2, decay: 0.2, sustain: 0.4, release: 1.2 },
                    modulation: { type: "sine" },
                    modulationEnvelope: { attack: 0.3, decay: 0.5, sustain: 0.1, release: 1.2 }
                },
                effects: []
            }
        };
    }

    private createSynthPool() {
        this.synths.forEach(synth => synth.dispose());
        this.synths = [];
        
        const preset = this.activePresets[this.currentInstrument];
        if (!preset) return;

        for (let i = 0; i < this.voiceCount; i++) {
             let synth;
             if (preset.type === 'FMSynth') {
                synth = new this.Tone.FMSynth(preset.options);
             } else {
                synth = new this.Tone.MonoSynth(preset.options);
             }
             
             if (preset.effects && preset.effects.length > 0) {
                 synth.chain(...preset.effects, this.Tone.Destination);
             } else {
                 synth.toDestination();
             }
             
             synth.volume.value = -9;
             this.synths.push(synth);
        }
    }

    public setInstrument(name: InstrumentName) {
        if (name === this.currentInstrument && name !== 'none') return;
        
        if (name === 'none') {
            this.stopAll();
            this.synths.forEach(synth => synth.dispose());
            this.synths = [];
        } else {
            this.currentInstrument = name;
            this.createSynthPool();
        }
    }

    public schedule(score: SynthNote[], time: number) {
        if (this.synths.length === 0 || score.length === 0) return;

        score.forEach(note => {
            const synth = this.synths[this.nextVoiceIndex];
            if (synth) {
                synth.triggerAttackRelease(
                    note.note,
                    this.Tone.Time(note.duration, 'n'),
                    time + (note.time * this.Tone.Time('4n').toSeconds()),
                    note.velocity
                );
            }
            this.nextVoiceIndex = (this.nextVoiceIndex + 1) % this.synths.length;
        });
    }

    public stopAll() {
        this.synths.forEach(synth => synth.triggerRelease());
    }
}


import type { ToneJS, SynthNote, AudioProfile } from '@/types/music';

type InstrumentName = 'synthesizer' | 'piano' | 'organ' | 'mellotron' | 'none';

/**
 * Manages two persistent monophonic synthesizers to play the accompaniment part,
 * simulating a "two-handed" player for continuous, contrapuntal melodic lines.
 */
export class AccompanimentSynthManager {
    private Tone: ToneJS;
    private synths: { leftHand?: any; rightHand?: any; } = {};
    private isLeftHandPlaying = false;
    private isRightHandPlaying = false;

    private currentInstrument: InstrumentName = 'synthesizer';
    private profile: AudioProfile;

    private desktopPresets: Record<string, any>;
    private mobilePresets: Record<string, any>;

    constructor(Tone: ToneJS, profile: AudioProfile) {
        this.Tone = Tone;
        this.profile = profile;
        
        this.desktopPresets = this.createDesktopPresets();
        this.mobilePresets = this.createMobilePresets();
        
        this.recreateSynths();
    }

    private createPreset(instrument: InstrumentName, profile: AudioProfile) {
        const presets = profile === 'desktop' ? this.desktopPresets : this.mobilePresets;
        return presets[instrument];
    }
    
    private createDesktopPresets() {
        const chorus = new this.Tone.Chorus(0.5, 3.5, 0.7).toDestination();
        return {
            'synthesizer': {
                type: 'FMSynth',
                options: {
                    portamento: 0.1,
                    harmonicity: 1.2,
                    envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 2.0 },
                    modulation: { type: 'sine' },
                },
                effects: [chorus]
            },
            'organ': {
                 type: 'MonoSynth',
                 options: {
                     portamento: 0.05,
                     oscillator: { type: 'fatsawtooth', count: 3 },
                     envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 2.0 }
                 },
                 effects: []
            },
            'piano': {
                type: 'FMSynth',
                options: {
                    portamento: 0.01,
                    harmonicity: 3.01,
                    modulationIndex: 14,
                    envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 1.5 },
                },
                effects: []
            },
            'mellotron': {
                 type: 'FMSynth',
                 options: {
                    portamento: 0.1,
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
                type: 'MonoSynth',
                options: {
                    portamento: 0.1,
                    oscillator: { type: 'fmsine' },
                    envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.2 }
                },
                effects: []
            },
            'organ': {
                 type: 'MonoSynth',
                 options: {
                     portamento: 0.05,
                     oscillator: { type: 'fatsawtooth', count: 3 },
                     envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 1.2 }
                 },
                 effects: []
            },
            'piano': {
                type: 'FMSynth',
                options: {
                    portamento: 0.01,
                    harmonicity: 3.01,
                    modulationIndex: 14,
                    envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 1.0 },
                },
                effects: []
            },
            'mellotron': {
                 type: 'FMSynth',
                 options: {
                    portamento: 0.1,
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

    private recreateSynths() {
        this.stopAll();
        Object.values(this.synths).forEach(synth => synth?.dispose());

        if (this.currentInstrument === 'none') {
            this.synths = {};
            return;
        }

        const preset = this.createPreset(this.currentInstrument, this.profile);
        if (!preset) return;
        
        ['leftHand', 'rightHand'].forEach(hand => {
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
            this.synths[hand as 'leftHand' | 'rightHand'] = synth;
        });
    }

    public setInstrument(name: InstrumentName) {
        if (name === this.currentInstrument) return;
        this.currentInstrument = name;
        this.recreateSynths();
    }
    
    private playHand(hand: 'leftHand' | 'rightHand', note: SynthNote, time: number) {
        const synth = this.synths[hand];
        const isPlayingFlag = hand === 'leftHand' ? 'isLeftHandPlaying' : 'isRightHandPlaying';
        if (!synth) return;

        const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());

        if (!this[isPlayingFlag]) {
            synth.triggerAttack(note.note, scheduledTime, note.velocity);
            this[isPlayingFlag] = true;
        } else {
            synth.setNote(note.note, scheduledTime);
        }
    }

    private releaseHand(hand: 'leftHand' | 'rightHand', time: number) {
        const synth = this.synths[hand];
        const isPlayingFlag = hand === 'leftHand' ? 'isLeftHandPlaying' : 'isRightHandPlaying';
        
        if (this[isPlayingFlag] && synth) {
            synth.triggerRelease(time);
            this[isPlayingFlag] = false;
        }
    }

    public schedule(score: SynthNote[], time: number) {
        if (this.currentInstrument === 'none' || Object.keys(this.synths).length === 0) {
            this.stopAll();
            return;
        };

        const rightHandNote = score[0];
        const leftHandNote = score[1];

        if (rightHandNote) {
            this.playHand('rightHand', rightHandNote, time);
        } else {
            this.releaseHand('rightHand', time);
        }

        if (leftHandNote) {
            this.playHand('leftHand', leftHandNote, time);
        } else {
            this.releaseHand('leftHand', time);
        }
    }

    public stopAll() {
        this.releaseHand('leftHand', this.Tone.now());
        this.releaseHand('rightHand', this.Tone.now());
    }
}


import type { ToneJS, SynthNote } from '@/types/music';

type BassInstrument = 'bassGuitar' | 'BassGroove' | 'portamento' | 'none';

export class BassSynthManager {
    private Tone: ToneJS;
    private synths: {
        bassGuitar?: any;
        bassGroove?: {
            fundamental: any;
            texture: any;
        };
        portamento?: any;
    } = {};
    private activeInstrument: BassInstrument = 'portamento';
    private isPortamentoPlaying = false;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.createPresets();
        this.setInstrument(this.activeInstrument);
    }

    private createPresets() {
        // Bass Guitar Preset
        this.synths.bassGuitar = new this.Tone.MonoSynth({
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7 }
        }).toDestination();
        this.synths.bassGuitar.volume.value = -3;

        // Portamento Preset with its own reverb for atmospheric decay
        const portamentoReverb = new this.Tone.Reverb({
            decay: 6, // Long decay for atmospheric feel
            wet: 0.4  // Mix of dry/wet signal
        }).toDestination();

        this.synths.portamento = new this.Tone.MonoSynth({
            portamento: 0.1, 
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 4.0 }, // Increased release
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 5.0, baseFrequency: 200, octaves: 7 } // Increased filter release
        }).connect(portamentoReverb);
        this.synths.portamento.volume.value = -3;


        // BassGroove Layered Preset
        const bassDrive = new this.Tone.Distortion(0.05).toDestination();
        const textureChorus = new this.Tone.Chorus(0.5, 3.5, 0.7).toDestination();
        
        const fundamentalSynth = new this.Tone.MonoSynth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.8, release: 0.8 }
        }).connect(bassDrive);
        fundamentalSynth.volume.value = -3;

        const textureSynth = new this.Tone.MonoSynth({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.08, decay: 0.4, sustain: 0.6, release: 0.8 }
        }).connect(textureChorus);
        textureSynth.volume.value = -12; // Quieter texture layer

        this.synths.bassGroove = {
            fundamental: fundamentalSynth,
            texture: textureSynth
        };
    }

    public setInstrument(name: BassInstrument) {
       if (this.activeInstrument === 'portamento' && name !== 'portamento' && this.isPortamentoPlaying) {
           this.synths.portamento?.triggerRelease();
           this.isPortamentoPlaying = false;
       }
       this.activeInstrument = name;
    }

    public schedule(score: SynthNote[], time: number) {
        if (this.activeInstrument === 'none') {
             if (this.isPortamentoPlaying) {
                this.synths.portamento?.triggerRelease(time);
                this.isPortamentoPlaying = false;
            }
            return;
        }

        if (score.length === 0) {
            if (this.activeInstrument === 'portamento' && this.isPortamentoPlaying) {
                this.synths.portamento?.triggerRelease(time);
                this.isPortamentoPlaying = false;
            }
            return;
        }

        score.forEach(note => {
            const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
            const duration = this.Tone.Time(note.duration, 'n');
            const velocity = note.velocity;
            const noteName = note.note;

            if (this.activeInstrument === 'portamento' && this.synths.portamento) {
                if (!this.isPortamentoPlaying) {
                    this.synths.portamento.triggerAttack(noteName, scheduledTime, velocity);
                    this.isPortamentoPlaying = true;
                } else {
                    this.synths.portamento.setNote(noteName, scheduledTime);
                }
            } else {
                 if (this.isPortamentoPlaying) {
                    this.synths.portamento?.triggerRelease(time);
                    this.isPortamentoPlaying = false;
                }
                if (this.activeInstrument === 'bassGuitar' && this.synths.bassGuitar) {
                    this.synths.bassGuitar.triggerAttackRelease(noteName, duration, scheduledTime, velocity);
                } else if (this.activeInstrument === 'BassGroove' && this.synths.bassGroove) {
                    this.synths.bassGroove.fundamental.triggerAttackRelease(noteName, duration, scheduledTime, velocity);
                    const textureNote = this.Tone.Frequency(noteName).transpose(12).toNote();
                    this.synths.bassGroove.texture.triggerAttackRelease(textureNote, duration, scheduledTime, velocity * 0.5);
                }
            }
        });
    }

    public stopAll() {
        if (this.isPortamentoPlaying) {
            this.synths.portamento?.triggerRelease();
            this.isPortamentoPlaying = false;
        }
        // These might not be playing, but calling triggerRelease is safe.
        this.synths.bassGuitar?.triggerRelease();
        this.synths.bassGroove?.fundamental.triggerRelease();
        this.synths.bassGroove?.texture.triggerRelease();
    }
}


import type { ToneJS, SynthNote } from '@/types/music';

type BassInstrument = 'bassGuitar' | 'BassGroove' | 'portamento' | 'portamentoMob' | 'BassGrooveMob' | 'none';

export class BassSynthManager {
    private Tone: ToneJS;
    private synths: {
        bassGuitar?: any;
        bassGroove?: {
            fundamental: any;
            texture: any;
        };
        bassGrooveMob?: {
            fundamental: any;
            texture: any;
        };
        portamento?: any;
        portamentoMob?: any;
    } = {};
    private activeInstrument: BassInstrument = 'portamento';
    private isPortamentoPlaying = false;
    private isPortamentoMobPlaying = false;

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
        
        // PortamentoMob Preset - without reverb for performance
        this.synths.portamentoMob = new this.Tone.MonoSynth({
            portamento: 0.1, 
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 4.0 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 5.0, baseFrequency: 200, octaves: 7 }
        }).toDestination();
        this.synths.portamentoMob.volume.value = -3;


        // BassGroove Layered Preset
        const bassDrive = new this.Tone.Distortion(0.05).toDestination();
        const textureChorus = new this.Tone.Chorus(0.5, 3.5, 0.7).toDestination();
        const bassGrooveReverb = new this.Tone.Reverb({
            decay: 4,
            wet: 0.3
        }).connect(bassDrive);
        
        const fundamentalSynth = new this.Tone.MonoSynth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.8, release: 4.0 }
        }).connect(bassGrooveReverb);
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
        
        // BassGrooveMob - Now without effects
        const fundamentalSynthMob = new this.Tone.MonoSynth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.8, release: 1.6 }
        }).toDestination();
        fundamentalSynthMob.volume.value = -3;

        const textureSynthMob = new this.Tone.MonoSynth({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.08, decay: 0.4, sustain: 0.6, release: 1.6 }
        }).toDestination();
        textureSynthMob.volume.value = -12;

        this.synths.bassGrooveMob = {
            fundamental: fundamentalSynthMob,
            texture: textureSynthMob
        };
    }

    public setInstrument(name: BassInstrument) {
       if (this.activeInstrument === 'portamento' && name !== 'portamento' && this.isPortamentoPlaying) {
           this.synths.portamento?.triggerRelease();
           this.isPortamentoPlaying = false;
       }
       if (this.activeInstrument === 'portamentoMob' && name !== 'portamentoMob' && this.isPortamentoMobPlaying) {
           this.synths.portamentoMob?.triggerRelease();
           this.isPortamentoMobPlaying = false;
       }
       this.activeInstrument = name;
    }

    public schedule(score: SynthNote[], time: number) {
        console.log('[BASS MANAGER] Schedule called. Active instrument:', this.activeInstrument, 'Score:', score);
        if (this.activeInstrument === 'none') {
             if (this.isPortamentoPlaying) {
                console.log('[BASS MANAGER] Releasing Portamento due to instrument change.');
                this.synths.portamento?.triggerRelease(time);
                this.isPortamentoPlaying = false;
            }
             if (this.isPortamentoMobPlaying) {
                 console.log('[BASS MANAGER] Releasing PortamentoMob due to instrument change.');
                this.synths.portamentoMob?.triggerRelease(time);
                this.isPortamentoMobPlaying = false;
            }
            return;
        }

        if (score.length === 0) {
            if (this.activeInstrument === 'portamento' && this.isPortamentoPlaying) {
                console.log('[BASS MANAGER] Releasing Portamento due to empty score.');
                this.synths.portamento?.triggerRelease(time);
                this.isPortamentoPlaying = false;
            }
            if (this.activeInstrument === 'portamentoMob' && this.isPortamentoMobPlaying) {
                console.log('[BASS MANAGER] Releasing PortamentoMob due to empty score.');
                this.synths.portamentoMob?.triggerRelease(time);
                this.isPortamentoMobPlaying = false;
            }
            return;
        }

        score.forEach(note => {
            const scheduledTime = time + this.Tone.Time(note.time, '4n').toSeconds();
            const duration = this.Tone.Time(note.duration, 'n');
            const velocity = note.velocity;
            const noteName = note.note;

            console.log('[BASS MANAGER] Scheduling note:', note.note, 'at', scheduledTime, 'with velocity', velocity);

            if (this.isPortamentoPlaying && this.activeInstrument !== 'portamento') {
                this.synths.portamento?.triggerRelease(time);
                this.isPortamentoPlaying = false;
            }
            if (this.isPortamentoMobPlaying && this.activeInstrument !== 'portamentoMob') {
                this.synths.portamentoMob?.triggerRelease(time);
                this.isPortamentoMobPlaying = false;
            }


            if (this.activeInstrument === 'portamento' && this.synths.portamento) {
                if (!this.isPortamentoPlaying) {
                    console.log('[BASS MANAGER] Triggering Attack for Portamento');
                    this.synths.portamento.triggerAttack(noteName, scheduledTime, velocity);
                    this.isPortamentoPlaying = true;
                } else {
                    console.log('[BASS MANAGER] Setting note for Portamento');
                    this.synths.portamento.setNote(noteName, scheduledTime);
                }
            } else if (this.activeInstrument === 'portamentoMob' && this.synths.portamentoMob) {
                 if (!this.isPortamentoMobPlaying) {
                    console.log('[BASS MANAGER] Triggering Attack for PortamentoMob');
                    this.synths.portamentoMob.triggerAttack(noteName, scheduledTime, velocity);
                    this.isPortamentoMobPlaying = true;
                } else {
                    console.log('[BASS MANAGER] Setting note for PortamentoMob');
                    this.synths.portamentoMob.setNote(noteName, scheduledTime);
                }
            } else if (this.activeInstrument === 'bassGuitar' && this.synths.bassGuitar) {
                console.log('[BASS MANAGER] Triggering Attack/Release for BassGuitar');
                this.synths.bassGuitar.triggerAttackRelease(noteName, duration, scheduledTime, velocity);
            } else if (this.activeInstrument === 'BassGroove' && this.synths.bassGroove) {
                console.log('[BASS MANAGER] Triggering Attack/Release for BassGroove');
                this.synths.bassGroove.fundamental.triggerAttackRelease(noteName, duration, scheduledTime, velocity);
                const textureNote = this.Tone.Frequency(noteName).transpose(12).toNote();
                this.synths.bassGroove.texture.triggerAttackRelease(textureNote, duration, scheduledTime, velocity * 0.5);
            } else if (this.activeInstrument === 'BassGrooveMob' && this.synths.bassGrooveMob) {
                console.log('[BASS MANAGER] Triggering Attack/Release for BassGrooveMob');
                this.synths.bassGrooveMob.fundamental.triggerAttackRelease(noteName, duration, scheduledTime, velocity);
                const textureNote = this.Tone.Frequency(noteName).transpose(12).toNote();
                this.synths.bassGrooveMob.texture.triggerAttackRelease(textureNote, duration, scheduledTime, velocity * 0.5);
            }
        });
    }

    public stopAll() {
        if (this.isPortamentoPlaying) {
            this.synths.portamento?.triggerRelease();
            this.isPortamentoPlaying = false;
        }
        if (this.isPortamentoMobPlaying) {
            this.synths.portamentoMob?.triggerRelease();
            this.isPortamentoMobPlaying = false;
        }
        this.synths.bassGuitar?.triggerRelease();
        this.synths.bassGroove?.fundamental.triggerRelease();
        this.synths.bassGroove?.texture.triggerRelease();
        this.synths.bassGrooveMob?.fundamental.triggerRelease();
        this.synths.bassGrooveMob?.texture.triggerRelease();
    }
}

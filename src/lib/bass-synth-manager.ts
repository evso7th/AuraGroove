
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
    private isPlaying = false;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.createPresets();
        this.setInstrument(this.activeInstrument);
    }

    private createPresets() {
        this.synths.bassGuitar = new this.Tone.MonoSynth({
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7 }
        }).toDestination();
        this.synths.bassGuitar.volume.value = -3;

        const portamentoReverb = new this.Tone.Reverb({
            decay: 6,
            wet: 0.4
        }).toDestination();

        this.synths.portamento = new this.Tone.MonoSynth({
            portamento: 0.2, 
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.9, release: 4.0 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 5.0, baseFrequency: 200, octaves: 7 }
        }).connect(portamentoReverb);
        this.synths.portamento.volume.value = -3;
        
        this.synths.portamentoMob = new this.Tone.MonoSynth({
            portamento: 0.2, 
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.9, release: 4.0 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 5.0, baseFrequency: 200, octaves: 7 }
        }).toDestination();
        this.synths.portamentoMob.volume.value = -3;

        // Simplified BassGroove for now
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
        this.synths.bassGroove = this.synths.bassGrooveMob; // Use the same for now
    }
    
    private getActiveSynth() {
        switch(this.activeInstrument) {
            case 'portamento': return this.synths.portamento;
            case 'portamentoMob': return this.synths.portamentoMob;
            case 'bassGuitar': return this.synths.bassGuitar;
            // BassGroove returns the fundamental synth for control
            case 'BassGroove': return this.synths.bassGroove?.fundamental;
            case 'BassGrooveMob': return this.synths.bassGrooveMob?.fundamental;
            default: return null;
        }
    }

    public setInstrument(name: BassInstrument) {
       const currentSynth = this.getActiveSynth();
       if (this.isPlaying) {
           currentSynth?.triggerRelease();
           this.isPlaying = false;
       }
       this.activeInstrument = name;
    }

    public schedule(score: SynthNote[], time: number) {
        console.log(`[BASS MANAGER] Schedule called. Instrument: ${this.activeInstrument}, Time: ${time}, Score:`, score);

        const activeSynth = this.getActiveSynth();

        if (this.activeInstrument === 'none' || !activeSynth) {
             if (this.isPlaying) {
                this.getActiveSynth()?.triggerRelease(time);
                this.isPlaying = false;
            }
            return;
        }

        if (score.length === 0) {
            if (this.isPlaying) {
                activeSynth.triggerRelease(time);
                this.isPlaying = false;
            }
            return;
        }
        
        score.forEach(note => {
            const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
            const noteName = note.note as string;
            
            if (this.activeInstrument === 'portamento' || this.activeInstrument === 'portamentoMob') {
                 if (!this.isPlaying) {
                    activeSynth.triggerAttack(noteName, scheduledTime, note.velocity);
                    this.isPlaying = true;
                } else {
                    activeSynth.setNote(noteName, scheduledTime);
                }
            } else {
                 if(this.isPlaying && (this.activeInstrument === 'portamento' || this.activeInstrument === 'portamentoMob')) {
                    activeSynth.triggerRelease(scheduledTime);
                    this.isPlaying = false;
                }
                const duration = this.Tone.Time(note.duration, 'n');
                activeSynth.triggerAttackRelease(noteName, duration, scheduledTime, note.velocity);

                // Handle texture for BassGroove
                if (this.activeInstrument === 'BassGroove' && this.synths.bassGroove) {
                    const textureNote = this.Tone.Frequency(noteName).transpose(12).toNote();
                    this.synths.bassGroove.texture.triggerAttackRelease(textureNote, duration, scheduledTime, note.velocity * 0.5);
                }
                 if (this.activeInstrument === 'BassGrooveMob' && this.synths.bassGrooveMob) {
                    const textureNote = this.Tone.Frequency(noteName).transpose(12).toNote();
                    this.synths.bassGrooveMob.texture.triggerAttackRelease(textureNote, duration, scheduledTime, note.velocity * 0.5);
                }
            }
        });
    }

    public stopAll() {
        if (this.isPlaying) {
           this.getActiveSynth()?.triggerRelease();
           this.isPlaying = false;
        }
        this.synths.bassGuitar?.triggerRelease();
        this.synths.bassGroove?.fundamental.triggerRelease();
        this.synths.bassGroove?.texture.triggerRelease();
        this.synths.bassGrooveMob?.fundamental.triggerRelease();
        this.synths.bassGrooveMob?.texture.triggerRelease();
    }
}

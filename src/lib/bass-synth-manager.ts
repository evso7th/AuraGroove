
import type { ToneJS, SynthNote } from '@/types/music';

type BassInstrument = 'bassGuitar' | 'BassGroove' | 'portamento' | 'portamentoMob' | 'BassGrooveMob' | 'none';

export class BassSynthManager {
    private Tone: ToneJS;
    private channel: Tone.Channel;
    private synths: {
        bassGuitar?: any;
        bassGroove?: {
            fundamental: any;
            texture: any;
        };
        portamento?: any;
    } = {};
    private activeInstrument: BassInstrument = 'portamento';
    private isPlaying = false;

    constructor(Tone: ToneJS, channel: Tone.Channel) {
        this.Tone = Tone;
        this.channel = channel;
        this.createPresets();
        this.setInstrument(this.activeInstrument);
    }

    private createPresets() {
        // --- bassGuitar ---
        this.synths.bassGuitar = new this.Tone.MonoSynth({
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7 }
        }).connect(this.channel);
        this.synths.bassGuitar.volume.value = -3;

        // --- portamento (Universal) ---
        this.synths.portamento = new this.Tone.MonoSynth({
            portamento: 0.2, 
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.9, release: 4.0 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 5.0, baseFrequency: 200, octaves: 7 }
        }).connect(this.channel);
        this.synths.portamento.volume.value = -3;

        // --- BassGroove (Universal) ---
        const fundamentalSynth = new this.Tone.MonoSynth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.8, release: 1.6 }
        }).connect(this.channel);
        fundamentalSynth.volume.value = -3;

        const textureSynth = new this.Tone.MonoSynth({
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.08, decay: 0.4, sustain: 0.6, release: 1.6 }
        }).connect(this.channel);
        textureSynth.volume.value = -12;

        this.synths.bassGroove = {
            fundamental: fundamentalSynth,
            texture: textureSynth
        };
    }
    
    private getActiveSynth() {
        switch(this.activeInstrument) {
            case 'portamento':
            case 'portamentoMob': 
                return this.synths.portamento;
            case 'bassGuitar': 
                return this.synths.bassGuitar;
            case 'BassGroove':
            case 'BassGrooveMob':
                return this.synths.bassGroove?.fundamental;
            default: 
                return null;
        }
    }

    public setInstrument(name: BassInstrument) {
       const currentSynth = this.getActiveSynth();
       if (this.isPlaying && currentSynth) {
           currentSynth.triggerRelease();
           this.isPlaying = false;
       }
       this.activeInstrument = name;
    }

    public schedule(score: SynthNote[], time: number) {
        const activeSynth = this.getActiveSynth();

        if (this.activeInstrument === 'none' || !activeSynth) {
             if (this.isPlaying && activeSynth) {
                activeSynth.triggerRelease(time);
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
            
            if (this.activeInstrument.includes('portamento')) {
                 if (!this.isPlaying) {
                    activeSynth.triggerAttack(noteName, scheduledTime, note.velocity);
                    this.isPlaying = true;
                } else {
                    activeSynth.setNote(noteName, scheduledTime);
                }
            } else {
                 if(this.isPlaying && this.activeInstrument.includes('portamento')) {
                    activeSynth.triggerRelease(scheduledTime);
                    this.isPlaying = false;
                }
                const duration = this.Tone.Time(note.duration, 'n');
                activeSynth.triggerAttackRelease(noteName, duration, scheduledTime, note.velocity);

                if (this.activeInstrument.includes('BassGroove') && this.synths.bassGroove) {
                    const textureNote = this.Tone.Frequency(noteName).transpose(12).toNote();
                    this.synths.bassGroove.texture.triggerAttackRelease(textureNote, duration, scheduledTime, note.velocity * 0.5);
                }
            }
        });
    }

    public stopAll() {
        if (this.isPlaying) {
            const activeSynth = this.getActiveSynth();
            if (activeSynth) {
                 activeSynth.triggerRelease();
            }
           this.isPlaying = false;
        }
        this.synths.bassGuitar?.triggerRelease();
        this.synths.bassGroove?.fundamental.triggerRelease();
        this.synths.bassGroove?.texture.triggerRelease();
    }
}

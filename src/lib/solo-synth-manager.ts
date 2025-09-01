
import type { ToneJS, SynthNote } from '@/types/music';

export class SoloSynthManager {
    private Tone: ToneJS;
    private synths: Map<string, any>;
    private activeSynth: any;
    private currentInstrument: string;
    private isPortamentoPlaying = false;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.synths = new Map();
        this.currentInstrument = 'portamento';
        this.createPresets();
        this.activeSynth = this.synths.get(this.currentInstrument);
    }

    private createPresets() {
        const synthesizer = new this.Tone.MonoSynth({
            portamento: 0.1,
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.2 }
        }).toDestination();
        this.synths.set('synthesizer', synthesizer);

        const organOptions = {
            oscillator: { type: 'fatsawtooth', count: 3 },
             envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 1.2 }
        };
        const organ = new this.Tone.MonoSynth(organOptions).toDestination();
        organ.volume.value = -8;
        this.synths.set('organ', organ);

        const pianoOptions = {
            harmonicity: 3.01,
            modulationIndex: 14,
            envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.9 },
        };
        const piano = new this.Tone.FMSynth(pianoOptions).toDestination();
        piano.volume.value = -6;
        this.synths.set('piano', piano);
        
        const mellotronOptions = {
            harmonicity: 3,
            modulationIndex: 0.5,
            oscillator: { type: "sine" },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.4, release: 0.8 },
            modulation: { type: "sine" },
            modulationEnvelope: { attack: 0.2, decay: 0.5, sustain: 0.1, release: 0.8 }
        };
        const mellotron = new this.Tone.FMSynth(mellotronOptions).toDestination();
        mellotron.volume.value = -7;
        this.synths.set('mellotron', mellotron);

        const portamento = new this.Tone.MonoSynth({
            portamento: 0.1,
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.2 }
        }).toDestination();
        this.synths.set('portamento', portamento);
    }

    public setInstrument(name: 'synthesizer' | 'piano' | 'organ' | 'mellotron' | 'portamento' | 'none') {
        if (this.currentInstrument === 'portamento' && name !== 'portamento' && this.isPortamentoPlaying) {
           this.synths.get('portamento')?.triggerRelease();
           this.isPortamentoPlaying = false;
        }

        if (name === 'none') {
            this.activeSynth = null;
        } else if (this.synths.has(name)) {
            this.currentInstrument = name;
            this.activeSynth = this.synths.get(name);
        } else {
            console.warn(`[SoloSynthManager] Instrument "${name}" not found.`);
        }
    }

    public schedule(score: SynthNote[], time: number) {
        if (!this.activeSynth) {
            if (this.isPortamentoPlaying) {
                this.synths.get('portamento')?.triggerRelease(time);
                this.isPortamentoPlaying = false;
            }
            return;
        };

        if (this.currentInstrument === 'portamento') {
            if (score.length > 0) {
                 const note = score[0]; // Portamento plays one note at a time
                 const scheduledTime = time + this.Tone.Time(note.time, '4n').toSeconds();
                 if (!this.isPortamentoPlaying) {
                    this.activeSynth.triggerAttack(note.note, scheduledTime, note.velocity);
                    this.isPortamentoPlaying = true;
                } else {
                    this.activeSynth.setNote(note.note, scheduledTime);
                }
            } else {
                if (this.isPortamentoPlaying) {
                    this.activeSynth.triggerRelease(time);
                    this.isPortamentoPlaying = false;
                }
            }
        } else {
             if (this.isPortamentoPlaying) {
                this.synths.get('portamento')?.triggerRelease(time);
                this.isPortamentoPlaying = false;
            }
            score.forEach(note => {
                this.activeSynth.triggerAttackRelease(
                    note.note,
                    this.Tone.Time(note.duration, 'n'),
                    time + this.Tone.Time(note.time, '4n').toSeconds(),
                    note.velocity
                );
            });
        }
    }

    public stopAll() {
        if (this.activeSynth) {
            this.activeSynth.triggerRelease();
        }
        if (this.isPortamentoPlaying) {
            this.synths.get('portamento')?.triggerRelease();
            this.isPortamentoPlaying = false;
        }
    }
}

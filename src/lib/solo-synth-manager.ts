
import type { ToneJS, SynthNote } from '@/types/music';

export class SoloSynthManager {
    private Tone: ToneJS;
    private synths: Map<string, any>;
    private activeSynth: any;
    private currentInstrument: string;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.synths = new Map();
        this.currentInstrument = 'synthesizer';
        this.createPresets();
        this.activeSynth = this.synths.get(this.currentInstrument);
    }

    private createPresets() {
        const synthesizer = new this.Tone.MonoSynth({
            oscillator: { type: 'fatsquare' },
            envelope: { attack: 0.1, decay: 0.4, sustain: 0.6, release: 1.5 },
            filter: { type: 'lowpass', rolloff: -12, Q: 1 }
        }).toDestination();
        this.synths.set('synthesizer', synthesizer);

        const organOptions = {
            oscillator: { type: 'fatsawtooth', count: 3 },
             envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 1.2 }
        };
        // Using MonoSynth for a monophonic organ sound
        const organ = new this.Tone.MonoSynth(organOptions).toDestination();
        organ.volume.value = -8;
        this.synths.set('organ', organ);

        const pianoOptions = {
            harmonicity: 3.01,
            modulationIndex: 14,
            envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.9 },
        };
        // FMSynth is monophonic by nature
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
        // FMSynth is monophonic by nature
        const mellotron = new this.Tone.FMSynth(mellotronOptions).toDestination();
        mellotron.volume.value = -7;
        this.synths.set('mellotron', mellotron);
    }

    public setInstrument(name: 'synthesizer' | 'piano' | 'organ' | 'mellotron' | 'none') {
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
        if (!this.activeSynth || score.length === 0) return;

        score.forEach(note => {
            this.activeSynth.triggerAttackRelease(
                note.note,
                this.Tone.Time(note.duration, 'n'),
                time + (note.time * this.Tone.Time('4n').toSeconds()),
                note.velocity
            );
        });
    }
}

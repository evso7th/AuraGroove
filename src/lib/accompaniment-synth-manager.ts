
import type { ToneJS, SynthNote } from '@/types/music';

export class AccompanimentSynthManager {
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
        const synthOptions = {
            oscillator: { type: 'fatsine' },
            envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 1.2 }
        };
        const synth = new this.Tone.PolySynth(this.Tone.Synth, synthOptions).toDestination();
        synth.volume.value = -6;
        this.synths.set('synthesizer', synth);

        const organOptions = {
            oscillator: { type: 'fatsawtooth', count: 3 },
             envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 1.2 }
        };
        const organ = new this.Tone.PolySynth(this.Tone.Synth, organOptions).toDestination();
        organ.volume.value = -8; // Organs can be loud
        this.synths.set('organ', organ);

        const pianoOptions = { // Basic electric piano
            harmonicity: 3.01,
            modulationIndex: 14,
            envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.9 },
        };
        const piano = new this.Tone.PolySynth(this.Tone.FMSynth, pianoOptions).toDestination();
        piano.volume.value = -6;
        this.synths.set('piano', piano);
    }

    public setInstrument(name: 'synthesizer' | 'piano' | 'organ' | 'none') {
        if (name === 'none') {
            this.activeSynth = null;
        } else if (this.synths.has(name)) {
            this.currentInstrument = name;
            this.activeSynth = this.synths.get(name);
        } else {
            console.warn(`[AccompanimentSynthManager] Instrument "${name}" not found.`);
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

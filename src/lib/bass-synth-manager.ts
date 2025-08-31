
import type { ToneJS, SynthNote } from '@/types/music';

export class BassSynthManager {
    private Tone: ToneJS;
    private presets: Map<string, any>;
    private activeSynth: any;
    private currentInstrument: string;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.presets = new Map();
        this.currentInstrument = 'bassGuitar';
        this.createPresets();
        this.activeSynth = this.presets.get(this.currentInstrument);
    }

    private createPresets() {
        const bassGuitarSynth = new this.Tone.MonoSynth({
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7 }
        }).toDestination();
        this.presets.set('bassGuitar', bassGuitarSynth);
    }

    public setInstrument(name: 'bassGuitar' | 'none') {
        if (name === 'none') {
            this.activeSynth = null;
        } else if (this.presets.has(name)) {
            this.currentInstrument = name;
            this.activeSynth = this.presets.get(name);
        } else {
            console.warn(`[BassSynthManager] Instrument "${name}" not found.`);
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

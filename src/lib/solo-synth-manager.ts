
import type { ToneJS, SynthNote } from '@/types/music';

export class SoloSynthManager {
    private Tone: ToneJS;
    private synth: any; // Using 'any' to avoid complex Tone.js types in this context

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        // Одноголосый синтезатор для сольных партий.
        this.synth = new this.Tone.MonoSynth({
            oscillator: {
                type: 'fatsquare' // Богатый, теплый тембр
            },
            envelope: {
                attack: 0.1,    // Плавное появление
                decay: 0.4,
                sustain: 0.6,
                release: 1.5    // Длинный "хвост"
            },
            filter: {
                type: 'lowpass', // Смягчающий фильтр
                rolloff: -12,
                Q: 1
            }
        }).toDestination();
    }

    public schedule(score: SynthNote[], time: number) {
        if (score.length === 0) return;

        score.forEach(note => {
            // MonoSynth использует тот же API для планирования
            this.synth.triggerAttackRelease(
                note.note,
                this.Tone.Time(note.duration, 'n'),
                time + (note.time * this.Tone.Time('4n').toSeconds()),
                note.velocity
            );
        });
    }
}

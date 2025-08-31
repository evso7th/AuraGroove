
import type { ToneJS, SynthNote } from '@/types/music';

/**
 * Manages a pool of monophonic synthesizers to play the accompaniment part.
 * This approach avoids using the resource-intensive PolySynth, ensuring better performance
 * on mobile devices by playing overlapping monophonic lines.
 */
export class AccompanimentSynthManager {
    private Tone: ToneJS;
    private synths: any[] = [];
    private readonly voiceCount = 4; // Fixed pool of 4 voices.
    private nextVoiceIndex = 0;
    private currentInstrument: string;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.currentInstrument = 'synthesizer';
        this.createPresets();
    }

    private createPresets() {
        this.synths = []; // Clear existing synths

        const createSynthPreset = (type: string) => {
            const options: any = {
                'synthesizer': {
                    oscillator: { type: 'fmsine', harmonicity: 1.2 },
                    envelope: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 2.0 }
                },
                'organ': {
                     oscillator: { type: 'fatsawtooth', count: 3 },
                     envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 2.0 }
                },
                'piano': {
                    type: 'FMSynth',
                    options: {
                        harmonicity: 3.01,
                        modulationIndex: 14,
                        envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 1.5 },
                    }
                },
                'mellotron': {
                     type: 'FMSynth',
                     options: {
                        harmonicity: 3,
                        modulationIndex: 0.5,
                        oscillator: { type: "sine" },
                        envelope: { attack: 0.2, decay: 0.2, sustain: 0.4, release: 1.8 },
                        modulation: { type: "sine" },
                        modulationEnvelope: { attack: 0.3, decay: 0.5, sustain: 0.1, release: 1.8 }
                    }
                }
            };

            const preset = options[type as keyof typeof options];
            
            for (let i = 0; i < this.voiceCount; i++) {
                 let synth;
                 if (preset.type === 'FMSynth') {
                    synth = new this.Tone.FMSynth(preset.options).toDestination();
                 } else {
                    synth = new this.Tone.MonoSynth(preset).toDestination();
                 }
                 synth.volume.value = -9; // Quieter to avoid clipping with overlapping notes
                 this.synths.push(synth);
            }
        }

        createSynthPreset(this.currentInstrument);
    }

    public setInstrument(name: 'synthesizer' | 'piano' | 'organ' | 'mellotron' | 'none') {
        if (name === 'none') {
            // Dispose of old synths but don't create new ones
            this.synths.forEach(synth => synth.dispose());
            this.synths = [];
            this.currentInstrument = name;
        } else if (this.currentInstrument !== name) {
            this.currentInstrument = name;
            // Dispose of old synths before creating new ones
            this.synths.forEach(synth => synth.dispose());
            this.createPresets();
        }
    }

    /**
     * Schedules notes from the score using a round-robin approach on the synth pool.
     * The worker guarantees that the score length will not exceed the voice count.
     * @param score - An array of SynthNote objects.
     * @param time - The transport time to schedule the notes at.
     */
    public schedule(score: SynthNote[], time: number) {
        if (this.synths.length === 0 || score.length === 0) return;

        score.forEach(note => {
            const synth = this.synths[this.nextVoiceIndex];
            if (synth) {
                synth.triggerAttackRelease(
                    note.note,
                    this.Tone.Time(note.duration, 'n'),
                    time + (note.time * this.Tone.Time('4n').toSeconds()),
                    note.velocity
                );
            }
            // Move to the next synth in the pool for the next note
            this.nextVoiceIndex = (this.nextVoiceIndex + 1) % this.synths.length;
        });
    }
}

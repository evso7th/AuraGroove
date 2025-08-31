
import type { ToneJS, SynthNote } from '@/types/music';

export class BassSynthManager {
    private Tone: ToneJS;
    private presets: Map<string, any>;
    private activePreset: any;
    private currentInstrument: string;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.presets = new Map();
        this.currentInstrument = 'bass_synth';
        this.createPresets();
        this.activePreset = this.presets.get(this.currentInstrument);
    }

    private createPresets() {
        // --- PRESET 1: 'bassGuitar' (MonoSynth) ---
        const bassGuitarSynth = new this.Tone.MonoSynth({
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7 }
        }).toDestination();
        this.presets.set('bassGuitar', { type: 'simple', synth: bassGuitarSynth });

        // --- PRESET 2: 'bass_synth' (Layered with two independent PolySynths) ---
        const subOsc = new this.Tone.PolySynth(this.Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.9, release: 1.0 }
        });
        const subDistortion = new this.Tone.Distortion(0.05).toDestination();
        subOsc.connect(subDistortion);

        const charOsc = new this.Tone.PolySynth(this.Tone.Synth, {
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 }
        });
        const charChorus = new this.Tone.Chorus(4, 2.5, 0.5).toDestination();
        charOsc.connect(charChorus);
        
        this.presets.set('bass_synth', {
            type: 'layered',
            layeredSynths: { sub: subOsc, character: charOsc }
        });
    }

    public setInstrument(name: 'bass_synth' | 'bassGuitar' | 'none') {
        if (name === 'none') {
            this.activePreset = null;
        } else if (this.presets.has(name)) {
            this.currentInstrument = name;
            this.activePreset = this.presets.get(name);
        } else {
            console.warn(`[BassSynthManager] Instrument "${name}" not found.`);
        }
    }

    public schedule(score: SynthNote[], time: number) {
        if (!this.activePreset || score.length === 0) return;

        if (this.activePreset.type === 'simple' && this.activePreset.synth) {
            score.forEach(note => {
                this.activePreset?.synth.triggerAttackRelease(
                    note.note,
                    this.Tone.Time(note.duration, 'n'),
                    time + (note.time * this.Tone.Time('4n').toSeconds()),
                    note.velocity
                );
            });
        } else if (this.activePreset.type === 'layered' && this.activePreset.layeredSynths) {
            const { sub, character } = this.activePreset.layeredSynths;
            if (!sub || !character) return;

            score.forEach(note => {
                const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
                const duration = this.Tone.Time(note.duration, 'n');
                
                sub.triggerAttackRelease(note.note, duration, scheduledTime, note.velocity * 0.9);
                
                const charNote = this.Tone.Frequency(note.note).transpose(12);
                character.triggerAttackRelease(charNote, duration, scheduledTime, note.velocity * 0.6);
            });
        }
    }
}

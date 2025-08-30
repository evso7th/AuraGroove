
import type { ToneJS, SynthNote } from '@/types/music';

type BassSynthPreset = {
    type: 'simple' | 'layered';
    // For simple presets, a single synth instance
    synth?: any; // Tone.MonoSynth
    // For layered presets, multiple synth instances
    layeredSynths?: {
        [key: string]: any; // e.g., { sub: Tone.Synth, character: Tone.Synth }
    };
};

export class BassSynthManager {
    private Tone: ToneJS;
    private presets: Map<string, BassSynthPreset>;
    private activePreset: BassSynthPreset | null;
    private currentInstrument: string;

    constructor(Tone: ToneJS) {
        this.Tone = Tone;
        this.presets = new Map();
        this.currentInstrument = 'bass_synth';
        this.createPresets();
        this.activePreset = this.presets.get(this.currentInstrument) ?? null;
    }

    private createPresets() {
        // --- PRESET 1: 'bassGuitar' (the original FM synth, remains a simple MonoSynth) ---
        const bassGuitarSynth = new this.Tone.MonoSynth({
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2, baseFrequency: 200, octaves: 7 }
        }).toDestination();
        this.presets.set('bassGuitar', { type: 'simple', synth: bassGuitarSynth });

        // --- PRESET 2: 'bass_synth' (new layered synth with two separate synths) ---
        const subOsc = new this.Tone.Synth({
            oscillator: { type: 'sine' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.9, release: 1.0 }
        });
        const subDistortion = new this.Tone.Distortion(0.05).toDestination();
        subOsc.connect(subDistortion);

        const charOsc = new this.Tone.Synth({
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
            this.activePreset = this.presets.get(name) ?? null;
        } else {
            console.warn(`[BassSynthManager] Instrument "${name}" not found.`);
        }
    }

    public schedule(score: SynthNote[], time: number) {
        if (!this.activePreset || score.length === 0) return;

        // Logic for simple, single-synth presets like 'bassGuitar'
        if (this.activePreset.type === 'simple' && this.activePreset.synth) {
            score.forEach(note => {
                this.activePreset?.synth.triggerAttackRelease(
                    note.note,
                    this.Tone.Time(note.duration, 'n'),
                    time + (note.time * this.Tone.Time('4n').toSeconds()),
                    note.velocity
                );
            });
        // Logic for layered presets like 'bass_synth'
        } else if (this.activePreset.type === 'layered' && this.activePreset.layeredSynths) {
            const { sub, character } = this.activePreset.layeredSynths;
            if (!sub || !character) return;

            score.forEach(note => {
                const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
                const duration = this.Tone.Time(note.duration, 'n');
                
                // The 'sub' layer plays the original note
                console.log(`[BASS TRACE] Scheduling SUB layer. Time: ${scheduledTime}, Note: ${note.note}`);
                sub.triggerAttackRelease(note.note, duration, scheduledTime, note.velocity * 0.9);
                
                // The 'character' layer plays the note transposed up by one octave
                const charNote = this.Tone.Frequency(note.note).transpose(12);
                console.log(`[BASS TRACE] Scheduling CHARACTER layer. Time: ${scheduledTime}, Note: ${charNote.toNote()}`);
                character.triggerAttackRelease(charNote, duration, scheduledTime, note.velocity * 0.6);
            });
        }
    }
}

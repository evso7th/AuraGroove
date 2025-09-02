

import type { ToneJS, SynthNote, MelodyInstrument, MelodyTechnique } from '@/types/music';

/**
 * Manages the melody synthesizers.
 * This version is updated to handle complex, layered presets and different playing techniques.
 * It uses a pool of MonoSynths for reliability and flexibility.
 */
export class MelodySynthManager {
    private Tone: ToneJS;
    public channel: Tone.Channel;
    private presets: Record<string, any>;
    private activeInstrument: MelodyInstrument = 'synth';
    private activeTechnique: MelodyTechnique = 'arpeggio';
    
    private voices: any[] = [];
    private readonly VOICE_COUNT = 4; // Pool of 4 mono synths

    constructor(Tone: ToneJS, channel: Tone.Channel) {
        this.Tone = Tone;
        this.channel = channel;
        
        this.presets = {
            pluckLead: {
                oscillator: { type: 'fatsawtooth', count: 3, spread: 20 },
                envelope: { 
                    attack: 0.08, 
                    decay: 0.7, 
                    sustain: 0.7, 
                    release: 2.0,
                    releaseCurve: 'exponential'
                },
                filter: { type: 'lowpass', Q: 2, rolloff: -12 },
                filterEnvelope: { attack: 0.03, decay: 0.4, sustain: 0.5, release: 1.2, baseFrequency: 250, octaves: 3.4 }
            },
            reversedString: {
                 oscillator: { type: 'fatsawtooth', count: 3, spread: 30 },
                 envelope: { attack: 1.2, decay: 1.5, sustain: 0, release: 1.5 },
                 filter: { type: 'lowpass', Q: 2, rolloff: -12 },
                 filterEnvelope: { attack: 1.2, decay: 0.1, sustain: 1, release: 0.5, baseFrequency: 150, octaves: 4, exponent: 2 }
            },
            decayingPad: {
                oscillator: { type: 'fatsawtooth', count: 3, spread: 40 },
                noise: { type: 'pink', playbackRate: 0.2 },
                envelope: { attack: 0.01, decay: 2.0, sustain: 0, release: 1.5 },
                filter: { type: 'lowpass', Q: 1 },
                filterEnvelope: { attack: 1.5, decay: 0.8, sustain: 0.5, release: 1.0, baseFrequency: 200, octaves: 3 }
            },
            synth: 'pluckLead' 
        };

        // Initialize the voice pool
        for(let i = 0; i < this.VOICE_COUNT; i++) {
            const synth = new this.Tone.MonoSynth().connect(this.channel);
            this.voices.push(synth);
        }

        this.setInstrument('synth');
    }

    public setInstrument(name: MelodyInstrument) {
        this.activeInstrument = name;

        if (name === 'none') {
            this.stopAll();
            return;
        }

        let presetNameOrObject = this.presets[name];
        if (typeof presetNameOrObject === 'string') {
            presetNameOrObject = this.presets[presetNameOrObject];
        }

        if (presetNameOrObject) {
            this.voices.forEach(voice => voice.set(presetNameOrObject));
        }
    }
    
    public setTechnique(technique: MelodyTechnique) {
        this.activeTechnique = technique;
        const portamentoValue = (technique === 'portamento' || technique === 'glissando') ? 0.2 : 0;
        
        // Glissando is just a faster portamento
        this.voices.forEach(voice => {
            voice.portamento = portamentoValue;
        });
    }

    public schedule(score: SynthNote[], time: number) {
        if (this.activeInstrument === 'none' || score.length === 0) {
            return;
        }

        if (this.activeTechnique === 'arpeggio') {
            this.scheduleArpeggio(score, time);
        } else {
            this.schedulePortamento(score, time);
        }
    }

    private scheduleArpeggio(score: SynthNote[], time: number) {
        score.forEach(note => {
            const voiceIndex = note.voiceIndex ?? 0;
            if (voiceIndex >= this.voices.length) {
                console.warn(`Voice index ${voiceIndex} is out of bounds.`);
                return;
            }
            const voice = this.voices[voiceIndex];
            const scheduledTime = time + (note.time * this.Tone.Time('4n').toSeconds());
            const noteName = note.note as string;
            const duration = this.Tone.Time(note.duration, 'n');
            
            voice.triggerAttackRelease(noteName, duration, scheduledTime, note.velocity);
        });
    }

    private schedulePortamento(score: SynthNote[], time: number) {
        if (score.length === 0) return;

        const voiceIndex = score[0].voiceIndex ?? 0;
         if (voiceIndex >= this.voices.length) {
            console.warn(`Voice index ${voiceIndex} is out of bounds.`);
            return;
        }
        const voice = this.voices[voiceIndex];
        const phrase = score[0].note as string[]; // In portamento mode, the worker sends the whole phrase

        // Schedule the sequence of notes on a single synth
        let noteTime = time;
        phrase.forEach((note, index) => {
            const scheduledTime = noteTime + ( (index > 0 ? score[0].duration / phrase.length : 0) * this.Tone.Time('4n').toSeconds());
            if (index === 0) {
                voice.triggerAttack(note, scheduledTime, score[0].velocity);
            } else {
                voice.setNote(note, scheduledTime);
            }
        });

        // Schedule the final release
        const totalDuration = score[0].duration * this.Tone.Time('4n').toSeconds();
        const releaseTime = time + totalDuration;
        voice.triggerRelease(releaseTime);
    }

    public stopAll() {
        this.voices.forEach(voice => voice.releaseAll ? voice.releaseAll() : voice.triggerRelease());
    }
}

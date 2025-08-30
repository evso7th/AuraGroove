
import type { SynthNote, ToneJS } from '@/types/music';

// A "Voice" represents a single synthesizer and its current state.
class Voice {
    public synth: any; // Tone.Synth
    public isBusy = false;
    private releaseTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private readonly releaseTime: number;

    constructor(tone: ToneJS, outputChannel: any, options: any) {
        this.synth = new tone.Synth(options).connect(outputChannel);
        // Store release time in milliseconds for timeout calculation
        this.releaseTime = new tone.Time(this.synth.envelope.release).toMilliseconds();
    }

    public triggerAttackRelease(note: string, duration: string, time: number, velocity: number) {
        if (this.releaseTimeoutId) {
            clearTimeout(this.releaseTimeoutId);
        }
        this.isBusy = true;
        
        this.synth.triggerAttackRelease(note, duration, time, velocity);
        
        // Calculate when the voice will be free again
        const durationMs = new this.synth.Tone.Time(duration).toMilliseconds();
        const scheduledReleaseTime = (time - this.synth.Tone.now()) * 1000;

        // Total time until the voice is fully released and available
        const totalBusyTime = scheduledReleaseTime + durationMs + this.releaseTime;

        this.releaseTimeoutId = setTimeout(() => {
            this.isBusy = false;
            this.releaseTimeoutId = null;
        }, totalBusyTime + 50); // Add a 50ms buffer for safety
    }

    public stop() {
        this.synth.triggerRelease();
        if (this.releaseTimeoutId) clearTimeout(this.releaseTimeoutId);
        this.isBusy = false;
    }
}

export class AccompanimentSynthManager {
    private voicePool: Voice[] = [];
    private readonly poolSize = 8; // Number of voices in the pool
    private nextVoiceIndex = 0;
    private Tone: ToneJS;

    constructor(tone: ToneJS, outputChannel: any) {
        this.Tone = tone;
        const synthOptions = {
            oscillator: {
                type: 'fatsine4',
                spread: 40,
                count: 4,
            },
            envelope: {
                attack: 0.2,
                decay: 0.5,
                sustain: 0.8,
                release: 0.5, // Updated release time
            },
        };

        // Create the pool of voices
        for (let i = 0; i < this.poolSize; i++) {
            this.voicePool.push(new Voice(this.Tone, outputChannel, synthOptions));
        }
    }
    
    private findAvailableVoice(): Voice | null {
        // Search for a free voice starting from the next available index
        for (let i = 0; i < this.poolSize; i++) {
            const voiceIndex = (this.nextVoiceIndex + i) % this.poolSize;
            if (!this.voicePool[voiceIndex].isBusy) {
                this.nextVoiceIndex = (voiceIndex + 1) % this.poolSize;
                return this.voicePool[voiceIndex];
            }
        }
        
        // If no voice is free, implement voice stealing: steal the next one in line.
        // This is a simple round-robin stealing strategy.
        const voiceToSteal = this.voicePool[this.nextVoiceIndex];
        this.nextVoiceIndex = (this.nextVoiceIndex + 1) % this.poolSize;
        console.warn(`[ACCOMP_TRACE] No free voices. Stealing voice.`);
        return voiceToSteal;
    }

    public scheduleAccompaniment(score: SynthNote[], startTime: number) {
        console.log('[ACCOMP_TRACE] AccompanimentSynthManager received score:', score);
        if (!score || score.length === 0) return;

        score.forEach(noteEvent => {
            const notes = Array.isArray(noteEvent.note) ? noteEvent.note : [noteEvent.note];

            notes.forEach(noteString => {
                const voice = this.findAvailableVoice();
                if (voice) {
                    try {
                        voice.triggerAttackRelease(noteString, noteEvent.duration, startTime + noteEvent.time, noteEvent.velocity);
                    } catch(e) {
                        console.error(`[ACCOMP_TRACE] Error scheduling accompaniment note ${noteString}. Error: ${e}`);
                    }
                } else {
                    console.warn(`[ACCOMP_TRACE] Could not find an available voice for note ${noteString}.`);
                }
            });
        });
    }

    public setVolume(db: number) {
        this.voicePool.forEach(voice => {
            voice.synth.volume.value = db;
        });
    }

    public stopAll() {
        this.voicePool.forEach(voice => voice.stop());
    }
}

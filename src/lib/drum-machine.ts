
import * as Tone from 'tone';
import type { FxBus } from './fx-bus';
import type { DrumNote } from '@/types/music';

const samplePaths: Record<string, string> = {
    'kick': '/assets/drums/kick_drum6.wav',
    'snare': '/assets/drums/snare.wav',
    'hat': '/assets/drums/closed_hi_hat_accented.wav',
    'crash': '/assets/drums/crash1.wav',
    'ride': '/assets/drums/cymbal1.wav',
};

/**
 * A robust drum machine using Tone.Sampler for precise and reliable sample playback.
 * This replaces the less reliable Tone.Players approach.
 */
export class DrumMachine {
    private sampler: Tone.Sampler;
    private isLoaded = false;
    private fxBus: FxBus;
    private userVolume: number = 0.7; // Default volume

    constructor(fxBus: FxBus, onLoad: () => void) {
        this.fxBus = fxBus;
        this.sampler = new Tone.Sampler({
            urls: samplePaths,
            baseUrl: '',
            onload: () => {
                this.isLoaded = true;
                onLoad();
                console.log("DrumMachine: All samples loaded.");
            },
        }).connect(this.fxBus.drumInput);
        this.updateVolume();
    }

    public isReady(): boolean {
        return this.isLoaded;
    }

    public setVolume(volume: number) {
        this.userVolume = volume;
        this.updateVolume();
    }

    private updateVolume() {
        const gainValue = Tone.gainToDb(this.userVolume);
        if (this.sampler.volume) {
           this.sampler.volume.value = gainValue;
        }
    }

    public trigger(note: DrumNote, time: number) {
        if (!this.isLoaded) return;
        
        // The sampler maps sample names to MIDI notes. We'll use a simple mapping.
        // Or, we can trigger by the name if the sample names are simple notes like C4.
        // For our case, we trigger the specific sample buffer by name.
        this.sampler.triggerAttack(note.sample, time, note.velocity);
    }
    
    public dispose() {
        if (this.sampler) {
            this.sampler.dispose();
        }
    }
}

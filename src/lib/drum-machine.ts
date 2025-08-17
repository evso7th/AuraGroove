
import * as Tone from 'tone';
import type { FxBus } from './fx-bus';
import type { DrumNote } from '@/types/music';

// Map sample names to MIDI notes. Tone.Sampler requires this.
const sampleNoteMapping: Record<string, string> = {
    'kick': 'C1',
    'snare': 'D1',
    'hat': 'E1',
    'crash': 'F1',
    'ride': 'G1',
};

const samplePaths: Record<string, string> = {
    [sampleNoteMapping['kick']]: '/assets/drums/kick_drum6.wav',
    [sampleNoteMapping['snare']]: '/assets/drums/snare.wav',
    [sampleNoteMapping['hat']]: '/assets/drums/closed_hi_hat_accented.wav',
    [sampleNoteMapping['crash']]: '/assets/drums/crash1.wav',
    [sampleNoteMapping['ride']]: '/assets/drums/cymbal1.wav',
};


/**
 * A robust drum machine using Tone.Sampler for precise and reliable sample playback.
 */
export class DrumMachine {
    private sampler: Tone.Sampler;
    private isLoaded = false;
    private fxBus: FxBus;
    
    constructor(fxBus: FxBus, onLoad: () => void) {
        this.fxBus = fxBus;
        console.log("DRUM_TRACE: Constructing DrumMachine.");
        this.sampler = new Tone.Sampler({
            urls: samplePaths,
            baseUrl: '',
            onload: () => {
                this.isLoaded = true;
                onLoad();
                console.log("DRUM_TRACE: All samples loaded and mapped to notes.");
            },
        }).connect(this.fxBus.drumInput);
    }

    public isReady(): boolean {
        return this.isLoaded;
    }

    public setVolume(volume: number) {
        if (volume < 0.01) {
            this.fxBus.drumInput.gain.value = -Infinity;
        } else {
            const dbValue = Tone.gainToDb(volume);
            this.fxBus.drumInput.gain.value = dbValue;
        }
    }

    public trigger(note: DrumNote, time: number) {
        if (!this.isLoaded) return;
        
        const noteToPlay = sampleNoteMapping[note.sample];
        if (!noteToPlay) {
            console.warn(`DRUM_TRACE: No note mapping found for sample '${note.sample}'`);
            return;
        }
        
        this.sampler.triggerAttack(noteToPlay, time, note.velocity);
    }
    
    public dispose() {
        if (this.sampler) {
            console.log("DRUM_TRACE: Disposing sampler.");
            this.sampler.dispose();
        }
    }
}

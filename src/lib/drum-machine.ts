
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
        console.log("[DRUM_TRACE] Constructor called.");
        this.fxBus = fxBus;
        this.sampler = new Tone.Sampler({
            urls: samplePaths,
            baseUrl: '',
            volume: 0, 
            onload: () => {
                console.log("[DRUM_TRACE] Samples loaded.");
                this.isLoaded = true;
                onLoad();
            },
        }).connect(this.fxBus.drumInput);
    }

    public isReady(): boolean {
        return this.isLoaded;
    }

    public setVolume(volume: number) { // volume is linear 0-1
        console.log(`[DRUM_TRACE] setVolume called with: ${volume}`);
        if (volume < 0.01) {
            this.fxBus.drumInput.volume.value = -Infinity;
        } else {
            // Let's give the drums a +14dB boost to make them prominent
            const dbValue = Tone.gainToDb(volume) + 14;
            this.fxBus.drumInput.volume.value = dbValue;
        }
    }

    public trigger(note: DrumNote, time: number) {
        if (!this.isLoaded) return;
        
        const noteToPlay = sampleNoteMapping[note.sample];
        if (!noteToPlay) {
            console.warn(`[DRUM_TRACE] Unknown sample name: ${note.sample}`);
            return;
        }
        
        console.log(`[DRUM_TRACE] Triggering ${note.sample} at time ${time}`);
        this.sampler.triggerAttackRelease(noteToPlay, '16n', time, note.velocity);
    }
    
    public dispose() {
        if (this.sampler) {
            this.sampler.dispose();
        }
    }
}

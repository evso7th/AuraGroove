
import type { DrumNote, ToneJS } from '@/types/music';

const DRUM_SAMPLES = {
    'kick': '/assets/drums/kick_drum6.wav',
    'snare': '/assets/drums/snare.wav',
    'hat': '/assets/drums/closed_hi_hat_accented.wav',
    'crash': '/assets/drums/crash1.wav',
    'ride': '/assets/drums/cymbal1.wav', // Using cymbal1 as a ride substitute
};

export class DrumMachine {
    private players: any; // Tone.Players
    private isInitialized = false;
    private drumChannel: any; // Tone.Channel
    private readyPromise: Promise<void>;
    private resolveReady!: () => void;
    private Tone: ToneJS;

    constructor(channel: any, tone: ToneJS) {
        this.drumChannel = channel;
        this.Tone = tone;
        this.readyPromise = new Promise(resolve => {
            this.resolveReady = resolve;
        });

        this.players = new this.Tone.Players({
            urls: DRUM_SAMPLES,
            onload: () => {
                console.log('[DRUM_TRACE] Drum samples loaded.');
                this.isInitialized = true;
                this.resolveReady();
            },
            onerror: (error) => console.error('[DRUM_TRACE] Error loading drum samples:', error),
        }).connect(this.drumChannel);
    }
    
    public async waitForReady(): Promise<void> {
        return this.readyPromise;
    }

    public isReady(): boolean {
        return this.isInitialized;
    }

    public setVolume(db: number) {
        this.drumChannel.volume.value = db;
    }

    public scheduleDrumScore(score: DrumNote[], startTime: number) {
        if (!this.isReady()) {
            console.warn('[DRUM_TRACE] Drum machine not ready, skipping score.');
            return;
        }
        
        this.players.mute = false;

        score.forEach(note => {
            if (this.players.has(note.sample)) {
                try {
                    this.players.player(note.sample).start(startTime + note.time).volume.value = this.Tone.gainToDb(note.velocity);
                } catch(e) {
                    console.error(`[DRUM_TRACE] Error scheduling drum sample ${note.sample} at time ${startTime + note.time}. Error: ${e}`);
                }
            }
        });
    }

    public stopAll() {
        if (this.isReady()) {
            this.players.mute = true;
        }
    }
}

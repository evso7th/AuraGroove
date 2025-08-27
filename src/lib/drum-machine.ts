
import * as Tone from 'tone';
import type { DrumNote } from '@/types/music';

const DRUM_SAMPLES = {
    'kick': '/assets/drums/kick_drum6.wav',
    'snare': '/assets/drums/snare.wav',
    'hat': '/assets/drums/closed_hi_hat_accented.wav',
    'crash': '/assets/drums/crash1.wav',
    'ride': '/assets/drums/cymbal1.wav', // Using cymbal1 as a ride substitute
};

export class DrumMachine {
    private players: Tone.Players;
    private isInitialized = false;
    private drumChannel: Tone.Channel;
    private readyPromise: Promise<void>;
    private resolveReady!: () => void;

    constructor(channel: Tone.Channel) {
        this.drumChannel = channel;
        this.readyPromise = new Promise(resolve => {
            this.resolveReady = resolve;
        });

        this.players = new Tone.Players({
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

    public scheduleDrumScore(score: DrumNote[], scoreStartTime: number) {
        if (!this.isReady()) {
            console.warn('[DRUM_TRACE] Drum machine not ready, skipping score.');
            return;
        }
        
        // Unmute the players in case they were stopped previously.
        this.players.mute = false;

        score.forEach(note => {
            if (this.players.has(note.sample)) {
                this.players.player(note.sample).start(scoreStartTime + note.time).volume.value = Tone.gainToDb(note.velocity);
            }
        });
        console.log(`[DRUM_TRACE] Scheduled ${score.length} drum notes.`);
    }

    public stopAll() {
        if (this.isReady()) {
            // Mute the players object. This is the most reliable way to instantly silence all scheduled and playing sounds.
            this.players.mute = true;
            console.log('[DRUM_TRACE] All drum sounds muted via stopAll.');
        }
    }
}

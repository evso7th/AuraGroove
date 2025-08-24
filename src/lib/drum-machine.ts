
import * as Tone from 'tone';
import type { DrumNote } from '@/types/music';

const DRUM_SAMPLES = {
    'kick': '/assets/drums/kick.wav',
    'snare': '/assets/drums/snare.wav',
    'hat': '/assets/drums/hat.wav',
    'crash': '/assets/drums/crash.wav',
    'ride': '/assets/drums/ride.wav',
};

export class DrumMachine {
    private players: Tone.Players;
    private isInitialized = false;
    private drumChannel: Tone.Channel;

    constructor(channel: Tone.Channel) {
        this.drumChannel = channel;
        this.players = new Tone.Players({
            urls: DRUM_SAMPLES,
            onload: () => {
                console.log('[DRUM_TRACE] Drum samples loaded.');
                this.isInitialized = true;
            },
            onerror: (error) => console.error('[DRUM_TRACE] Error loading drum samples:', error),
        }).connect(this.drumChannel);
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
        
        score.forEach(note => {
            if (this.players.has(note.sample)) {
                this.players.player(note.sample).start(scoreStartTime + note.time).volume.value = Tone.gainToDb(note.velocity);
            }
        });
        console.log(`[DRUM_TRACE] Scheduled ${score.length} drum notes.`);
    }

    public stopAll() {
        if (this.isReady()) {
            Object.keys(DRUM_SAMPLES).forEach(sample => {
                this.players.player(sample).stop();
            });
            console.log('[DRUM_TRACE] All drum sounds stopped.');
        }
    }
}

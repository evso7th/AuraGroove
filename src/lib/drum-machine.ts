
import type { ToneJS, DrumNote, DrumSampleName } from '@/types/music';

const DRUM_SAMPLES: Record<DrumSampleName, string> = {
    'kick': '/assets/drums/kick_drum6.wav',
    'snare': '/assets/drums/snare.wav',
    'hat': '/assets/drums/closed_hi_hat_accented.wav',
    'crash': '/assets/drums/crash1.wav',
    'ride': '/assets/drums/cymbal1.wav',
};

export class DrumMachine {
    private Tone: ToneJS;
    private sampler: any; // Tone.Players is not easily typed here, using any
    private isReady = false;
    public channel: Tone.Channel;

    constructor(Tone: ToneJS, channel: Tone.Channel) {
        this.Tone = Tone;
        this.channel = channel;
        this.sampler = new this.Tone.Players(DRUM_SAMPLES, () => {
            this.isReady = true;
            console.log('[DrumMachine] Samples loaded.');
        }).connect(this.channel);
    }

    public schedule(score: DrumNote[], time: number) {
        if (!this.isReady || score.length === 0) return;

        score.forEach(note => {
            if (this.sampler.has(note.sample)) {
                this.sampler.player(note.sample).start(time + (note.time * this.Tone.Time('4n').toSeconds()));
            }
        });
    }
}

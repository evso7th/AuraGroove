
import * as Tone from 'tone';

const SPARKLE_SAMPLES = {
    'merimbo': '/assets/music/droplets/merimbo.ogg',
    'icepad': '/assets/music/droplets/icepad.ogg',
    'vibes_a': '/assets/music/droplets/vibes_a.ogg',
    'sweepingbells': '/assets/music/droplets/sweepingbells.ogg',
    'belldom': '/assets/music/droplets/belldom.ogg',
};

export class SparklePlayer {
    private audioContext: AudioContext;
    private players: Tone.Players;
    private outputNode: AudioNode;
    public isInitialized = false;
    private sampleKeys: string[];

    constructor(audioContext: AudioContext, destination: AudioNode) {
        this.audioContext = audioContext;
        this.outputNode = destination;
        this.players = new Tone.Players().connect(this.outputNode);
        this.sampleKeys = Object.keys(SPARKLE_SAMPLES);
    }

    async init() {
        if (this.isInitialized) return;
        try {
            await new Promise((resolve, reject) => {
                this.players.add('merimbo', SPARKLE_SAMPLES.merimbo);
                this.players.add('icepad', SPARKLE_SAMPLES.icepad);
                this.players.add('vibes_a', SPARKLE_SAMPLES.vibes_a);
                this.players.add('sweepingbells', SPARKLE_SAMPLES.sweepingbells);
                this.players.add('belldom', SPARKLE_SAMPLES.belldom);
                Tone.loaded().then(resolve).catch(reject);
            });
            this.isInitialized = true;
            console.log('[SparklePlayer] Initialized and samples loaded.');
        } catch (e) {
            console.error('[SparklePlayer] Failed to initialize:', e);
        }
    }

    public playRandomSparkle(time: number) {
        if (!this.isInitialized || this.sampleKeys.length === 0) return;
        
        const randomKey = this.sampleKeys[Math.floor(Math.random() * this.sampleKeys.length)];
        const player = this.players.player(randomKey);

        if (player.loaded) {
            player.start(time);
        } else {
            console.warn(`[SparklePlayer] Sample not loaded: ${randomKey}`);
        }
    }
    
    public setVolume(volume: number) {
        if (this.outputNode instanceof GainNode) {
            this.outputNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
        }
    }

    public dispose() {
        this.players.dispose();
    }
}



const SPARKLE_SAMPLES = [
    '/assets/music/droplets/merimbo.ogg',
    '/assets/music/droplets/icepad.ogg',
    '/assets/music/droplets/vibes_a.ogg',
    '/assets/music/droplets/sweepingbells.ogg',
    '/assets/music/droplets/belldom.ogg',
    '/assets/music/droplets/dreams.mp3',
    '/assets/music/droplets/end.mp3',
    '/assets/music/droplets/ocean.mp3',
];

export class SparklePlayer {
    private audioContext: AudioContext;
    private gainNode: GainNode;
    private buffers: AudioBuffer[] = [];
    public isInitialized = false;

    constructor(audioContext: AudioContext, destination: AudioNode) {
        this.audioContext = audioContext;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(destination);
    }

    async init() {
        if (this.isInitialized) return;
        try {
            const loadPromises = SPARKLE_SAMPLES.map(async (url) => {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                return this.audioContext.decodeAudioData(arrayBuffer);
            });
            this.buffers = await Promise.all(loadPromises);
            this.isInitialized = true;
            console.log('[SparklePlayer] Initialized and samples loaded.');
        } catch (e) {
            console.error('[SparklePlayer] Failed to initialize:', e);
        }
    }

    public playRandomSparkle(time: number) {
        if (!this.isInitialized || this.buffers.length === 0) return;
        
        const buffer = this.buffers[Math.floor(Math.random() * this.buffers.length)];
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.gainNode);
        source.start(time);
    }
    
    public setVolume(volume: number) {
        this.gainNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
    }

    public dispose() {
        this.gainNode.disconnect();
    }
}

    
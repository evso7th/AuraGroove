

const PAD_SAMPLES: Record<string, string> = {
    'Drill.ogg': '/assets/music/pads/Drill.ogg',
    'HousedBass7.ogg': '/assets/music/pads/HousedBass7.ogg',
    'SweetHarpRev1.ogg': '/assets/music/pads/SweetHarpRev1.ogg',
    'GlassBell.ogg': '/assets/music/pads/GlassBell.ogg',
    'MelancholicPad.ogg': '/assets/music/pads/MelancholicPad.ogg',
    'CloseA.ogg': '/assets/music/pads/CloseA.ogg',
    'Starter.ogg': '/assets/music/pads/Starter.ogg',
    'Electricity.ogg': '/assets/music/pads/Electricity.ogg',
    'SalvingPad.ogg': '/assets/music/pads/SalvingPad.ogg',
    'Gulls.ogg': '/assets/music/pads/Gulls.ogg',
    'BirdFX.ogg': '/assets/music/pads/BirdFX.ogg',
    'Confusion.ogg': '/assets/music/pads/Confusion.ogg',
    'Abstruse.ogg': '/assets/music/pads/Abstruse.ogg',
    'Freakystones.ogg': '/assets/music/pads/Freakystones.ogg',
    'EPstein.ogg': '/assets/music/pads/EPstein.ogg',
    'Dizzy.ogg': '/assets/music/pads/Dizzy.ogg',
    'ElectroShock.ogg': '/assets/music/pads/ElectroShock.ogg',
    'E_Rhythm.ogg': '/assets/music/pads/E_Rhythm.ogg',
    'NoiseFxB06.ogg': '/assets/music/pads/NoiseFxB06.ogg',
    'BeepFreak.ogg': '/assets/music/pads/BeepFreak.ogg',
    'Koto1.ogg': '/assets/music/pads/Koto1.ogg',
    'BladeWalker.ogg': '/assets/music/pads/BladeWalker.ogg',
    'Fearsome.ogg': '/assets/music/pads/Fearsome.ogg',
    'AcChord.ogg': '/assets/music/pads/AcChord.ogg',
    'Tubator.ogg': '/assets/music/pads/Tubator.ogg',
    'Sleep.ogg': '/assets/music/pads/Sleep.ogg',
    'Grounding.ogg': '/assets/music/pads/Grounding.ogg',
    'livecircle.mp3': '/assets/music/pads/livecircle.mp3',
    'things.mp3': '/assets/music/pads/things.mp3',
    'pure_energy.mp3': '/assets/music/pads/pure_energy.mp3',
    'Tibetan bowls.mp3': '/assets/music/pads/Tibetan bowls.mp3',
    'uneverse.mp3': '/assets/music/pads/uneverse.mp3',
};

export class PadPlayer {
    private audioContext: AudioContext;
    private gainA: GainNode;
    private gainB: GainNode;
    private masterGain: GainNode;
    private sourceA: AudioBufferSourceNode | null = null;
    private sourceB: AudioBufferSourceNode | null = null;
    private buffers: Map<string, AudioBuffer> = new Map();
    private activeGain: 'A' | 'B' = 'A';
    public isInitialized = false;

    constructor(audioContext: AudioContext, destination: AudioNode) {
        this.audioContext = audioContext;
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(destination);

        this.gainA = audioContext.createGain();
        this.gainB = audioContext.createGain();
        
        this.gainA.connect(this.masterGain);
        this.gainB.connect(this.masterGain);

        this.gainA.gain.value = 1;
        this.gainB.gain.value = 0;
    }

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        console.log('[PadPlayer] Initialized for on-demand loading.');
    }

    private async loadBuffer(url: string): Promise<AudioBuffer> {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
            const arrayBuffer = await response.arrayBuffer();
            return this.audioContext.decodeAudioData(arrayBuffer);
        } catch (error) {
            console.error(`[PadPlayer] Failed to load buffer from ${url}`, error);
            throw error;
        }
    }
    
    private play(buffer: AudioBuffer, gainNode: GainNode): AudioBufferSourceNode {
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(gainNode);
        source.start(this.audioContext.currentTime);
        return source;
    }

    public async setPad(padName: string, time: number) {
        if (!this.isInitialized) return;

        let buffer = this.buffers.get(padName);
        if (!buffer) {
            const url = PAD_SAMPLES[padName];
            if (!url) {
                 console.warn(`[PadPlayer] Pad sample not found in library: ${padName}`);
                 return;
            }
            try {
                buffer = await this.loadBuffer(url);
                this.buffers.set(padName, buffer);
            } catch (e) {
                return; // Don't proceed if loading failed
            }
        }
        
        const fadeDuration = 5; // 5 second crossfade
        const rampTime = time + fadeDuration;

        if (this.activeGain === 'A') {
            // Fade to B
            this.sourceB?.stop();
            this.sourceB = this.play(buffer, this.gainB);
            this.gainA.gain.linearRampToValueAtTime(0, rampTime);
            this.gainB.gain.linearRampToValueAtTime(this.masterGain.gain.value, rampTime);
            this.activeGain = 'B';
        } else {
            // Fade to A
            this.sourceA?.stop();
            this.sourceA = this.play(buffer, this.gainA);
            this.gainA.gain.linearRampToValueAtTime(this.masterGain.gain.value, rampTime);
            this.gainB.gain.linearRampToValueAtTime(0, rampTime);
            this.activeGain = 'A';
        }
    }
    
    public setVolume(volume: number) {
        this.masterGain.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
        // Also update the target gain for the next crossfade
        const targetGain = this.masterGain.gain.value;
        if (this.activeGain === 'A') {
            this.gainA.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.01);
        } else {
            this.gainB.gain.setTargetAtTime(targetGain, this.audioContext.currentTime, 0.01);
        }
    }

    public stop() {
        this.sourceA?.stop();
        this.sourceB?.stop();
        this.sourceA = null;
        this.sourceB = null;
    }

    public dispose() {
        this.stop();
        this.gainA.disconnect();
        this.gainB.disconnect();
        this.masterGain.disconnect();
    }
}

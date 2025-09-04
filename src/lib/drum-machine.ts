
import type { SamplerNote } from "@/types/music";

const DRUM_SAMPLES = {
    'C4': '/assets/drums/kick_drum6.wav',
    'D4': '/assets/drums/snare.wav',
    'E4': '/assets/drums/closed_hi_hat_accented.wav',
    'F4': '/assets/drums/open_hh_top2.wav',
    'G4': '/assets/drums/crash1.wav',
    'A4': '/assets/drums/hightom.wav',
};

type Sampler = {
    buffers: Map<string, AudioBuffer>;
    load: (samples: Record<string, string>) => Promise<void>;
    triggerAttack: (note: string, time: number, velocity?: number) => void;
}

function createSampler(audioContext: AudioContext, output: AudioNode): Sampler {
    const buffers = new Map<string, AudioBuffer>();

    const load = async (samples: Record<string, string>) => {
        const promises = Object.entries(samples).map(async ([note, url]) => {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch sample: ${url} (${response.statusText})`);
                }
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                buffers.set(note, audioBuffer);
            } catch (error) {
                console.error(`Error loading sample ${note} from ${url}:`, error);
            }
        });
        await Promise.all(promises);
        console.log('[DrumMachine] All samples loaded.');
    };

    const triggerAttack = (note: string, time: number, velocity = 1) => {
        console.log(`[DrumMachine] DIAG: triggerAttack called for note: ${note} at time: ${time}`);
        const buffer = buffers.get(note);
        if (!buffer) {
            console.warn(`[DrumMachine] Sample for note ${note} not found.`);
            return;
        }

        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        const gainNode = audioContext.createGain();
        gainNode.gain.setValueAtTime(velocity, audioContext.currentTime);
        
        source.connect(gainNode);
        gainNode.connect(output);
        source.start(time);
    };

    return { buffers, load, triggerAttack };
}

export class DrumMachine {
    private audioContext: AudioContext;
    private sampler: Sampler | null = null;
    private volumeNode: GainNode;
    public isInitialized = false;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
        this.volumeNode = this.audioContext.createGain();
        this.volumeNode.connect(this.audioContext.destination);
    }

    async init() {
        if (this.isInitialized) return;
        this.sampler = createSampler(this.audioContext, this.volumeNode);
        await this.sampler.load(DRUM_SAMPLES);
        this.isInitialized = true;
    }
    
    getVolumeNode(): GainNode {
        return this.volumeNode;
    }

    setVolume(volume: number, time?: number) {
        if (time) {
            this.volumeNode.gain.linearRampToValueAtTime(volume, time);
        } else {
            this.volumeNode.gain.value = volume;
        }
    }

    schedule(score: SamplerNote[], time: number) {
        console.log(`[DrumMachine] DIAG: schedule called with ${score.length} notes.`);
        if (!this.sampler || !this.isInitialized) {
            console.warn('[DrumMachine] Tried to schedule score before initialization.');
            return;
        }
        
        for (const note of score) {
            this.sampler.triggerAttack(note.note, time + note.time, note.velocity);
        }
    }
}

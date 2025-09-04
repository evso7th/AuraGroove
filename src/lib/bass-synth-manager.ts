
import type { Note, BassInstrument } from "@/types/music";
import { BASS_PRESETS } from "./bass-presets";

export class BassSynthManager {
    private audioContext: AudioContext;
    private workletNode: AudioWorkletNode | null = null;
    private gainNode: GainNode;
    public isInitialized = false;

    constructor(audioContext: AudioContext, destination: AudioNode) {
        this.audioContext = audioContext;
        this.gainNode = this.audioContext.createGain();
        this.gainNode.connect(destination);
    }

    async init() {
        if (this.isInitialized) return;
        try {
            // We use a polyphonic processor for bass to handle potential overlaps and releases smoothly
            await this.audioContext.audioWorklet.addModule('/worklets/chord-processor.js');
            this.workletNode = new AudioWorkletNode(this.audioContext, 'chord-processor');
            this.workletNode.connect(this.gainNode);
            this.isInitialized = true;
            this.setPreset('glideBass'); // Set a default preset
            console.log('[BassSynthManager] Initialized successfully.');
        } catch (e) {
            console.error('[BassSynthManager] Failed to initialize:', e);
        }
    }
    
    public setVolume(volume: number) {
        this.gainNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
    }

    public schedule(notes: Note[], time: number) {
        if (!this.workletNode || !this.isInitialized) {
            console.warn('[BassSynthManager] Tried to schedule before initialized.');
            return;
        }
        
        this.workletNode.port.postMessage({
            type: 'playChord',
            notes: notes.map(n => ({ midi: n.midi, duration: n.duration })),
            stagger: 0, // No stagger for bass
            velocity: 0.8, // Bass is a bit louder
            when: time
        });
    }

    public setPreset(instrumentName: BassInstrument) {
        if (!this.workletNode || instrumentName === 'none') return;
        
        const preset = BASS_PRESETS[instrumentName];
        
        if (preset) {
             this.workletNode.port.postMessage({
                type: 'setPreset',
                ...preset
             });
        }
    }

    public stop() {
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'noteOff' });
        }
    }

    public dispose() {
        this.stop();
        this.workletNode?.disconnect();
    }
}

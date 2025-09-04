
import type { Note, BassInstrument, BassTechnique } from "@/types/music";
import { BASS_PRESETS } from "./bass-presets";

export class BassSynthManager {
    private audioContext: AudioContext;
    private workletNode: AudioWorkletNode | null = null;
    private outputNode: GainNode;
    public isInitialized = false;

    constructor(audioContext: AudioContext, destination: AudioNode) {
        this.audioContext = audioContext;
        this.outputNode = this.audioContext.createGain();
        this.outputNode.connect(destination);
    }

    async init() {
        if (this.isInitialized) return;
        try {
            await this.audioContext.audioWorklet.addModule('/worklets/bass-processor.js');
            this.workletNode = new AudioWorkletNode(this.audioContext, 'bass-processor');
            this.workletNode.connect(this.outputNode);
            this.isInitialized = true;
            this.setPreset('glideBass'); 
            this.setTechnique('arpeggio');
            console.log('[BassSynthManager] Initialized successfully with new bass-processor.');
        } catch (e) {
            console.error('[BassSynthManager] Failed to initialize:', e);
        }
    }
    
    public setVolume(volume: number) {
        if(this.outputNode instanceof GainNode){
            this.outputNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
        }
    }

    public schedule(notes: Note[], time: number) {
        if (!this.workletNode || !this.isInitialized) {
            console.warn('[BassSynthManager] Tried to schedule before initialized.');
            return;
        }
        
        this.workletNode.port.postMessage({
            type: 'playNotes',
            notes: notes.map(n => ({ midi: n.midi, duration: n.duration, velocity: n.velocity })),
            when: time
        });
    }

    public setPreset(instrumentName: BassInstrument) {
        if (!this.workletNode || instrumentName === 'none') {
             if(this.workletNode) this.workletNode.port.postMessage({ type: 'noteOff' });
             return;
        };
        
        const preset = BASS_PRESETS[instrumentName];
        
        if (preset) {
             this.workletNode.port.postMessage({
                type: 'setPreset',
                ...preset
             });
        }
    }

    public setTechnique(technique: BassTechnique) {
        if (!this.workletNode) return;
        this.workletNode.port.postMessage({ type: 'setMode', mode: technique });
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

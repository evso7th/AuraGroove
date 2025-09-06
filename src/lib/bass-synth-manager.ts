
import type { Note, BassInstrument, BassTechnique } from "@/types/music";
import { BASS_PRESETS } from "./bass-presets";

export class BassSynthManager {
    private audioContext: AudioContext;
    private workletNode: AudioWorkletNode | null = null;
    private outputNode: GainNode;
    public isInitialized = false;
    private scheduledTimeouts = new Set<NodeJS.Timeout>();

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
        } catch (e) {
            console.error('[BassSynthManager] Failed to initialize:', e);
        }
    }
    
    public setVolume(volume: number) {
        if(this.outputNode instanceof GainNode){
            this.outputNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
        }
    }

    public schedule(notes: Note[], startTime: number) {
        if (!this.workletNode || !this.isInitialized) {
            console.warn('[BassSynthManager] Tried to schedule before initialized.');
            return;
        }
        
        notes.forEach(note => {
            const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
            if (isNaN(freq)) {
                console.error('[BassSynthManager] NaN frequency for note:', note);
                return;
            }

            const noteOnTime = startTime + note.time;
            const noteOffTime = noteOnTime + note.duration;

            // Schedule Note On
            this.workletNode!.port.postMessage({
                type: 'noteOn',
                frequency: freq,
                velocity: note.velocity,
                when: noteOnTime
            });

            // Schedule Note Off using main thread's setTimeout, ensuring it's sample-accurate with audioContext.currentTime
            const delayUntilOff = (noteOffTime - this.audioContext.currentTime) * 1000;

            if (delayUntilOff > 0) {
                const timeoutId = setTimeout(() => {
                    if (this.workletNode) {
                        this.workletNode.port.postMessage({ type: 'noteOff' });
                    }
                    this.scheduledTimeouts.delete(timeoutId);
                }, delayUntilOff);
                this.scheduledTimeouts.add(timeoutId);
            }
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

    public allNotesOff() {
        this.stop();
    }

    public stop() {
        // Clear all scheduled note-off events
        this.scheduledTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.scheduledTimeouts.clear();
        
        // Immediately stop any currently playing note in the worklet
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'noteOff' });
        }
    }

    public dispose() {
        this.stop();
        this.workletNode?.disconnect();
    }
}


import type { Note, MelodyInstrument } from "@/types/music";
import { getPresetParams } from "./presets";

export class AccompanimentSynthManager {
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
            await this.audioContext.audioWorklet.addModule('/worklets/chord-processor.js');
            this.workletNode = new AudioWorkletNode(this.audioContext, 'chord-processor');
            this.workletNode.connect(this.gainNode);
            this.isInitialized = true;
            this.setPreset('synth'); // Set a default preset
            console.log('[AccompanimentManager] Initialized successfully.');
        } catch (e) {
            console.error('[AccompanimentManager] Failed to initialize:', e);
        }
    }
    
    public setVolume(volume: number) {
        this.gainNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
    }

    public schedule(notes: Note[], time: number) {
        console.log('[AccompanimentManager] Scheduling notes:', notes);
        if (!this.workletNode || !this.isInitialized) {
            console.warn('[AccompanimentManager] Tried to schedule before initialized.');
            return;
        }
        
        // The worklet handles timing internally based on `when`, so we send the absolute time.
        this.workletNode.port.postMessage({
            type: 'playChord',
            notes: notes.map(n => ({ midi: n.midi, duration: n.duration })),
            stagger: 0.05, // Create a slight arpeggio effect
            velocity: 0.6,
            when: time
        });
    }

    public setPreset(instrumentName: MelodyInstrument) {
        if (!this.workletNode || instrumentName === 'none') return;
        // We use a placeholder note because getPresetParams needs one, but the chord processor
        // only cares about the preset parameters, not the note-specific ones.
        const placeholderNote: Note = { midi: 60, time: 0, duration: 1 };
        const params = getPresetParams(instrumentName, placeholderNote);
        
        if (params) {
             this.workletNode.port.postMessage({
                type: 'setPreset',
                wave: params.oscType,
                cutoff: params.filterCutoff,
                attack: params.attack,
                release: params.release,
                portamento: params.portamento,
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


import type { Note, MelodyInstrument } from "@/types/music";
import { getPresetParams } from "./presets";

export class AccompanimentSynthManager {
    private audioContext: AudioContext;
    private workletNode: AudioWorkletNode | null = null;
    private gainNode: GainNode;
    public isInitialized = false;
    private scheduledTimeouts = new Set<NodeJS.Timeout>();

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
        } catch (e) {
            console.error('[AccompanimentManager] Failed to initialize:', e);
        }
    }
    
    public setVolume(volume: number) {
        this.gainNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
    }

    public schedule(notes: Note[], time: number) {
        if (!this.workletNode || !this.isInitialized) {
            console.warn('[AccompanimentManager] Tried to schedule before initialized.');
            return;
        }

        const chordNotes = notes.map(n => ({ midi: n.midi, duration: n.duration, velocity: n.velocity ?? 0.6 }));
        const maxDuration = Math.max(...notes.map(n => n.duration));

        if (chordNotes.length === 0) return;
        
        // Schedule Note On for the chord
        const noteOnTime = time;
        this.workletNode.port.postMessage({
            type: 'playChord',
            notes: chordNotes,
            stagger: 0.05,
            when: noteOnTime
        });

        // Schedule Note Off for the chord
        const noteOffTime = noteOnTime + maxDuration;
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
    }


    public setPreset(instrumentName: MelodyInstrument) {
        if (!this.workletNode || instrumentName === 'none') return;
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

    public allNotesOff() {
        this.stop();
    }

    public stop() {
        this.scheduledTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.scheduledTimeouts.clear();
        if (this.workletNode) {
            this.workletNode.port.postMessage({ type: 'noteOff' });
        }
    }

    public dispose() {
        this.stop();
        this.workletNode?.disconnect();
    }
}

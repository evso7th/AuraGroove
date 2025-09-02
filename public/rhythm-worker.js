
/**
 * @file Rhythm Frame Worker
 * This script runs inside the rhythm-frame.html iframe.
 * It is responsible for all rhythm-related audio synthesis (Drums and Bass).
 */

import * as Tone from 'tone';
import type { DrumNote, SynthNote, DrumSampleName, InstrumentSettings } from '@/types/music';

// --- Re-implementing simplified managers inside the frame ---

const DRUM_SAMPLES: Record<DrumSampleName, string> = {
    'kick': '/assets/drums/kick_drum6.wav',
    'snare': '/assets/drums/snare.wav',
    'hat': '/assets/drums/closed_hi_hat_accented.wav',
    'crash': '/assets/drums/crash1.wav',
    'ride': '/assets/drums/cymbal1.wav',
};

class DrumMachine {
    private sampler: Tone.Players;
    isReady = false;

    constructor(channel: Tone.Channel) {
        this.sampler = new Tone.Players(DRUM_SAMPLES, () => {
            this.isReady = true;
            console.log('[Rhythm-Frame] Drum samples loaded.');
        }).connect(channel);
    }

    schedule(score: DrumNote[], time: number) {
        if (!this.isReady || score.length === 0) return;
        score.forEach(note => {
            if (this.sampler.has(note.sample)) {
                this.sampler.player(note.sample).start(time + note.time * Tone.Time('4n').toSeconds(), 0, undefined, note.velocity);
            }
        });
    }
}

type BassInstrument = 'bassGuitar' | 'BassGroove' | 'portamento' | 'portamentoMob' | 'BassGrooveMob' | 'none';

class BassSynthManager {
    private synths: Record<string, any> = {};
    private activeInstrument: BassInstrument = 'portamento';
    private isPlaying = false;

    constructor(private channel: Tone.Channel) {
        this.createPresets();
        this.setInstrument(this.activeInstrument);
    }

    private createPresets() {
        this.synths.portamento = new Tone.MonoSynth({
            portamento: 0.2, 
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.9, release: 4.0 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 5.0, baseFrequency: 200, octaves: 7 }
        }).connect(this.channel);
    }
    
    private getActiveSynth() {
        return this.synths[this.activeInstrument] || null;
    }

    public setInstrument(name: BassInstrument) {
       const currentSynth = this.getActiveSynth();
       if (this.isPlaying && currentSynth) {
           currentSynth.triggerRelease();
           this.isPlaying = false;
       }
       this.activeInstrument = name;
    }

    public schedule(score: SynthNote[], time: number) {
        const activeSynth = this.getActiveSynth();
        if (this.activeInstrument === 'none' || !activeSynth) return;

        if (score.length === 0) {
            if (this.isPlaying) {
                activeSynth.triggerRelease(time);
                this.isPlaying = false;
            }
            return;
        }
        
        score.forEach(note => {
            const scheduledTime = time + (note.time * Tone.Time('4n').toSeconds());
            const noteName = note.note as string;
            
             if (!this.isPlaying) {
                activeSynth.triggerAttack(noteName, scheduledTime, note.velocity);
                this.isPlaying = true;
            } else {
                activeSynth.setNote(noteName, scheduledTime);
            }
        });
    }

    public stopAll() {
        if (this.isPlaying) {
            const activeSynth = this.getActiveSynth();
            if (activeSynth) activeSynth.triggerRelease();
            this.isPlaying = false;
        }
    }
}


// --- Main Logic ---

let isEngineRunning = false;

const channels = {
    drums: new Tone.Channel().toDestination(),
    bass: new Tone.Channel().toDestination(),
};
const drumMachine = new DrumMachine(channels.drums);
const bassManager = new BassSynthManager(channels.bass);

window.addEventListener('message', async (event) => {
    if (!event.data || !event.data.command) return;

    const { command, payload, time } = event.data;

    if (command === 'start' && !isEngineRunning) {
        isEngineRunning = true;
        await Tone.start();
        console.log('[Rhythm-Frame] AudioContext started.');
    } else if (command === 'stop') {
        isEngineRunning = false;
        bassManager.stopAll();
    } else if (command === 'schedule' && isEngineRunning && payload && time) {
        drumMachine.schedule(payload.drumScore, time);
        bassManager.schedule(payload.bassScore, time);
    } else if (command === 'payload' && payload.instrumentSettings) {
        const settings = payload.instrumentSettings as InstrumentSettings;
        bassManager.setInstrument(settings.bass.name);
    }
});

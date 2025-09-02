
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
            console.log('[RHYTHM FRAME] Drum samples loaded.');
        }).connect(channel);
    }

    schedule(score: DrumNote[], time: number) {
        console.log(`[RHYTHM FRAME] DrumMachine.schedule called. Notes: ${score.length}. Time: ${time}. Ready: ${this.isReady}`);
        if (!this.isReady || score.length === 0) return;
        score.forEach(note => {
            if (this.sampler.has(note.sample)) {
                const scheduleTime = time + note.time * Tone.Time('4n').toSeconds();
                console.log(`[RHYTHM FRAME] Tone.js scheduling DRUM: ${note.sample} at ${scheduleTime}`);
                this.sampler.player(note.sample).start(scheduleTime, 0, undefined, note.velocity);
            } else {
                console.warn(`[RHYTHM FRAME] Sample not found: ${note.sample}`);
            }
        });
    }
}

type BassInstrument = 'bassGuitar' | 'BassGroove' | 'portamento' | 'portamentoMob' | 'BassGrooveMob' | 'none';

class BassSynthManager {
    private synths: Record<string, any> = {};
    private activeInstrument: BassInstrument = 'portamento';
    private isPlaying = false;
    private channel: Tone.Channel;

    constructor(channel: Tone.Channel) {
        this.channel = channel;
        this.createPresets();
        this.setInstrument(this.activeInstrument);
    }

    private createPresets() {
        this.synths.portamento = new Tone.MonoSynth({
            portamento: 0.2, 
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.9, release: 4.0 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 5.0, baseFrequency: 200, octaves: 7 }
        });
         this.synths.portamento.connect(this.channel);
    }
    
    private getActiveSynth() {
        return this.synths[this.activeInstrument] || null;
    }

    public setInstrument(name: BassInstrument) {
       console.log(`[RHYTHM FRAME] Setting bass instrument to: ${name}`);
       const currentSynth = this.getActiveSynth();
       if (this.isPlaying && currentSynth) {
           currentSynth.triggerRelease();
           this.isPlaying = false;
       }
       this.activeInstrument = name;
    }

    public schedule(score: SynthNote[], time: number) {
        console.log(`[RHYTHM FRAME] BassManager.schedule called. Notes: ${score.length}. Time: ${time}. Instrument: ${this.activeInstrument}`);
        const activeSynth = this.getActiveSynth();
        if (this.activeInstrument === 'none' || !activeSynth) {
            console.log(`[RHYTHM FRAME] Bass synth is inactive or preset not found.`);
            return;
        }

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
                console.log(`[RHYTHM FRAME] Tone.js ATTACK bass: ${noteName} at ${scheduledTime}`);
                activeSynth.triggerAttack(noteName, scheduledTime, note.velocity);
                this.isPlaying = true;
            } else {
                console.log(`[RHYTHM FRAME] Tone.js SET bass note: ${noteName} at ${scheduledTime}`);
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
let hasAudioContextStarted = false;

const channels = {
    drums: new Tone.Channel(-6).toDestination(),
    bass: new Tone.Channel(-6).toDestination(),
};
const drumMachine = new DrumMachine(channels.drums);
const bassManager = new BassSynthManager(channels.bass);

window.addEventListener('message', async (event) => {
    if (!event.data || !event.data.command) return;

    const { command, payload, time } = event.data;
     console.log(`[RHYTHM FRAME] Received command: ${command}`, { payload, time });

    if (command === 'init') {
         console.log('[RHYTHM FRAME] Init command received.');
         // Nothing to do here, Tone.js is ready.
         return;
    }

    // The first 'start' command MUST initialize the audio context.
    if (command === 'start' && !hasAudioContextStarted) {
        await Tone.start();
        hasAudioContextStarted = true;
        console.log('[RHYTHM FRAME] AudioContext started by user interaction.');
    }
    
    if (command === 'start') {
        isEngineRunning = true;
        console.log('[RHYTHM FRAME] Engine started.');
    } else if (command === 'stop') {
        isEngineRunning = false;
        bassManager.stopAll();
        console.log('[RHYTHM FRAME] Engine stopped.');
    } else if (command === 'schedule' && isEngineRunning && payload && typeof time === 'number') {
        console.log(`[RHYTHM FRAME] Processing schedule command for time ${time}`);
        drumMachine.schedule(payload.drumScore, time);
        bassManager.schedule(payload.bassScore, time);
    } else if (command === 'set_param' && payload) {
        const { target, key, value } = payload;
        switch (target) {
            case 'bass':
                if (key === 'name') bassManager.setInstrument(value);
                if (key === 'volume') channels.bass.volume.value = Tone.gainToDb(value);
                break;
            case 'drums':
                if (key === 'volume') channels.drums.volume.value = Tone.gainToDb(value);
                break;
            case 'transport':
                 if (key === 'bpm') Tone.Transport.bpm.value = value;
                break;
        }
    }
});

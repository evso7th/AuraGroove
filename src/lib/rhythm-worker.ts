
/**
 * @file Rhythm Frame Worker
 * This script runs inside the rhythm-frame.html iframe.
 * It is responsible for all rhythm-related audio synthesis (Drums and Bass).
 * It is now the "Conductor" of the entire application.
 */

import * as Tone from 'tone';
import type { DrumNote, SynthNote, DrumSampleName } from '@/types/music';

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
        if (!this.isReady || score.length === 0) return;
        
        const barDuration = Tone.Time('1m').toSeconds();

        score.forEach(note => {
            if (this.sampler.has(note.sample)) {
                // Note time is in beats, convert to seconds relative to bar start
                const noteTimeOffset = (note.time / 4) * barDuration;
                const scheduleTime = time + noteTimeOffset;
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
        }).connect(this.channel);
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
        const activeSynth = this.getActiveSynth();
        if (this.activeInstrument === 'none' || !activeSynth) {
            if(this.isPlaying) activeSynth?.triggerRelease(time);
            this.isPlaying = false;
            return;
        }

        if (score.length === 0) {
            if (this.isPlaying) {
                activeSynth.triggerRelease(time);
                this.isPlaying = false;
            }
            return;
        }
        
         const barDuration = Tone.Time('1m').toSeconds();

        score.forEach(note => {
            const noteTimeOffset = (note.time / 4) * barDuration;
            const scheduledTime = time + noteTimeOffset;
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
            if (activeSynth) activeSynth.triggerRelease(Tone.now());
            this.isPlaying = false;
        }
    }
}


// --- Main Logic ---

let hasAudioContextStarted = false;
let scoreRequestLoop: Tone.Loop | null = null;
let scheduledTime = 0;


const channels = {
    drums: new Tone.Channel(-6).toDestination(),
    bass: new Tone.Channel(-6).toDestination(),
};
const drumMachine = new DrumMachine(channels.drums);
const bassManager = new BassSynthManager(channels.bass);

function startEngine() {
    if (Tone.Transport.state === 'started') return;
    
    // Request the first score immediately
    parent.postMessage({ type: 'request_score' }, '*');
    scheduledTime = Tone.now() + 0.2; // Add latency

    // Start the loop that will request subsequent scores
    scoreRequestLoop = new Tone.Loop(time => {
         // This loop is now the single source of truth for timing.
         // It runs slightly ahead of the beat.
        parent.postMessage({ type: 'request_score' }, '*');
    }, '1m').start(0);

    Tone.Transport.start();
    console.log('[RHYTHM FRAME] Transport started.');
}

function stopEngine() {
    Tone.Transport.stop();
    scoreRequestLoop?.stop(0);
    bassManager.stopAll();
    console.log('[RHYTHM FRAME] Transport stopped.');
}


window.addEventListener('message', async (event) => {
    if (!event.data || !event.data.command) return;

    const { command, payload } = event.data;
     // console.log(`[RHYTHM FRAME] Received command: ${command}`, { payload });

    if (command === 'init') {
         console.log('[RHYTHM FRAME] Init command received.');
         return;
    }

    // The first 'start' command MUST initialize the audio context.
    if (!hasAudioContextStarted && (command === 'start' || command === 'schedule')) {
        await Tone.start();
        hasAudioContextStarted = true;
        console.log('[RHYTHM FRAME] AudioContext started by user interaction.');
    }
    
    if (command === 'start') {
        startEngine();
    } else if (command === 'stop') {
        stopEngine();
    } else if (command === 'schedule' && payload) {
        if (Tone.Transport.state !== 'started') return; // Don't schedule if stopped

        drumMachine.schedule(payload.drumScore, scheduledTime);
        bassManager.schedule(payload.bassScore, scheduledTime);
        
        // Advance the schedule time for the next bar
        scheduledTime += payload.barDuration;

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

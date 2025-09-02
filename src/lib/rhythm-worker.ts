/**
 * @file Rhythm Frame Worker
 * This script runs inside the rhythm-frame.html iframe.
 * It is responsible for all rhythm-related audio synthesis (Drums and Bass).
 * It is now the "Conductor" of the entire application.
 */

import * as Tone from 'tone';
import type { DrumNote, SynthNote, DrumSampleName } from '@/types/music';

// This makes TypeScript happy, as it doesn't know about the global Tone object from the CDN
declare const Tone: any;

// --- Re-implementing simplified managers inside the frame ---

const DRUM_SAMPLES: Record<DrumSampleName, string> = {
    'kick': '/assets/drums/kick_drum6.wav',
    'snare': '/assets/drums/snare.wav',
    'hat': '/assets/drums/closed_hi_hat_accented.wav',
    'crash': '/assets/drums/crash1.wav',
    'ride': '/assets/drums/cymbal1.wav',
};

class DrumMachine {
    private sampler: any; // Tone.Players
    isReady = false;

    constructor(channel: any) { // Tone.Channel
        this.sampler = new Tone.Players(DRUM_SAMPLES, () => {
            this.isReady = true;
            console.log('[RHYTHM FRAME] Drum samples loaded.');
        }).connect(channel);
    }

    schedule(score: DrumNote[], time: number) {
        if (!this.isReady || !score || score.length === 0) return;
        
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
    private synths: Record<string, any> = {}; // Tone.MonoSynth
    private activeInstrument: BassInstrument = 'portamento';
    private isPlaying = false;
    private channel: any; // Tone.Channel

    constructor(channel: any) { // Tone.Channel
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
         this.synths.portamentoMob = new Tone.MonoSynth({
            portamento: 0.2, 
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.9, release: 1.6 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 2.0, baseFrequency: 200, octaves: 7 }
        }).connect(this.channel);
        this.synths.bassGuitar = new Tone.MonoSynth({
             oscillator: { type: 'fmsine' },
             envelope: { attack: 0.05, decay: 0.3, sustain: 0.1, release: 0.8 },
             filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 1.0, baseFrequency: 300, octaves: 5 }
        }).connect(this.channel);
    }
    
    private getActiveSynth() {
        // A bit of logic to handle the simplified presets for now
        if (this.activeInstrument === 'BassGroove' || this.activeInstrument === 'BassGrooveMob') {
            return this.synths.bassGuitar;
        }
        return this.synths[this.activeInstrument] || null;
    }

    public setInstrument(name: BassInstrument) {
       console.log(`[RHYTHM FRAME] Setting bass instrument to: ${name}`);
       const currentSynth = this.getActiveSynth();
       if (this.isPlaying && currentSynth) {
           currentSynth.triggerRelease(Tone.now());
           this.isPlaying = false;
       }
       this.activeInstrument = name;
    }

    public schedule(score: SynthNote[], time: number) {
        const activeSynth = this.getActiveSynth();
        if (this.activeInstrument === 'none' || !activeSynth) {
            if(this.isPlaying && activeSynth) activeSynth.triggerRelease(time);
            this.isPlaying = false;
            return;
        }

        if (!score || score.length === 0) {
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
let scoreRequestLoop: any | null = null; // Tone.Loop
let scheduledTime = 0;

let drumMachine: DrumMachine | null = null;
let bassManager: BassSynthManager | null = null;
let channels: { drums: any, bass: any } | null = null; // Tone.Channel


function startEngine() {
    if (Tone.Transport.state === 'started') return;
    
    // Request the first score immediately
    parent.postMessage({ type: 'request_score' }, '*');
    scheduledTime = Tone.now() + 0.2; // Add latency

    // Start the loop that will request subsequent scores
    scoreRequestLoop = new Tone.Loop((time: number) => {
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
    bassManager?.stopAll();
    console.log('[RHYTHM FRAME] Transport stopped.');
}

async function initAudio() {
    try {
        if (hasAudioContextStarted) return;
        await Tone.start();
        hasAudioContextStarted = true;
        console.log('[RHYTHM FRAME] AudioContext started.');

        channels = {
            drums: new Tone.Channel(-6).toDestination(),
            bass: new Tone.Channel(-6).toDestination(),
        };
        drumMachine = new DrumMachine(channels.drums);
        bassManager = new BassSynthManager(channels.bass);

        // Notify the main app that we are ready
        parent.postMessage({ type: 'rhythm_frame_ready' }, '*');

    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        console.error('[RHYTHM FRAME] Error starting AudioContext:', errorMsg);
        parent.postMessage({ type: 'error', error: errorMsg }, '*');
    }
}


window.addEventListener('message', async (event) => {
    if (!event.data || !event.data.command) return;

    const { command, payload } = event.data;

    if (command === 'init') {
        initAudio();
        return;
    }
    
    if (!hasAudioContextStarted) {
        console.warn("[RHYTHM FRAME] Received command before AudioContext was started. Please 'init' first.");
        return;
    }
    
    if (command === 'start') {
        startEngine();
    } else if (command === 'stop') {
        stopEngine();
    } else if (command === 'schedule' && payload) {
        if (Tone.Transport.state !== 'started') return; // Don't schedule if stopped

        drumMachine?.schedule(payload.drumScore, scheduledTime);
        bassManager?.schedule(payload.bassScore, scheduledTime);
        
        // Advance the schedule time for the next bar
        scheduledTime += payload.barDuration;

    } else if (command === 'set_param' && payload) {
        const { target, key, value } = payload;
        switch (target) {
            case 'bass':
                if (key === 'name' && bassManager) bassManager.setInstrument(value);
                if (key === 'volume' && channels) channels.bass.volume.value = Tone.gainToDb(value);
                break;
            case 'drums':
                if (key === 'volume' && channels) channels.drums.volume.value = Tone.gainToDb(value);
                break;
            case 'transport':
                 if (key === 'bpm') Tone.Transport.bpm.value = value;
                break;
        }
    }
});

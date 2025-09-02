
// This script runs in a separate iframe to isolate the Tone.js audio context.
// It handles all direct audio synthesis for rhythm parts (Drums, Bass).
// It cannot directly import other TS files, so dependencies must be minimal or self-contained.

// --- Main Logic ---

// We need to wait for the main page to send the Tone.js library
// since we can't use modules/imports in this simple script.
let Tone;
let hasInitialized = false;

// --- Audio Components (will be initialized later) ---
let channels;
let drumMachine;
let bassManager;
let scoreRequestLoop = null;
let scheduledTime = 0;


// --- Component Definitions ---

const DRUM_SAMPLES = {
    'kick': '/assets/drums/kick_drum6.wav',
    'snare': '/assets/drums/snare.wav',
    'hat': '/assets/drums/closed_hi_hat_accented.wav',
    'crash': '/assets/drums/crash1.wav',
    'ride': '/assets/drums/cymbal1.wav',
};

class DrumMachine {
    sampler;
    isReady = false;

    constructor(channel) {
        this.sampler = new Tone.Players(DRUM_SAMPLES, () => {
            this.isReady = true;
            console.log('[RHYTHM FRAME] Drum samples loaded.');
        }).connect(channel);
    }

    schedule(score, time) {
        if (!this.isReady || !score || score.length === 0) return;
        
        const barDuration = Tone.Time('1m').toSeconds();

        score.forEach(note => {
            if (this.sampler.has(note.sample)) {
                const noteTimeOffset = (note.time / 4) * barDuration;
                const scheduleTime = time + noteTimeOffset;
                this.sampler.player(note.sample).start(scheduleTime, 0, undefined, note.velocity);
            }
        });
    }
}


class BassSynthManager {
    synths = {};
    activeInstrument = 'portamento';
    isPlaying = false;
    channel;

    constructor(channel) {
        this.channel = channel;
        this.createPresets();
        this.setInstrument(this.activeInstrument);
    }

    createPresets() {
        this.synths.portamento = new Tone.MonoSynth({
            portamento: 0.1, 
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.9, release: 4.0 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 5.0, baseFrequency: 200, octaves: 7 }
        }).connect(this.channel);

         this.synths.portamentoMob = new Tone.MonoSynth({
            portamento: 0.1,
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.1, decay: 0.3, sustain: 0.9, release: 2.0 },
        }).connect(this.channel);

        this.synths.bassGuitar = new Tone.MonoSynth({
            oscillator: { type: 'fmsine' },
            envelope: { attack: 0.05, decay: 0.8, sustain: 0.1, release: 0.8 },
        }).connect(this.channel);

        // BassGroove is a layered synth, which is more complex to manage here.
        // For now, we'll use a single synth as a placeholder.
        this.synths.BassGroove = new Tone.MonoSynth({
            oscillator: { type: 'fatsawtooth', count: 3 },
            envelope: { attack: 0.05, decay: 0.5, sustain: 0.4, release: 1.0 },
            filter: { type: 'lowpass', Q: 2, rolloff: -24 },
            filterEnvelope: { attack: 0.05, decay: 0.2, sustain: 0.1, release: 1, baseFrequency: 150, octaves: 4 }
        }).connect(this.channel);
        this.synths.BassGrooveMob = this.synths.BassGroove; // Use same for mobile for now
    }
    
    getActiveSynth() {
        return this.synths[this.activeInstrument] || null;
    }

    setInstrument(name) {
       const currentSynth = this.getActiveSynth();
       if (this.isPlaying && currentSynth && currentSynth.releaseAll) {
           currentSynth.releaseAll();
       } else if (this.isPlaying && currentSynth) {
           currentSynth.triggerRelease();
       }
       this.isPlaying = false;
       this.activeInstrument = name;
    }

    schedule(score, time) {
        const activeSynth = this.getActiveSynth();
        if (this.activeInstrument === 'none' || !activeSynth) {
            if(this.isPlaying) {
                 if(activeSynth.releaseAll) activeSynth.releaseAll(); else activeSynth.triggerRelease();
            }
            this.isPlaying = false;
            return;
        }

        if (!score || score.length === 0) {
            if (this.isPlaying) {
                 if(activeSynth.releaseAll) activeSynth.releaseAll(time); else activeSynth.triggerRelease(time);
                 this.isPlaying = false;
            }
            return;
        }
        
        const barDuration = Tone.Time('1m').toSeconds();

        score.forEach(note => {
            const noteTimeOffset = (note.time / 4) * barDuration;
            const scheduledTime = time + noteTimeOffset;
            const noteName = note.note; // Already a string or array of strings
            
            // For portamento, we use setNote for subsequent notes
            if (this.isPlaying && this.activeInstrument.includes('portamento')) {
                 if(Array.isArray(noteName)) activeSynth.setNote(noteName[0], scheduledTime);
                 else activeSynth.setNote(noteName, scheduledTime);
            } else {
                // For other synths or the first note, we trigger attack/release
                if(activeSynth.releaseAll) activeSynth.releaseAll();
                activeSynth.triggerAttackRelease(noteName, note.duration * (60 / Tone.Transport.bpm.value), scheduledTime, note.velocity);
                this.isPlaying = true;
            }
        });
    }

    stopAll() {
        const activeSynth = this.getActiveSynth();
        if (this.isPlaying && activeSynth) {
            if (activeSynth.releaseAll) {
                activeSynth.releaseAll();
            } else {
                activeSynth.triggerRelease(Tone.now());
            }
            this.isPlaying = false;
        }
    }
}


function startEngine() {
    if (Tone.Transport.state === 'started') return;
    
    parent.postMessage({ type: 'request_score' }, '*');
    scheduledTime = Tone.now() + 0.2; 

    scoreRequestLoop = new Tone.Loop(time => {
        parent.postMessage({ type: 'request_score' }, '*');
    }, '1m').start(0);

    Tone.Transport.start();
}

function stopEngine() {
    Tone.Transport.stop();
    scoreRequestLoop?.stop(0).dispose();
    scoreRequestLoop = null;
    bassManager.stopAll();
}

async function initAudio() {
    if (hasInitialized) return;
    try {
        await Tone.start();
        console.log('[RHYTHM FRAME] AudioContext started.');
        
        channels = {
            drums: new Tone.Channel(-6).toDestination(),
            bass: new Tone.Channel(-6).toDestination(),
        };
        drumMachine = new DrumMachine(channels.drums);
        bassManager = new BassSynthManager(channels.bass);

        hasInitialized = true;
        parent.postMessage({ type: 'rhythm_frame_ready' }, '*');
    } catch (e) {
        console.error('[RHYTHM FRAME] Error starting AudioContext:', e);
        parent.postMessage({ type: 'error', error: e.message }, '*');
    }
}

// --- Message Handling ---
window.addEventListener('message', async (event) => {
    // Only accept messages from the parent window
    if (event.source !== parent) {
        return;
    }
    
    // Tone.js library is sent from the parent
    if (event.data.type === 'tone-library') {
        // This is a trick to load the library in the worker scope
        eval(event.data.library);
        Tone = window.Tone;
        return;
    }

    if (!event.data.command) return;
    
    const { command, payload } = event.data;

    // The 'init' command is now the user gesture trigger
    if (command === 'init') {
        await initAudio();
        return;
    }

    // All other commands must wait for initialization
    if (!hasInitialized) {
        console.warn('[RHYTHM FRAME] Received command before initialization:', command);
        return;
    }
    
    switch(command) {
        case 'start':
            startEngine();
            break;
        case 'stop':
            stopEngine();
            break;
        case 'schedule':
            if (payload && Tone.Transport.state === 'started') {
                drumMachine.schedule(payload.drumScore, scheduledTime);
                bassManager.schedule(payload.bassScore, scheduledTime);
                scheduledTime += payload.barDuration;
            }
            break;
        case 'set_param':
            if (payload) {
                const { target, key, value } = payload;
                switch (target) {
                    case 'bass':
                        if (key === 'name') bassManager.setInstrument(value);
                        if (key === 'volume' && channels.bass) channels.bass.volume.value = Tone.gainToDb(value);
                        break;
                    case 'drums':
                        if (key === 'volume' && channels.drums) channels.drums.volume.value = Tone.gainToDb(value);
                        break;
                    case 'transport':
                        if (key === 'bpm') Tone.Transport.bpm.value = value;
                        break;
                }
            }
            break;
    }
});

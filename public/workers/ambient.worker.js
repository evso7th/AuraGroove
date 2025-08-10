
"use strict";

let sampleRate = 44100;
let isPlaying = false;
let audioChunkQueue = [];
let nextChunkTime = 0;
let chunkDuration = 0.5; // 500ms audio chunks
let chunkSampleCount = Math.floor(chunkDuration * sampleRate);
let scheduleTimeoutId = null;

let beat = 0;
let time = 0;

let instruments = {
    solo: 'none',
    accompaniment: 'none',
    bass: 'none',
};
let drumsEnabled = true;
let drumSamples = {};

// --- Oscillators ---
function sine(t, freq) {
    return Math.sin(2 * Math.PI * t * freq);
}

function square(t, freq) {
    return Math.sign(Math.sin(2 * Math.PI * t * freq));
}

function sawtooth(t, freq) {
    return 2 * (t * freq - Math.floor(t * freq + 0.5));
}

// --- ADSR Envelope ---
const envelope = {
    attack: 0.01,
    decay: 0.1,
    sustain: 0.2,
    release: 0.1,
};

function getEnvelope(t, duration, env) {
    if (t < env.attack) return t / env.attack;
    if (t < env.attack + env.decay) return 1 - ((t - env.attack) / env.decay) * (1 - env.sustain);
    if (t < duration - env.release) return env.sustain;
    return env.sustain * (1 - (t - (duration - env.release)) / env.release);
}


// --- Event Scheduler ---
let events = [];

function playSample(sampleName, time, gain = 1.0) {
    if (drumSamples[sampleName]) {
        events.push({
            type: 'sample',
            sampleName: sampleName,
            startTime: time,
            gain: gain,
            duration: drumSamples[sampleName].length / sampleRate,
        });
    }
}

// --- Audio Generation ---
function generateAudioChunk() {
    if (!isPlaying) return;

    const chunk = new Float32Array(chunkSampleCount).fill(0);
    const chunkEndTime = nextChunkTime + chunkDuration;

    // --- Drum Machine ---
    if (drumsEnabled) {
        const sixteenthNoteDuration = 60 / 120 / 4;
        for (let i = 0; i < chunkSampleCount; i++) {
            const sampleTime = nextChunkTime + i / sampleRate;

            // Kick on 1 and 3
            if (Math.floor(sampleTime / (sixteenthNoteDuration * 4)) % 2 === 0 && Math.floor(sampleTime / sixteenthNoteDuration) % 4 === 0 && time < sampleTime) {
                if (Math.abs(sampleTime - time) > sixteenthNoteDuration / 2) {
                     playSample('kick', sampleTime, 0.4);
                     time = sampleTime;
                }
            }
             // Snare on 2 and 4
            if (Math.floor(sampleTime / (sixteenthNoteDuration * 4)) % 2 === 0 && Math.floor(sampleTime / sixteenthNoteDuration) % 4 === 2 && time < sampleTime) {
                 if (Math.abs(sampleTime - time) > sixteenthNoteDuration / 2) {
                    playSample('snare', sampleTime, 0.5);
                    time = sampleTime;
                 }
            }
        }
    }
     // Hi-hat on every 8th note
     const eighthNoteDuration = 60/120/2;
     if (Math.floor(time / eighthNoteDuration) < Math.floor((time + chunkDuration)/eighthNoteDuration)) {
         playSample('hat', time, 0.3);
     }


    // --- Bass ---
    if (instruments.bass === 'bass guitar') {
         const sixteenthNoteDuration = 60 / 120 / 4;
         for (let i = 0; i < chunkSampleCount; i++) {
             const sampleTime = nextChunkTime + i / sampleRate;
             if (Math.floor(sampleTime / (sixteenthNoteDuration * 4)) % 2 === 0 && Math.floor(sampleTime / sixteenthNoteDuration) % 4 === 0 && time < sampleTime) {
                 if (Math.abs(sampleTime - time) > sixteenthNoteDuration / 2) {
                    events.push({ type: 'note', freq: 82.41, startTime: sampleTime, duration: 0.5, gain: 0.15 });
                    time = sampleTime;
                 }
             }
         }
    }


    // --- Process Events ---
    for (let i = 0; i < chunkSampleCount; i++) {
        const sampleTime = nextChunkTime + i / sampleRate;
        let sampleValue = 0;
        
        events.forEach(event => {
            if (sampleTime >= event.startTime && sampleTime < event.startTime + event.duration) {
                const eventTime = sampleTime - event.startTime;
                let value = 0;
                if (event.type === 'note') {
                    value = sine(eventTime, event.freq) * getEnvelope(eventTime, event.duration, envelope);
                } else if (event.type === 'sample') {
                    const sampleIndex = Math.floor(eventTime * sampleRate);
                    if (sampleIndex < drumSamples[event.sampleName].length) {
                        value = drumSamples[event.sampleName][sampleIndex];
                    }
                }
                sampleValue += value * event.gain;
            }
        });

        chunk[i] = sampleValue;
    }
    
    // Filter out finished events
    events = events.filter(event => event.startTime + event.duration > chunkEndTime);

    self.postMessage({ type: 'chunk', data: { chunk, duration: chunkDuration } });

    nextChunkTime = chunkEndTime;

    if (isPlaying) {
        scheduleTimeoutId = setTimeout(generateAudioChunk, chunkDuration * 1000 * 0.5);
    }
}


self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'start':
            if (isPlaying) return;
            sampleRate = data.sampleRate || 44100;
            chunkSampleCount = Math.floor(chunkDuration * sampleRate);
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            isPlaying = true;
            nextChunkTime = 0; // Reset time for audio context
            beat = 0;
            time = 0;
            events = [];
            
            // Wait for audio context to be ready in the main thread
            setTimeout(generateAudioChunk, 100); 
            break;
        case 'stop':
            isPlaying = false;
            if (scheduleTimeoutId) {
                clearTimeout(scheduleTimeoutId);
                scheduleTimeoutId = null;
            }
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
        case 'load_samples':
            try {
                drumSamples = data;
                self.postMessage({ type: 'samples_loaded' });
            } catch (error) {
                 self.postMessage({ type: 'error', error: 'Failed to process samples in worker.' });
            }
            break;
    }
};

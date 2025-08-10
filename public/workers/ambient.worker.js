
"use strict";

importScripts('/lib/fractal-music-generator.js');

let state = {
    isPlaying: false,
    instruments: null,
    drumsEnabled: true,
    sampleRate: 44100,
    bpm: 100,
};

let samples = {};
let nextTickTime = 0;
let currentBar = 0;
let currentTickInBar = 0;
const TICKS_PER_BAR = 16; 
const BARS_IN_PATTERN = 8;

function generateAudioChunk() {
    if (!state.isPlaying) return;

    const secondsPerTick = 60.0 / state.bpm / 4;
    const chunkDuration = secondsPerTick;
    const chunkSamples = Math.floor(chunkDuration * state.sampleRate);
    const buffer = new Float32Array(chunkSamples).fill(0);

    const drumNotes = getDrumNotesForTick(currentTickInBar, currentBar);

    if (state.drumsEnabled && drumNotes.length > 0) {
        for (const note of drumNotes) {
            const sample = samples[note.sample];
            if (sample) {
                // For simplicity, just overlay the sample at the beginning of the chunk
                for (let i = 0; i < sample.length && i < buffer.length; i++) {
                    buffer[i] += sample[i] * note.velocity; // Mix with volume
                }
            }
        }
    }
    
    // ALWAYS post a chunk, even if it's silence. This keeps the audio stream alive.
    self.postMessage({
        type: 'chunk',
        data: {
            chunk: buffer,
            duration: chunkDuration
        }
    }, [buffer.buffer]);


    // Advance time
    nextTickTime += chunkDuration;
    currentTickInBar++;
    if (currentTickInBar >= TICKS_PER_BAR) {
        currentTickInBar = 0;
        currentBar = (currentBar + 1) % BARS_IN_PATTERN;
    }

    const drift = performance.now() - nextTickTime * 1000;
    setTimeout(generateAudioChunk, chunkDuration * 1000 - drift);
}


self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'load_samples':
            samples = data;
            console.log("Worker: Samples loaded.");
            break;
        case 'start':
            console.log("Worker: Start command received", data);
            state.instruments = data.instruments;
            state.drumsEnabled = data.drumsEnabled;
            state.sampleRate = data.sampleRate || 44100;

            if (!state.isPlaying) {
                state.isPlaying = true;
                currentBar = 0;
                currentTickInBar = 0;
                nextTickTime = performance.now() / 1000;
                self.postMessage({ type: 'generation_started' });
                generateAudioChunk();
            }
            break;
        case 'stop':
            console.log("Worker: Stop command received");
            state.isPlaying = false;
            break;
        case 'set_instruments':
            state.instruments = data;
            break;
        case 'toggle_drums':
            state.drumsEnabled = data.enabled;
            break;
    }
};

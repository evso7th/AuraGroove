
/**
 * NOTE: This file is NOT a TypeScript file.
 * It's a JavaScript file that is executed as a Web Worker.
 *
 * This worker is responsible for:
 * 1. Generating audio data for different instruments.
 * 2. Scheduling and mixing the audio in chunks.
 * 3. Sending the raw audio chunks (Float32Array) back to the main thread.
 */

// --- Imports (from the compiled fractal-music-generator.ts) ---
// In a real build system, this would be handled by a module loader.
// For simplicity in this environment, we assume these functions are globally available
// or we will define them directly in this file. Let's define them here.

// A simple pseudo-random number generator for deterministic sequences
function lcg(seed) {
  return () => (seed = (seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// --- Basic Synth Engine ---
const OVERSAMPLE = 2; // For better audio quality
const ATTACK_TIME = 0.01;
const DECAY_TIME = 0.3;
const SUSTAIN_LEVEL = 0.5;
const RELEASE_TIME = 0.5;

function adsrEnvelope(time, duration, noteOn) {
    if (time < ATTACK_TIME) {
        return time / ATTACK_TIME;
    }
    if (time < ATTACK_TIME + DECAY_TIME) {
        return 1.0 - (1.0 - SUSTAIN_LEVEL) * (time - ATTACK_TIME) / DECAY_TIME;
    }
    if (noteOn || time < duration) {
        return SUSTAIN_LEVEL;
    }
    // Release phase
    const releaseStartValue = SUSTAIN_LEVEL;
    let releaseTime = time - duration;
    if(releaseTime > RELEASE_TIME) return 0;
    return releaseStartValue * (1 - releaseTime / RELEASE_TIME);
}

function oscillator(time, freq, type = 'sine') {
    switch(type) {
        case 'sine': return Math.sin(2 * Math.PI * freq * time);
        case 'square': return Math.sign(Math.sin(2 * Math.PI * freq * time));
        case 'sawtooth': return 2 * (time * freq - Math.floor(0.5 + time * freq));
        case 'triangle': return 2 * Math.abs(2 * (time * freq - Math.floor(0.5 + time * freq))) - 1;
        default: return Math.sin(2 * Math.PI * freq * time);
    }
}

function renderSynth(notes, duration, sampleRate, instrument) {
    const samples = new Float32Array(Math.floor(duration * sampleRate));
    if (!notes || notes.length === 0 || instrument === 'none') return samples;

    let oscType = 'sine';
    if (instrument === 'synthesizer') oscType = 'sawtooth';
    if (instrument === 'organ') oscType = 'square';
    if (instrument === 'piano') oscType = 'triangle';
    if (instrument === 'bass guitar') oscType = 'sine';

    for (const midi of notes) {
        const freq = midiToFreq(midi);
        for (let i = 0; i < samples.length; i++) {
            const time = i / sampleRate;
            const amp = adsrEnvelope(time, duration, true);
            samples[i] += oscillator(time, freq, oscType) * amp * 0.2; // 0.2 to lower volume
        }
    }
    return samples;
}

function renderDrums(pattern, samplesPerBeat, drumSamples) {
    const output = new Float32Array(samplesPerBeat);
    if (!drumSamples.snare || pattern.length === 0) return output;

    for (const step of pattern) {
        const sampleToPlay = drumSamples.snare; // Using snare for all for now for stability
        const startIndex = Math.floor(step.time * samplesPerBeat);
        
        for (let i = 0; i < sampleToPlay.length && startIndex + i < output.length; i++) {
            output[startIndex + i] += sampleToPlay[i] * 0.5; // 0.5 to lower volume
        }
    }

    return output;
}

// --- Worker State ---
let isRunning = false;
let config = {
    sampleRate: 44100,
    instruments: {
        solo: 'synthesizer',
        accompaniment: 'piano',
        bass: 'bass guitar',
    },
    drumsEnabled: true,
    tempo: 100,
};
let drumSamples = {};
let beatCounter = 0;

// Simple, stable drum pattern
const PENTATONIC_SCALE = [0, 2, 4, 7, 9];
const TOTAL_BEATS = 16; // 4 bars * 4 beats

// --- Main Generation Loop ---
function startGeneration() {
    if (!isRunning) return;

    // This is the crucial message that was missing.
    self.postMessage({ type: 'generation_started' });

    const random = lcg(Date.now());
    const secondsPerBeat = 60.0 / config.tempo;
    const samplesPerBeat = Math.floor(secondsPerBeat * config.sampleRate);
    const chunkDuration = secondsPerBeat;

    const generationLoop = () => {
        if (!isRunning) return;
        
        const soloNotes = config.instruments.solo !== 'none' 
            ? (random() > 0.8 ? [60 + PENTATONIC_SCALE[Math.floor(random() * 5)] + 12] : []) 
            : [];
        const accompNotes = config.instruments.accompaniment !== 'none'
            ? (random() > 0.5 ? [60 + PENTATONIC_SCALE[Math.floor(random() * 5)]] : [])
            : [];
        const bassNotes = config.instruments.bass !== 'none'
            ? (random() > 0.2 ? [60 + PENTATONIC_SCALE[Math.floor(random() * 5)] - 12] : [])
            : [];

        // Generate audio for each part
        const soloBuffer = renderSynth(soloNotes, chunkDuration, config.sampleRate, config.instruments.solo);
        const accompBuffer = renderSynth(accompNotes, chunkDuration, config.samplerate, config.instruments.accompaniment);
        const bassBuffer = renderSynth(bassNotes, chunkDuration, config.sampleRate, config.instruments.bass);
        
        // Generate drums
        const drumBuffer = new Float32Array(samplesPerBeat);
        if (config.drumsEnabled && drumSamples.snare) {
            // Simple kick on 1, snare on 3
             if (beatCounter % 4 === 0) { // Kick
                 for(let i=0; i < drumSamples.snare.length && i < drumBuffer.length; i++) drumBuffer[i] += drumSamples.snare[i] * 0.5;
             }
             if (beatCounter % 4 === 2) { // Snare
                 for(let i=0; i < drumSamples.snare.length && i < drumBuffer.length; i++) drumBuffer[i] += drumSamples.snare[i] * 0.4;
             }
        }

        // Mix all buffers
        const finalChunk = new Float32Array(samplesPerBeat);
        for (let i = 0; i < samplesPerBeat; i++) {
            finalChunk[i] = (soloBuffer[i] || 0) + (accompBuffer[i] || 0) + (bassBuffer[i] || 0) + (drumBuffer[i] || 0);
             // Basic limiter
            finalChunk[i] = Math.max(-1, Math.min(1, finalChunk[i]));
        }

        // Post chunk back to main thread
        self.postMessage({
            type: 'chunk',
            data: {
                chunk: finalChunk,
                duration: chunkDuration
            }
        }, [finalChunk.buffer]);
        
        beatCounter = (beatCounter + 1) % TOTAL_BEATS;

        // Schedule next chunk generation
        setTimeout(generationLoop, chunkDuration * 1000 / 2); // Generate ahead of time
    };

    generationLoop();
}

// --- Message Handling ---
self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'start':
            if (isRunning) return;
            isRunning = true;
            config = { ...config, ...data };
            beatCounter = 0;
            console.log("Worker: Start command received. Config:", config);
            startGeneration();
            break;

        case 'stop':
            isRunning = false;
            console.log("Worker: Stop command received.");
            break;

        case 'set_instruments':
            config.instruments = data;
            console.log("Worker: Instruments updated:", data);
            break;

        case 'toggle_drums':
            config.drumsEnabled = data.enabled;
            console.log("Worker: Drums toggled:", data.enabled);
            break;
        
        case 'load_samples':
            drumSamples = data;
            console.log("Worker: Received and stored raw sample data for:", Object.keys(data)[0]);
            break;
    }
};

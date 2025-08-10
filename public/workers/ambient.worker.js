
"use strict";

// --- Worker Scope ---
let currentBeat = 0;
let totalBeatsGenerated = 0;
let isGenerating = false;
let timerId = null;
let sampleRate = 44100;
let instruments = {
    solo: 'synthesizer',
    accompaniment: 'piano',
    bass: 'bass guitar',
};
let drumsEnabled = true;

// --- Sample Data (will be loaded from main thread) ---
const samples = {
    'snare': null
};

// --- Constants ---
const BPM = 90;
const BEAT_DURATION_SECONDS = 60.0 / BPM;
const CHUNK_DURATION_SECONDS = 0.5; // Generate audio in smaller chunks
const CHUNK_SAMPLES = Math.floor(CHUNK_DURATION_SECONDS * sampleRate);

// --- Music Generation (simplified) ---
// Note: We are keeping the other instruments extremely simple for now to focus on the drums.
importScripts('/lib/fractal-music-generator.js');


// --- DSP Functions (moved from generators) ---
function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function createEnvelope(level, duration, sampleRate) {
    const attackTime = 0.01 * sampleRate;
    const decayTime = (duration * 0.5) * sampleRate;
    const sustainLevel = level * 0.7;
    const releaseTime = (duration * 0.4) * sampleRate;
    const totalSamples = duration * sampleRate;

    const envelope = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
        if (i < attackTime) {
            envelope[i] = level * (i / attackTime);
        } else if (i < attackTime + decayTime) {
            envelope[i] = level - (level - sustainLevel) * ((i - attackTime) / decayTime);
        } else if (i < totalSamples - releaseTime) {
            envelope[i] = sustainLevel;
        } else {
            envelope[i] = sustainLevel * (1 - (i - (totalSamples - releaseTime)) / releaseTime);
        }
    }
    return envelope;
}

function applyEnvelope(signal, envelope) {
    const len = Math.min(signal.length, envelope.length);
    for (let i = 0; i < len; i++) {
        signal[i] *= envelope[i];
    }
    return signal;
}


// --- Instrument Synthesis Functions ---
function synthesize(notes, duration, type) {
    const buffer = new Float32Array(Math.floor(duration * sampleRate));
    if (notes.length === 0 || type === 'none') {
        return buffer;
    }

    const envelope = createEnvelope(0.3, duration, sampleRate);

    notes.forEach(note => {
        const frequency = midiToFrequency(note);
        for (let i = 0; i < buffer.length; i++) {
            const time = i / sampleRate;
            let sampleValue = 0;
            // Simple oscillators based on type
            if (type === 'synthesizer') {
                sampleValue = Math.sin(2 * Math.PI * frequency * time);
            } else if (type === 'piano') {
                 // Simplified piano-like sound (multiple harmonics)
                sampleValue = 0.6 * Math.sin(2 * Math.PI * frequency * time) + 
                              0.3 * Math.sin(2 * Math.PI * frequency * 2 * time) +
                              0.1 * Math.sin(2 * Math.PI * frequency * 3 * time);
            } else if (type === 'organ') {
                // Simplified organ-like sound
                 sampleValue = 0.5 * Math.sin(2 * Math.PI * frequency * time) + 
                               0.3 * Math.sin(2 * Math.PI * frequency * 2 * time) +
                               0.2 * Math.sin(2 * Math.PI * frequency * 4 * time);
            } else if (type === 'bass guitar') {
                 // Simplified bass sound (sine wave)
                 sampleValue = Math.sin(2 * Math.PI * frequency * time);
            }
            buffer[i] += sampleValue / notes.length;
        }
    });

    return applyEnvelope(buffer, envelope);
}


function generateAudioChunk() {
    const chunkBuffer = new Float32Array(CHUNK_SAMPLES).fill(0);
    const beatsInChunk = CHUNK_DURATION_SECONDS / BEAT_DURATION_SECONDS;

    // Determine the part of the beat we are in
    const startBeat = totalBeatsGenerated;
    const endBeat = startBeat + beatsInChunk;
    
    // --- Generate Instrument Parts ---
    if (instruments.solo !== 'none') {
        const soloNotes = generateSimpleSolo(Math.random);
        const soloBuffer = synthesize(soloNotes, CHUNK_DURATION_SECONDS, instruments.solo);
        for (let i = 0; i < CHUNK_SAMPLES; i++) chunkBuffer[i] += soloBuffer[i] * 0.5;
    }

    if (instruments.accompaniment !== 'none') {
        const accNotes = generateSimpleAccompaniment(Math.random);
        const accBuffer = synthesize(accNotes, CHUNK_DURATION_SECONDS, instruments.accompaniment);
        for (let i = 0; i < CHUNK_SAMPLES; i++) chunkBuffer[i] += accBuffer[i] * 0.4;
    }

    if (instruments.bass !== 'none') {
        const bassNotes = generateSimpleBass(Math.random);
        const bassBuffer = synthesize(bassNotes, CHUNK_DURATION_SECONDS, instruments.bass);
        for (let i = 0; i < CHUNK_SAMPLES; i++) chunkBuffer[i] += bassBuffer[i] * 0.6;
    }


    // --- Generate Drum Part ---
    if (drumsEnabled) {
        const currentBeatInBar = Math.floor(totalBeatsGenerated) % BEATS_PER_BAR;
        const drumSteps = drumPatternA[currentBeatInBar]; // Always use Pattern A

        drumSteps.forEach(step => {
             const sample = samples[step.sample];
             if (sample) {
                 const stepTimeInChunk = (currentBeatInBar - Math.floor(startBeat)) * BEAT_DURATION_SECONDS + step.time * BEAT_DURATION_SECONDS;
                 const startIndex = Math.floor(stepTimeInChunk * sampleRate);

                 if (startIndex < CHUNK_SAMPLES) {
                    for (let i = 0; i < sample.length && startIndex + i < CHUNK_SAMPLES; i++) {
                       chunkBuffer[startIndex + i] += sample[i] * 0.7; // Mix in sample
                    }
                 }
             }
        });
    }


    totalBeatsGenerated += beatsInChunk;
    currentBeat = (currentBeat + 1);

    // Send generated chunk back to the main thread
    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkBuffer,
            duration: CHUNK_DURATION_SECONDS
        }
    }, [chunkBuffer.buffer]);
}


function startGeneration(initialSettings) {
    if (isGenerating) return;

    console.log("Worker starting generation with settings:", initialSettings);
    isGenerating = true;
    currentBeat = 0;
    totalBeatsGenerated = 0;
    sampleRate = initialSettings.sampleRate || 44100;
    instruments = initialSettings.instruments || instruments;
    drumsEnabled = initialSettings.drumsEnabled;
    
    self.postMessage({ type: 'generation_started' });

    // Use a tight loop with interval to avoid blocking
    timerId = setInterval(generateAudioChunk, CHUNK_DURATION_SECONDS * 1000 * 0.9); // Run slightly faster to keep buffer full
}

function stopGeneration() {
    if (!isGenerating) return;
    isGenerating = false;
    if (timerId) {
        clearInterval(timerId);
        timerId = null;
    }
    console.log("Worker stopped generation.");
}


// --- Message Handling ---
self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'start':
            startGeneration(data);
            break;
        case 'stop':
            stopGeneration();
            break;
        case 'set_instruments':
            instruments = data;
            console.log("Worker instruments updated:", instruments);
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            console.log("Worker drums enabled:", drumsEnabled);
            break;
        case 'load_samples':
             if (data.snare) {
                samples['snare'] = data.snare;
                console.log("Worker loaded snare sample.");
            }
            break;
        default:
            console.warn(`Worker received unknown command: ${command}`);
    }
};

    

"use strict";

// --- Imports ---
// Note: In a real worker, you'd use importScripts() for dependencies.
// For this environment, we'll define everything in this file.

// --- Utilities ---
function midiToFrequency(midiNote) {
    return 440 * Math.pow(2, (midiNote - 69) / 12);
}

// --- Synthesis ---
function createEnvelope(audioContext, attack, decay, sustain, release) {
    const now = audioContext.currentTime;
    const envelope = audioContext.createGain();
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(1, now + attack);
    envelope.gain.linearRampToValueAtTime(sustain, now + attack + decay);
    
    envelope.scheduleRelease = (releaseTime) => {
        const currentSustain = envelope.gain.value;
        envelope.gain.cancelScheduledValues(releaseTime);
        envelope.gain.setValueAtTime(currentSustain, releaseTime);
        envelope.gain.linearRampToValueAtTime(0, releaseTime + release);
    };

    return envelope;
}

function createOscillator(audioContext, frequency, type = 'sine', detune = 0) {
    const osc = audioContext.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    osc.detune.value = detune;
    return osc;
}

const instrumentSynthMap = {
    'synthesizer': (audioContext, freq) => ({ type: 'sawtooth', detune: 2 }),
    'piano': (audioContext, freq) => ({ type: 'triangle', detune: 0 }),
    'organ': (audioContext, freq) => ({ type: 'square', detune: 5 }),
    'bass guitar': (audioContext, freq) => ({ type: 'sine', detune: 0 }),
};

// --- Music Generation Logic ---
// This part is now simplified and directly uses functions from fractal-music-generator
// (which are included below for this self-contained worker)

// --- fractal-music-generator.ts content START ---

const PENTATONIC_SCALE = [0, 2, 4, 7, 9]; // C Major Pentatonic offsets

function getRandomNote(scale, octave, random) {
    const noteIndex = Math.floor(random() * scale.length);
    return 60 + octave * 12 + scale[noteIndex]; // 60 is C4
}

function generateSimpleSolo(random) {
    const shouldPlay = random() > 0.8;
    if (!shouldPlay) return [];
    return [getRandomNote(PENTATONIC_SCALE, 1, random)];
}

function generateSimpleAccompaniment(random) {
    const shouldPlay = random() > 0.6;
    if (!shouldPlay) return [];
    const root = getRandomNote(PENTATONIC_SCALE, 0, random);
    return [root, root + 4]; // simple interval
}

function generateSimpleBass(random) {
    const shouldPlay = random() > 0.5;
    if (!shouldPlay) return [];
    return [getRandomNote(PENTATONIC_SCALE, -1, random)];
}

// A single, stable drum pattern
const BEATS_PER_BAR = 4;
const BARS = 4;
const TOTAL_BEATS_IN_PATTERN = BEATS_PER_BAR * BARS; // 16 beats

const drumPatternA = Array(TOTAL_BEATS_IN_PATTERN).fill(null).map((_, beatIndex) => {
    const steps = [];
    const bar = Math.floor(beatIndex / BEATS_PER_BAR);
    const beatInBar = beatIndex % BEATS_PER_BAR;

    // Kick on the first beat of each bar
    if (beatInBar === 0) {
        steps.push({ sample: 'kick', time: 0 });
    }
    
    // Snare on the third beat of each bar
    if (beatInBar === 2) {
        steps.push({ sample: 'snare', time: 0 });
    }

    // Hi-hat on every beat
    steps.push({ sample: 'hat', time: 0 });
    
    return steps;
});
// --- fractal-music-generator.ts content END ---


// --- Main Worker Logic ---
let sampleRate = 44100;
let tempo = 120;
let instruments = {};
let drumsEnabled = true;

let beatDuration; // in seconds
let chunkDurationSeconds;
let chunkSizeInFrames;
let isRunning = false;
let sequencePosition = 0;
const lcgSeed = Date.now();

// A simple pseudo-random number generator for deterministic sequences
function lcg(seed) {
  return () => (seed = (seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}
let random = lcg(lcgSeed);

const loadedSamples = {};

function setTempo(newTempo) {
    tempo = newTempo;
    beatDuration = 60.0 / tempo;
    chunkDurationSeconds = beatDuration; // Generate one beat at a time
    chunkSizeInFrames = Math.floor(sampleRate * chunkDurationSeconds);
}

function generateInstrumentPart(notes, synthConfig, noteDuration) {
    const buffer = new Float32Array(chunkSizeInFrames).fill(0);
    if (notes.length === 0) return buffer;

    const audioContextStub = { currentTime: 0, sampleRate };
    const attack = 0.01, decay = 0.1, sustain = 0.1, release = 0.1;
    const effectiveNoteDuration = Math.min(noteDuration, attack + decay + 0.1);


    for (const midiNote of notes) {
        const freq = midiToFrequency(midiNote);
        const { type, detune } = synthConfig(audioContextStub, freq);
        
        // Simple oscillator rendering
        let currentAmp = 0;
        const attackSamples = Math.floor(sampleRate * attack);
        const decaySamples = Math.floor(sampleRate * decay);
        const sustainSamples = Math.floor(sampleRate * (effectiveNoteDuration - attack));
        const releaseSamples = Math.floor(sampleRate * release);
        const totalSamples = Math.min(chunkSizeInFrames, sustainSamples + releaseSamples);

        for (let i = 0; i < totalSamples; i++) {
            const time = i / sampleRate;
            if (i < attackSamples) {
                currentAmp = i / attackSamples;
            } else if (i < attackSamples + decaySamples) {
                currentAmp = 1.0 - (1.0 - sustain) * ((i - attackSamples) / decaySamples);
            } else if (i < sustainSamples) {
                 currentAmp = sustain;
            } else {
                 currentAmp = sustain * (1 - ((i - sustainSamples) / releaseSamples));
            }
            
            const oscillatorValue = Math.sin(2 * Math.PI * freq * time + detune * time);
            buffer[i] += oscillatorValue * currentAmp * 0.2; // 0.2 is volume factor
        }
    }
    return buffer;
}


function generateDrumPart() {
    const buffer = new Float32Array(chunkSizeInFrames).fill(0);
    if (!drumsEnabled) return buffer;

    const currentBeatPattern = drumPatternA[sequencePosition % TOTAL_BEATS_IN_PATTERN];

    for (const step of currentBeatPattern) {
        let sample;
        // Simplified sample mapping for stability
        if (step.sample === 'kick' && loadedSamples.snare) { // Use snare as a proxy for any loaded sample for now
            sample = loadedSamples.snare; // In a real scenario, this would be loadedSamples.kick
        } else if (step.sample === 'snare' && loadedSamples.snare) {
            sample = loadedSamples.snare;
        } else if (step.sample === 'hat' && loadedSamples.snare) { // Proxy
            sample = loadedSamples.snare;
        } else {
            continue;
        }

        const offsetInFrames = Math.floor(step.time * beatDuration * sampleRate);
        const sampleLength = Math.min(sample.length, buffer.length - offsetInFrames);

        for (let i = 0; i < sampleLength; i++) {
            buffer[i + offsetInFrames] += sample[i] * 0.5; // 0.5 is volume factor
        }
    }

    return buffer;
}


function generateNextChunk() {
    if (!isRunning) return;

    // Generate parts
    const soloNotes = instruments.solo !== 'none' ? generateSimpleSolo(random) : [];
    const soloSynthConfig = instrumentSynthMap[instruments.solo];
    const soloBuffer = soloSynthConfig ? generateInstrumentPart(soloNotes, soloSynthConfig, beatDuration) : new Float32Array(chunkSizeInFrames);

    const accompNotes = instruments.accompaniment !== 'none' ? generateSimpleAccompaniment(random) : [];
    const accompSynthConfig = instrumentSynthMap[instruments.accompaniment];
    const accompBuffer = accompSynthConfig ? generateInstrumentPart(accompNotes, accompSynthConfig, beatDuration) : new Float32Array(chunkSizeInFrames);
    
    const bassNotes = instruments.bass !== 'none' ? generateSimpleBass(random) : [];
    const bassSynthConfig = instrumentSynthMap[instruments.bass];
    const bassBuffer = bassSynthConfig ? generateInstrumentPart(bassNotes, bassSynthConfig, beatDuration) : new Float32Array(chunkSizeInFrames);

    const drumsBuffer = generateDrumPart();
    
    // Mix parts
    const mixedBuffer = new Float32Array(chunkSizeInFrames);
    for (let i = 0; i < chunkSizeInFrames; i++) {
        mixedBuffer[i] = (soloBuffer[i] + accompBuffer[i] + bassBuffer[i] + drumsBuffer[i]) / 4.0;
    }
    
    // Post message back to the main thread
    self.postMessage({
        type: 'chunk',
        data: {
            chunk: mixedBuffer,
            duration: chunkDurationSeconds
        }
    }, [mixedBuffer.buffer]);

    sequencePosition++;
    
    // Schedule next chunk
    setTimeout(generateNextChunk, chunkDurationSeconds * 900); // slightly less than duration to avoid gaps
}


function startGeneration(config) {
    if (isRunning) return;
    
    self.postMessage({ type: 'generation_started' });

    isRunning = true;
    instruments = config.instruments;
    drumsEnabled = config.drumsEnabled;
    sampleRate = config.sampleRate;
    setTempo(tempo);
    sequencePosition = 0;
    random = lcg(lcgSeed);
    
    generateNextChunk();
}

self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'start':
            startGeneration(data);
            break;
        case 'stop':
            isRunning = false;
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
        case 'load_samples':
            // Store the raw Float32Array data
            for (const key in data) {
                loadedSamples[key] = data[key];
            }
            break;
    }
};

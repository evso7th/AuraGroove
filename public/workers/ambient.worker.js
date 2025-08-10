
"use strict";

const PRESETS = {
  doomBass: {
    synth: { oscillator: { type: "sine" }, envelope: { attack: 0.1, decay: 0.5, sustain: 0.8, release: 2.0 } },
    effects: [{ type: "distortion", amount: 0.05 }],
    notes: ["E1", "B1", "G1", "E2"],
  },
  darkDrone: {
    synth: { type: "fm", voices: 2, settings: { harmonicity: 1, modulationIndex: 3, envelope: { attack: 3.0, decay: 2.0, sustain: 0.4, release: 5.0 } } },
    effects: [{ type: "filter", frequency: 200, rolloff: -12 }],
    notes: ["E1", "G1", "B1"],
  },
  evolvingPad: {
    synth: { type: "am", voices: 3, settings: { harmonicity: 2, envelope: { attack: 2.0, decay: 1.0, sustain: 0.3, release: 4.0 } } },
    effects: [{ type: "chorus", frequency: 0.2, delayTime: 3.5, depth: 0.3 }, { type: "reverb", decay: 8, wet: 0.3 }],
    chordProgression: ["Em", "G", "Bm"],
  },
};

// --- State Management ---
let isRunning = false;
let sampleRate = 44100;
let instruments = {};
let drumsEnabled = true;
let decodedSamples = {};

let barCount = 0;
let lastTickTime = 0;
let tickInterval;

// --- Music Generation Logic ---

function generateNote(noteName, octave) {
    const noteMap = { "C": 0, "C#": 1, "D": 2, "D#": 3, "E": 4, "F": 5, "F#": 6, "G": 7, "G#": 8, "A": 9, "A#": 10, "B": 11 };
    const a4 = 440;
    const n = noteMap[noteName] - noteMap["A"] + (octave - 4) * 12;
    return a4 * Math.pow(2, n / 12);
}

function adsrEnvelope(audio, attack, decay, sustainLevel, release, duration, sampleRate) {
    const attackSamples = Math.floor(attack * sampleRate);
    const decaySamples = Math.floor(decay * sampleRate);
    const sustainSamples = Math.max(0, Math.floor(duration * sampleRate) - attackSamples - decaySamples);
    const releaseSamples = Math.floor(release * sampleRate);

    // Attack phase
    for (let i = 0; i < attackSamples && i < audio.length; i++) {
        audio[i] *= i / attackSamples;
    }

    // Decay and Sustain phase
    for (let i = attackSamples; i < attackSamples + decaySamples + sustainSamples && i < audio.length; i++) {
        if (i < attackSamples + decaySamples) {
            const decayFactor = 1 - ((i - attackSamples) / decaySamples) * (1 - sustainLevel);
            audio[i] *= decayFactor;
        } else {
            audio[i] *= sustainLevel;
        }
    }
    
    return audio;
}


function generateSynthesizerPart(preset, duration, sampleRate) {
    const buffer = new Float32Array(Math.floor(duration * sampleRate));
    const noteFrequency = generateNote(preset.notes[0].slice(0, -1), parseInt(preset.notes[0].slice(-1), 10));

    for (let i = 0; i < buffer.length; i++) {
        const time = i / sampleRate;
        buffer[i] = Math.sin(2 * Math.PI * noteFrequency * time);
    }
    
    const { attack, decay, sustain, release } = preset.synth.envelope;
    adsrEnvelope(buffer, attack, decay, sustain, release, duration, sampleRate);
    
    return buffer;
}


function generateDrumPart(duration, sampleRate, barCount) {
    const totalSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(totalSamples);
    if (!drumsEnabled || Object.keys(decodedSamples).length === 0) {
        return buffer;
    }
    
    const drumPattern = [
        { sample: "kick", time: 0, velocity: 0.8 },
        { sample: "hat", time: 0.25, velocity: 0.4 },
        { sample: "snare", time: 0.5, velocity: 1.0 },
        { sample: "hat", time: 0.75, velocity: 0.4 },
    ];
    
    // Add crash on the first beat of every 4th bar
    if (barCount % 4 === 0) {
       drumPattern.push({ sample: "crash", time: 0, velocity: 0.7 });
    } else {
        // Add ride on every beat in other bars
        drumPattern.push({ sample: "ride", time: 0, velocity: 0.5 });
        drumPattern.push({ sample: "ride", time: 0.25, velocity: 0.5 });
        drumPattern.push({ sample: "ride", time: 0.5, velocity: 0.5 });
        drumPattern.push({ sample: "ride", time: 0.75, velocity: 0.5 });
    }

    for (const hit of drumPattern) {
        const sample = decodedSamples[hit.sample];
        if (!sample) continue;

        const startSample = Math.floor(hit.time * totalSamples);
        const endSample = startSample + sample.length;
        
        let sampleToMix = sample;

        // Check if the sample fits
        if (endSample > totalSamples) {
            const remainingSpace = totalSamples - startSample;
            if (remainingSpace <= 0) continue; // No space left, skip hit

            // If the main sample doesn't fit, try a shorter one
            const shortSample = decodedSamples["hat"];
            if (shortSample && startSample + shortSample.length <= totalSamples) {
                sampleToMix = shortSample;
            } else {
                // If even the short one doesn't fit, skip this hit
                continue;
            }
        }
        
        // Mix the sample into the buffer
        for (let i = 0; i < sampleToMix.length; i++) {
            if (startSample + i < totalSamples) {
                buffer[startSample + i] += sampleToMix[i] * hit.velocity;
            }
        }
    }
    return buffer;
}


// --- Worker Control ---
function resetState() {
    console.log("Worker state reset.");
    barCount = 0;
    lastTickTime = 0;
    if (tickInterval) {
        clearInterval(tickInterval);
        tickInterval = null;
    }
}


function startGenerator(data) {
    if (isRunning) return;
    
    resetState();

    isRunning = true;
    sampleRate = data.sampleRate;
    instruments = data.instruments;
    drumsEnabled = data.drumsEnabled;
    lastTickTime = performance.now();

    tickInterval = setInterval(runGenerator, 500); // Run generator every 500ms
    console.log("Generator started");
}

function stopGenerator() {
    if (!isRunning) return;
    isRunning = false;
    resetState();
    console.log("Generator stopped");
}


function runGenerator() {
    if (!isRunning) return;

    const now = performance.now();
    const duration = 2; // Generate 2 seconds of audio per chunk (4/4 time at 120bpm)

    // Check if it's time to generate the next chunk
    if (now < lastTickTime + (duration * 1000) / 2) {
         // Don't generate too far ahead
        return;
    }

    // Generate parts
    const bassPart = generateSynthesizerPart(PRESETS.doomBass, duration, sampleRate);
    const drumPart = generateDrumPart(duration, sampleRate, barCount);

    // Mix parts
    const chunk = new Float32Array(Math.floor(duration * sampleRate));
    for (let i = 0; i < chunk.length; i++) {
        let sample = 0;
        if (i < bassPart.length) sample += bassPart[i] * 0.5; // Bass at 50% volume
        if (i < drumPart.length) sample += drumPart[i] * 0.5; // Drums at 50% volume
        // Simple clipping
        chunk[i] = Math.max(-1, Math.min(1, sample));
    }
    
    self.postMessage({ type: 'chunk', data: { chunk, duration } }, [chunk.buffer]);
    
    lastTickTime += duration * 1000;
    barCount++;
}

self.onmessage = (event) => {
    const { command, data } = event.data;
    try {
        switch (command) {
            case "load_samples":
                decodedSamples = data;
                self.postMessage({ type: "samples_loaded" });
                break;
            case "start":
                startGenerator(data);
                break;
            case "stop":
                stopGenerator();
                break;
            case "set_instruments":
                instruments = data;
                break;
            case "toggle_drums":
                drumsEnabled = data.enabled;
                break;
        }
    } catch (error) {
        self.postMessage({
            type: "error",
            error: `Worker failed on command ${command}: ${error.message} \n ${error.stack}`,
        });
    }
};

    
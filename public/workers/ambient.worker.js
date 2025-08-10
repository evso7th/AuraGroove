
"use strict";

let isRunning = false;
let tick = 0;
let instruments = {};
let sampleRate = 44100;
let samples = {};

// ====================================================================================
// NEW: Pattern-based sequencer for reliability and clarity
// ====================================================================================

const drumPatterns = {
    // 16 steps per bar (16th notes)
    kick_drum6: {
        pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], // Four-on-the-floor
        gain: 0.7, // Quieter kick
    },
    snare: {
        pattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], // On beats 2 and 4
        gain: 1.0, // Louder snare
    },
    closed_hi_hat_accented: {
        pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], // 8th notes
        gain: 0.4,
    },
    crash1: {
        // Plays once every 8 bars (128 steps)
        pattern: Array(128).fill(0).map((_, i) => i === 0 ? 1 : 0),
        gain: 0.5,
    },
    cymbal1: { // This is our Ride
        pattern: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], // Syncopated ride
        gain: 0.6,
    }
};

const noteFrequencies = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77
};

const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10]
};

let currentProgression = [];
let currentScale = scales.major;
let rootNote = 'C';
let octave = 4;
let bassOctave = 3;

// ====================================================================================
// Music Generation
// ====================================================================================

function generateMusicChunk() {
    const tempo = 70; // BPM
    const beatsPerBar = 4;
    const stepsPerBeat = 4; // 16th notes
    const stepsPerBar = beatsPerBeat * stepsPerBeat;
    const barDuration = (60 / tempo) * beatsPerBar;
    const stepDuration = barDuration / stepsPerBar;

    const chunkSteps = 4; // Generate 4 steps (a quarter note) at a time
    const chunkDuration = stepDuration * chunkSteps;
    const chunkSamples = Math.floor(chunkDuration * sampleRate);
    const buffer = new Float32Array(chunkSamples).fill(0);

    for (let i = 0; i < chunkSteps; i++) {
        const stepTime = i * stepDuration;
        const sampleOffset = Math.floor(stepTime * sampleRate);

        // --- Drums ---
        if (instruments.drumsEnabled) {
            for (const [drum, { pattern, gain }] of Object.entries(drumPatterns)) {
                
                // Skip the very first kick drum hit
                if (drum === 'kick_drum6' && tick === 0) {
                    continue;
                }

                const currentStepInPattern = tick % pattern.length;
                if (pattern[currentStepInPattern] === 1 && samples[drum]) {
                    const sample = samples[drum];
                    const end = Math.min(sampleOffset + sample.length, buffer.length);
                    for (let j = 0; j < end - sampleOffset; j++) {
                        buffer[sampleOffset + j] += sample[j] * gain;
                    }
                }
            }
        }
        
        // --- Melodic Instruments (Placeholder for future implementation) ---
        // TODO: Add melodic generation based on patterns and scales
        
        tick++;
    }

    return buffer;
}


// ====================================================================================
// Worker Lifecycle
// ====================================================================================

function scheduleNextChunk() {
    if (!isRunning) return;

    const chunkData = generateMusicChunk();
    const duration = chunkData.length / sampleRate;

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkData.buffer,
            duration: duration
        }
    }, [chunkData.buffer]);

    // Schedule the next chunk slightly before the current one finishes
    const timeout = Math.max(0, (duration * 1000) * 0.9);
    setTimeout(scheduleNextChunk, timeout);
}


self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            samples = data;
            self.postMessage({ type: 'samples_loaded' });
            break;
            
        case 'start':
            if (isRunning) return;
            isRunning = true;
            instruments = data.instruments;
            sampleRate = data.sampleRate;
            tick = 0; // Reset tick on start
            scheduleNextChunk();
            break;

        case 'stop':
            isRunning = false;
            tick = 0;
            break;
            
        case 'set_instruments':
            instruments = data;
            break;
        
        case 'toggle_drums':
            if(instruments) {
                instruments.drumsEnabled = data.enabled;
            }
            break;
    }
};


"use strict";

// --- State ---
let isRunning = false;
let scheduleTimeoutId = null;
let tick = 0;
let instruments = {
    solo: 'none',
    accompaniment: 'none',
    bass: 'none'
};
let drumsEnabled = true;
let sampleRate = 44100;
let samples = {};

const sixteenthNoteTime = 0.125; // 120 BPM
const chunkDuration = sixteenthNoteTime * 16; // One measure of 4/4

// --- Note Generation Logic ---
const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
};
const rootNote = 60; // C4
const scale = scales.major;

function getNote(octave, scaleDegree) {
    return rootNote + (octave * 12) + scale[scaleDegree % scale.length];
}

const drumPatterns = {
    'kick_drum6': {
        pattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        gain: 0.7,
        skipFirst: true, // Don't play on the very first beat of the song
    },
    'snare': {
        pattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        gain: 1.0,
    },
    'closed_hi_hat_accented': {
        pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        gain: 0.4,
    },
    'crash1': {
        pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        gain: 0.5,
        interval: 8, // Play every 8 measures
    },
    'cymbal1': {
        pattern: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        gain: 0.4,
    }
};


function generateMusicChunk() {
    const chunkSamples = [];
    const beatsPerMeasure = 4;
    const beatsPerBeat = 4; // This was the missing variable
    const totalSixteenthsInMeasure = beatsPerMeasure * beatsPerBeat;

    const measure = Math.floor(tick / totalSixteenthsInMeasure);
    const step = tick % totalSixteenthsInMeasure;

    // --- Drums ---
    if (drumsEnabled) {
        for (const sampleName in drumPatterns) {
            const { pattern, gain, skipFirst, interval } = drumPatterns[sampleName];
            
            if (skipFirst && tick === 0) continue;

            if (interval && (measure % interval !== 0)) continue;

            if (pattern[step] && samples[sampleName]) {
                 chunkSamples.push({
                    sample: samples[sampleName],
                    gain: gain,
                    time: 0 // all samples in the chunk start at the same relative time
                });
            }
        }
    }
    
    // --- Melodic parts (placeholder) ---
    // A simple logic for melodic instruments can be added here
    // For now, they remain silent to focus on drums
    const time = tick * sixteenthNoteTime;
    if (instruments.solo !== 'none' && (tick % 8 === 0)) {
       // generate solo note
    }
    if (instruments.accompaniment !== 'none' && (tick % 4 === 0)) {
        // generate accompaniment chord
    }
    if (instruments.bass !== 'none' && (tick % 16 === 0)) {
        // generate bass note
    }


    const chunkBuffer = mixAudio(chunkSamples);
    
    tick++;
    if (tick >= totalSixteenthsInMeasure * 8) { // Reset after 8 measures
        tick = 0;
    }

    return chunkBuffer;
}


function mixAudio(chunkSamples) {
    if (chunkSamples.length === 0) {
        return new Float32Array(0);
    }
    const mixBuffer = new Float32Array(Math.floor(chunkDuration * sampleRate));
    
    chunkSamples.forEach(({ sample, gain }) => {
        for (let i = 0; i < sample.length; i++) {
            if (i < mixBuffer.length) {
                mixBuffer[i] += sample[i] * (gain !== undefined ? gain : 1.0);
            }
        }
    });

    return mixBuffer;
}


function scheduleNextChunk() {
    if (!isRunning) return;

    const chunk = generateMusicChunk();
    if(chunk.length > 0) {
        self.postMessage({ type: 'chunk', data: { chunk, duration: chunkDuration } });
    }
    
    scheduleTimeoutId = setTimeout(scheduleNextChunk, chunkDuration * 1000);
}


// --- Message Handling ---
self.onmessage = function(event) {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            samples = data;
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            if (isRunning) return;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            sampleRate = data.sampleRate;
            tick = 0;
            isRunning = true;
            scheduleNextChunk();
            break;
        case 'stop':
            isRunning = false;
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
    }
};

    
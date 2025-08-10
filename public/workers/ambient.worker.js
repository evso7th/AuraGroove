
"use strict";

// --- State ---
let masterState = {
    isRunning: false,
    config: {
        sampleRate: 44100,
        chunkDuration: 0.2,
        tempo: 120,
    },
    instruments: {
        solo: "none",
        accompaniment: "none",
        bass: "none",
    },
    drumsEnabled: true,
    samples: {},
    tick: 0,
    nextScheduleTime: 0,
    timeoutId: null,
};

// --- Music Generation Logic ---

/**
 * Generates a single chunk of audio data.
 * This function is the core of the music generation.
 * @param {number} currentTick - The current time step.
 * @returns {Array<Object>} An array of notes to be played in this chunk.
 */
function generateMusicChunk(currentTick) {
    const { instruments, drumsEnabled } = masterState.config;
    let generatedNotes = [];
    const sixteenthNoteTicks = masterState.config.tempo / 60 * 16; 

    // --- Drums ---
    if (drumsEnabled) {
        // We are using a 16-step sequencer (4 beats * 4 sixteenths)
        const currentMeasure = Math.floor(currentTick / 16);
        const currentStep = currentTick % 16;

        // Kick (on beats 1 and 3)
        if (currentStep % 8 === 0) {
            if (currentTick > 0) { // Skip the very first kick
                generatedNotes.push({ instrument: 'kick', gain: 0.7 });
            }
        }

        // Snare (on beats 2 and 4)
        if ((currentStep - 4) % 8 === 0) {
            generatedNotes.push({ instrument: 'snare', gain: 1.0 });
        }

        // Hi-hat (every 8th note)
        if (currentStep % 2 === 0) {
            generatedNotes.push({ instrument: 'hat', gain: 0.4 });
        }
        
        // Crash (on the first beat of every 4th measure)
        if (currentMeasure % 4 === 0 && currentStep === 0) {
             if (currentTick > 0) { // Don't crash at the very beginning
                generatedNotes.push({ instrument: 'crash', gain: 0.6 });
             }
        }
        
        // Ride (every quarter note)
        if (currentStep % 4 === 0) {
             generatedNotes.push({ instrument: 'ride', gain: 0.5 });
        }
    }

    // --- Melodic Instruments (Placeholder) ---
    // This is where you would add logic for solo, accompaniment, and bass
    // For now, it's silent.

    return generatedNotes;
}


/**
 * Converts generated notes into a raw audio buffer.
 * @param {Array<Object>} notes - The notes to process.
 * @returns {Float32Array} The generated audio buffer for this chunk.
 */
function processAudio(notes) {
    const { chunkDuration, sampleRate } = masterState.config;
    const chunkLength = Math.floor(chunkDuration * sampleRate);
    const out_buffer = new Float32Array(chunkLength).fill(0);

    if (Object.keys(masterState.samples).length === 0) {
        return out_buffer;
    }

    notes.forEach(note => {
        const sample = masterState.samples[note.instrument];
        if (sample) {
            const gain = note.gain || 1.0;
            for (let i = 0; i < chunkLength && i < sample.length; i++) {
                out_buffer[i] += sample[i] * gain;
            }
        }
    });

    return out_buffer;
}

// --- Worker Control Logic ---

/**
 * Schedules the next chunk of music to be generated and sent.
 */
function scheduleNextChunk() {
    if (!masterState.isRunning) return;

    const { chunkDuration, tempo } = masterState.config;
    const sixteenthNoteDuration = 60 / tempo / 4;
    const notesToPlay = generateMusicChunk(masterState.tick);
    const audioChunk = processAudio(notesToPlay);

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: audioChunk,
            duration: chunkDuration
        }
    }, [audioChunk.buffer]);

    masterState.tick++;
    
    // Recalculate timeout for precision
    const now = performance.now();
    masterState.nextScheduleTime += (sixteenthNoteDuration * 1000);
    const nextTimeout = Math.max(0, masterState.nextScheduleTime - now);

    masterState.timeoutId = setTimeout(scheduleNextChunk, nextTimeout);
}

function start() {
    if (masterState.isRunning) return;
    masterState.isRunning = true;
    masterState.tick = 0;
    masterState.nextScheduleTime = performance.now(); // Reset timer to now
    self.postMessage({ type: 'started' });
    scheduleNextChunk();
}

function stop() {
    if (!masterState.isRunning) return;
    masterState.isRunning = false;
    if (masterState.timeoutId) {
        clearTimeout(masterState.timeoutId);
        masterState.timeoutId = null;
    }
    self.postMessage({ type: 'stopped' });
}


self.onmessage = function(event) {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            masterState.samples = data;
            // Signal back that samples are loaded and worker is ready
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            Object.assign(masterState.config, data);
            start();
            break;
        case 'stop':
            stop();
            break;
        case 'set_instruments':
            masterState.instruments = data;
            break;
        case 'toggle_drums':
            masterState.drumsEnabled = data.enabled;
            break;
    }
};


"use strict";

// --- State ---
let tick = 0;
let isRunning = false;
let timeoutId = null;
let samples = {};
let sampleRate = 44100;
let instruments = {};
let drumsEnabled = true;

// --- Timing Constants ---
const tempo = 80; // BPM
const beatsPerMeasure = 4;
const subdivisionsPerBeat = 4; // 16th notes
const sixteenthsPerMeasure = beatsPerMeasure * subdivisionsPerBeat;
const secondsPerSixteenth = 60.0 / tempo / subdivisionsPerBeat;


/**
 * Generates one chunk of audio data based on the current tick and instrument settings.
 */
function generateMusicChunk() {
    const chunkDuration = 0.5; // Generate 0.5s of audio at a time
    const samplesToGenerate = Math.floor(chunkDuration * sampleRate);
    const buffer = new Float32Array(samplesToGenerate).fill(0);

    // This is how many 16th notes fit into the chunk we are generating
    const sixteenthsInChunk = Math.ceil(chunkDuration / secondsPerSixteenth);

    const drumPatterns = {
        // SampleName: { pattern: [...], gain }
        // 1 = play, 0 = don't play. Pattern is 16 steps (one measure of 16th notes)
        'kick_drum6':       { pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], gain: 0.8 },
        'snare':            { pattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], gain: 1.0 },
        'closed_hi_hat_accented': { pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], gain: 0.5 }, // 8th notes
        'crash1':           { pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], gain: 0.6, interval: 8 }, // Every 8 measures
        'cymbal1':          { pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], gain: 0.4 }, // 16th notes
    };
    
    for (let i = 0; i < sixteenthsInChunk; i++) {
        const currentTick = tick + i;
        const measure = Math.floor(currentTick / sixteenthsPerMeasure);
        const stepInMeasure = currentTick % sixteenthsPerMeasure;

        // --- Instruments ---
        const timeOffsetInSamples = Math.floor(i * secondsPerSixteenth * sampleRate);

        // Drums
        if (drumsEnabled) {
            for (const [sampleName, def] of Object.entries(drumPatterns)) {
                if (def.interval && (measure % def.interval !== 0)) {
                    continue; // Skip if not on the right measure interval (for crash)
                }

                if (def.pattern[stepInMeasure] === 1) {
                    // Specific rule: Skip the very first kick
                    if (sampleName === 'kick_drum6' && currentTick === 0) {
                        continue;
                    }

                    const sampleData = samples[sampleName];
                    if (sampleData) {
                        for (let j = 0; j < sampleData.length; j++) {
                            if (timeOffsetInSamples + j < buffer.length) {
                                buffer[timeOffsetInSamples + j] += sampleData[j] * (def.gain ?? 1.0);
                            }
                        }
                    }
                }
            }
        }
        
        // --- Melodic Instruments (placeholder logic) ---
        // This is where you'd add logic for solo, accompaniment, and bass
        // For now, it's silent to focus on getting drums right.
    }

    tick += sixteenthsInChunk;
    return buffer;
}


/**
 * Schedules the next chunk of music to be generated and sent to the main thread.
 */
function scheduleNextChunk() {
    if (!isRunning) return;

    const chunk = generateMusicChunk();
    const duration = chunk.length / sampleRate;

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunk,
            duration: duration,
        }
    }, [chunk.buffer]);

    // Schedule the next one slightly before the current one ends
    const nextScheduleTime = duration * 1000 * 0.9;
    timeoutId = setTimeout(scheduleNextChunk, nextScheduleTime);
}

// --- Message Handling ---
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
            tick = 0;
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            scheduleNextChunk();
            break;

        case 'stop':
            if (!isRunning) return;
            isRunning = false;
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            break;

        case 'set_instruments':
            instruments = data;
            break;

        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;

        default:
            self.postMessage({ type: 'error', error: `Unknown command: ${command}` });
    }
};

self.onerror = (error) => {
    self.postMessage({ type: 'error', error: error.message });
};

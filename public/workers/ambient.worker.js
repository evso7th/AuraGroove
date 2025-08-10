// public/workers/ambient.worker.js

let sampleRate = 44100;
const CHUNK_DURATION = 1; // 1 second
let chunkSamples;
let instruments = {};
let drumsEnabled = true;
let isPlaying = false;
let nextGenerationTime = 0;
let scheduleTimeoutId = null;

// Store samples received from the main thread
const loadedSamples = {};

const DRUM_PATTERN_LENGTH_SECONDS = 8;
const DRUM_PATTERN = [
    // Bar 1
    { sample: 'kick', time: 0.0 }, { sample: 'hat', time: 0.0 },
    { sample: 'hat', time: 0.25 },
    { sample: 'snare', time: 0.5 }, { sample: 'hat', time: 0.5 },
    { sample: 'hat', time: 0.75 },
    // Bar 2
    { sample: 'kick', time: 1.0 }, { sample: 'hat', time: 1.0 },
    { sample: 'hat', time: 1.25 },
    { sample: 'snare', time: 1.5 }, { sample: 'hat', time: 1.5 },
    { sample: 'hat', time: 1.75 },
    // Bar 3
    { sample: 'kick', time: 2.0 }, { sample: 'hat', time: 2.0 },
    { sample: 'hat', time: 2.25 },
    { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 2.5 },
    { sample: 'hat', time: 2.75 },
    // Bar 4
    { sample: 'kick', time: 3.0 }, { sample: 'hat', time: 3.0 },
    { sample: 'kick', time: 3.25 }, { sample: 'hat', time: 3.25 },
    { sample: 'snare', time: 3.5 }, { sample: 'hat', time: 3.5 },
    { sample: 'hat', time: 3.75 },
    // Bar 5
    { sample: 'kick', time: 4.0 }, { sample: 'hat', time: 4.0 },
    { sample: 'hat', time: 4.25 },
    { sample: 'snare', time: 4.5 }, { sample: 'hat', time: 4.5 },
    { sample: 'hat', time: 4.75 },
    // Bar 6
    { sample: 'kick', time: 5.0 }, { sample: 'hat', time: 5.0 },
    { sample: 'hat', time: 5.25 },
    { sample: 'snare', time: 5.5 }, { sample: 'hat', time: 5.5 },
    { sample: 'hat', time: 5.75 },
    // Bar 7
    { sample: 'kick', time: 6.0 }, { sample: 'hat', time: 6.0 },
    { sample: 'hat', time: 6.25 },
    { sample: 'snare', time: 6.5 }, { sample: 'hat', time: 6.5 },
    { sample: 'hat', time: 6.75 },
    // Bar 8 (Fill)
    { sample: 'kick', time: 7.0 }, { sample: 'hat', time: 7.0 },
    { sample: 'kick', time: 7.25 }, { sample: 'hat', time: 7.25 },
    { sample: 'snare', time: 7.5 },
    { sample: 'snare', time: 7.625 },
    { sample: 'snare', time: 7.875 },
];


function generateDrums(startTime) {
    if (!drumsEnabled) return [];

    const notes = [];
    const patternStartTime = startTime % DRUM_PATTERN_LENGTH_SECONDS;

    for (const note of DRUM_PATTERN) {
        const timeInPattern = note.time;
        // Calculate the absolute time for the note in the current chunk
        let absoluteNoteTime = Math.floor(startTime / DRUM_PATTERN_LENGTH_SECONDS) * DRUM_PATTERN_LENGTH_SECONDS + timeInPattern;

        // Check if the note falls within the current chunk
        if (absoluteNoteTime >= startTime && absoluteNoteTime < startTime + CHUNK_DURATION) {
             notes.push({
                sample: note.sample,
                time: absoluteNoteTime,
            });
        }
    }
    return notes;
}

function mix(buffer, sampleData, startSample) {
    if (!sampleData) return;
    for (let i = 0; i < sampleData.length; i++) {
        if (startSample + i < buffer.length) {
            buffer[startSample + i] += sampleData[i] * 0.5; // Mix with 50% volume
        }
    }
}

function generateAudioChunk(startTime) {
    const chunkSamples = Math.floor(CHUNK_DURATION * sampleRate);
    const chunkBuffer = new Float32Array(chunkSamples).fill(0);

    const drumNotes = generateDrums(startTime);

    for (const note of drumNotes) {
        const sampleData = loadedSamples[note.sample];
        if (sampleData) {
            const startSample = Math.floor((note.time - startTime) * sampleRate);
            mix(chunkBuffer, sampleData, startSample);
        }
    }
    
    // Placeholder for other instruments
    // const soloPart = generatePart('solo', startTime);
    // ... mix soloPart
    // const accompanimentPart = generatePart('accompaniment', startTime);
    // ... mix accompanimentPart
    // const bassPart = generatePart('bass', startTime);
    // ... mix bassPart

    return chunkBuffer;
}


function scheduleGeneration() {
    if (!isPlaying) return;

    const now = performance.now() / 1000;
    const lookahead = 0.1; // 100ms

    if (nextGenerationTime < now + lookahead) {
        const chunk = generateAudioChunk(nextGenerationTime);
        
        self.postMessage({
            type: 'chunk',
            data: {
                chunk: chunk,
                duration: CHUNK_DURATION,
            },
        }, [chunk.buffer]);
        
        nextGenerationTime += CHUNK_DURATION;
    }

    scheduleTimeoutId = setTimeout(scheduleGeneration, CHUNK_DURATION * 1000 * 0.5);
}


self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'load_samples':
            Object.assign(loadedSamples, data);
            // THIS IS THE FIX: Acknowledge that samples have been loaded.
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            if (isPlaying) return;
            isPlaying = true;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            sampleRate = data.sampleRate;
            nextGenerationTime = 0; // Reset time
            self.postMessage({ type: 'generation_started' });
            scheduleGeneration();
            break;
        case 'stop':
            if (!isPlaying) return;
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
    }
};

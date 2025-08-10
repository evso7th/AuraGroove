// public/workers/ambient.worker.js

// Import the music generation logic
self.importScripts('/lib/fractal-music-generator.js');

let instruments = {
    solo: 'synthesizer',
    accompaniment: 'piano',
    bass: 'bass guitar',
};
let drumsEnabled = true;
let sampleRate = 44100;
let samples = {}; // To store decoded audio data for drums

let tempo = 100; // beats per minute
let beatDuration; // seconds per beat
let isPlaying = false;
let timerId = null;

let nextGenerationTime = 0;
let generationChunkDuration = 2; // Generate 2 seconds of audio at a time

// State for the 8-bar drum pattern
let drumPatternPosition = 0;

// --- Core Generation Loop ---
function generateAndPostChunk() {
    if (!isPlaying) return;

    const chunkStartTime = nextGenerationTime;
    const chunkEndTime = chunkStartTime + generationChunkDuration;

    let chunkParts = {
        solo: [],
        accompaniment: [],
        bass: [],
        drums: []
    };

    // --- Generate Instrument Parts (Placeholders) ---
    if (instruments.solo !== 'none') {
        chunkParts.solo = generateFractalSolo(chunkStartTime, generationChunkDuration);
    }
    if (instruments.accompaniment !== 'none') {
        chunkParts.accompaniment = generateFractalAccompaniment(chunkStartTime, generationChunkDuration);
    }
    if (instruments.bass !== 'none') {
        chunkParts.bass = generateFractalBass(chunkStartTime, generationChunkDuration);
    }
    
    // --- Generate Drum Part from the long pattern ---
    if (drumsEnabled) {
        const loopStartTimeBeats = (chunkStartTime / beatDuration) % DRUM_LOOP_DURATION_BEATS;
        const loopEndTimeBeats = (chunkEndTime / beatDuration) % DRUM_LOOP_DURATION_BEATS;

        for (const hit of DRUM_PATTERN_4_BARS) {
            // Check if the note falls within the current chunk's time range
            let hitTimeInBeats = hit.time;
            
            // This logic handles the loop correctly.
            // We check the pattern twice to catch notes that cross the loop boundary.
            for (let i = 0; i < 2; i++) {
                const currentLoopHitTimeBeats = hitTimeInBeats + i * DRUM_LOOP_DURATION_BEATS;
                const chunkStartBeats = (chunkStartTime / beatDuration);
                const chunkEndBeats = (chunkEndTime / beatDuration);

                if (currentLoopHitTimeBeats >= chunkStartBeats && currentLoopHitTimeBeats < chunkEndBeats) {
                     chunkParts.drums.push({
                        sample: hit.sample,
                        // Calculate precise time relative to the absolute start
                        time: currentLoopHitTimeBeats * beatDuration,
                    });
                }
            }
        }
    }


    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkParts,
            duration: generationChunkDuration
        }
    });

    nextGenerationTime += generationChunkDuration;

    // Schedule the next chunk generation
    // This timeout keeps the generation going.
    const delay = (nextGenerationTime - getCurrentTime()) * 1000 - 1000; // 1 sec lookahead
    timerId = setTimeout(generateAndPostChunk, Math.max(0, delay));
}


// --- Message Handling ---
self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'start':
            if (isPlaying) return;
            isPlaying = true;
            
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            sampleRate = data.sampleRate || 44100;
            tempo = data.tempo || 100;
            beatDuration = 60.0 / tempo;

            // Use a small offset to ensure the audio player has time to prepare
            const audioStartTime = getCurrentTime() + 0.2; 
            nextGenerationTime = audioStartTime;

            self.postMessage({ type: 'generation_started', data: { startTime: audioStartTime } });
            
            generateAndPostChunk();
            break;

        case 'stop':
            isPlaying = false;
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
            drumPatternPosition = 0;
            break;

        case 'set_instruments':
            instruments = data;
            break;

        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
        
        case 'load_samples':
            // The main thread now sends decoded Float32Array data
            for(const key in data) {
                if (data[key] instanceof Float32Array) {
                    samples[key] = data[key];
                }
            }
            break;
    }
};

// --- Utilities ---
let workerStartTime = Date.now();
function getCurrentTime() {
    return (Date.now() - workerStartTime) / 1000.0;
}


// public/workers/ambient.worker.js

function applyFadeOut(buffer) {
    const newBuffer = buffer.slice(); // Create a copy to avoid modifying the original
    for (let i = 0; i < newBuffer.length; i++) {
        const gain = 1 - (i / newBuffer.length);
        newBuffer[i] = newBuffer[i] * gain;
    }
    return newBuffer;
}


// A simple buffer to hold generated audio data
let audioData = {};
let sampleRate = 44100;
let isRunning = false;
let currentTick = 0;
let instruments = {};
let drumsEnabled = true;
let tempoBPM = 60;
let nextTickTime = 0;

const drumSamples = {
    kick: null,
    snare: null,
    hat: null,
    crash: null,
    ride: null,
};

function generateMusicChunk() {
    const beatsPerMeasure = 4;
    const ticksPerBeat = 4; // 16th notes
    const ticksPerMeasure = beatsPerMeasure * ticksPerBeat;
    const secondsPerBeat = 60.0 / tempoBPM;
    const secondsPerTick = secondsPerBeat / ticksPerBeat;
    const chunkSizeInSeconds = secondsPerTick; // Generate one tick at a time
    const chunkSizeInFrames = Math.floor(chunkSizeInSeconds * sampleRate);

    const chunk = new Float32Array(chunkSizeInFrames).fill(0);

    const drumPatterns = {
        kick: { pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], gain: 0.7 },
        snare: { pattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], gain: 1.0 },
        hat: { pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], gain: 0.5 },
        crash: { pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], gain: 0.8, measureDivisor: 4 },
        ride: { pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], gain: 1.0 }
    };
    
    if (drumsEnabled) {
        for (const [drum, sample] of Object.entries(drumSamples)) {
            if (sample) {
                const patternInfo = drumPatterns[drum];
                if (!patternInfo) continue;
                
                const pattern = patternInfo.pattern;
                const tickInPattern = currentTick % pattern.length;
                
                let play = pattern[tickInPattern] === 1;

                if (drum === 'kick' && currentTick === 0) {
                    play = false;
                }
                
                if (patternInfo.measureDivisor) {
                   const measure = Math.floor(currentTick / ticksPerMeasure);
                   if (measure % patternInfo.measureDivisor !== 0 || currentTick % ticksPerMeasure !== 0) {
                       play = false;
                   }
                }

                if (play) {
                    const gain = patternInfo.gain || 1.0;
                    for (let i = 0; i < Math.min(chunk.length, sample.length); i++) {
                        chunk[i] += sample[i] * gain;
                    }
                }
            }
        }
    }
    
    // Increment tick for the next chunk
    currentTick++;

    return { chunk, duration: chunkSizeInSeconds };
}


function scheduleNextChunk() {
    if (!isRunning) return;

    // Generate a small chunk of audio
    const { chunk, duration } = generateMusicChunk();

    // Post the chunk back to the main thread
    self.postMessage({
        type: 'chunk',
        data: {
            chunk,
            duration,
        }
    });

    // Schedule the next chunk generation
    // This creates a steady stream
    setTimeout(scheduleNextChunk, duration * 1000 / 2);
}


self.onmessage = (event) => {
    const { command, data } = event.data;

    if (command === 'load_samples') {
        for (const [key, value] of Object.entries(data)) {
            if (drumSamples.hasOwnProperty(key)) {
                if (key === 'crash') {
                    drumSamples[key] = applyFadeOut(value);
                } else {
                    drumSamples[key] = value;
                }
            }
        }
        self.postMessage({ type: 'samples_loaded' });
    } else if (command === 'start') {
        if (isRunning) return;
        isRunning = true;
        currentTick = 0;
        instruments = data.instruments;
        drumsEnabled = data.drumsEnabled;
        if(data.sampleRate) {
            sampleRate = data.sampleRate;
        }
        scheduleNextChunk();

    } else if (command === 'stop') {
        isRunning = false;
        
    } else if (command === 'set_instruments') {
        instruments = data;
    } else if (command === 'toggle_drums') {
        drumsEnabled = data.enabled;
    }
};

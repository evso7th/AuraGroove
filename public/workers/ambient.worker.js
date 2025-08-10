// AuraGroove - Ambient Music Generation Worker

// --- STATE ---
let isRunning = false;
let sampleRate = 44100;
let instruments = {
    solo: 'synthesizer',
    accompaniment: 'piano',
    bass: 'bass guitar'
};
let drumsEnabled = true;

// Audio buffers
const drumSamples = {}; // Will hold the decoded Float32Array data

// Music generation state
let phase = 0;
const a = 1.61803398875; // Golden ratio for variety
const baseFreq = 220.0; // A3

// --- COMMAND HANDLER ---
self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'start':
            start(data);
            break;
        case 'stop':
            stop();
            break;
        case 'set_instruments':
            setInstruments(data);
            break;
        case 'toggle_drums':
            toggleDrums(data);
            break;
        case 'load_samples':
            loadSamples(data);
            break;
    }
};

// --- COMMAND FUNCTIONS ---
function start(data) {
    if (isRunning) return;
    
    sampleRate = data.sampleRate;
    instruments = data.instruments;
    drumsEnabled = data.drumsEnabled;
    isRunning = true;
    
    self.postMessage({ type: 'generation_started' });
    generateMusicLoop();
}

function stop() {
    isRunning = false;
}

function setInstruments(newInstruments) {
    instruments = newInstruments;
}

function toggleDrums(data) {
    drumsEnabled = data.enabled;
}

function loadSamples(data) {
    // We expect the main thread to send us the raw Float32Array data
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            drumSamples[key] = data[key];
        }
    }
    console.log("Worker: Received and stored raw sample data for:", Object.keys(drumSamples).join(', '));
}


// --- MUSIC GENERATION CORE ---

function generateMusicLoop() {
    if (!isRunning) return;

    const chunkSize = Math.floor(sampleRate * 0.5); // 0.5 seconds of audio per chunk
    const chunkDuration = chunkSize / sampleRate;

    const chunkBuffer = new Float32Array(chunkSize).fill(0);

    // Generate parts
    const soloPart = generatePart(chunkSize, getInstrumentFunc(instruments.solo), baseFreq * 2, 8, 0.3);
    const accompanimentPart = generatePart(chunkSize, getInstrumentFunc(instruments.accompaniment), baseFreq, 4, 0.4);
    const bassPart = generatePart(chunkSize, getInstrumentFunc(instruments.bass), baseFreq / 2, 2, 0.6);
    
    let drumPart = new Float32Array(chunkSize).fill(0);
    if (drumsEnabled && drumSamples.snare) {
        drumPart = generateDrums(chunkSize, 0.2);
    }

    // Mix parts
    for (let i = 0; i < chunkSize; i++) {
        chunkBuffer[i] = soloPart[i] + accompanimentPart[i] + bassPart[i] + drumPart[i];
    }
    
    // Normalize (simple peak normalization)
    let maxAmp = 0;
    for (let i = 0; i < chunkSize; i++) {
        maxAmp = Math.max(maxAmp, Math.abs(chunkBuffer[i]));
    }
    if (maxAmp > 1.0) {
        for (let i = 0; i < chunkSize; i++) {
            chunkBuffer[i] /= maxAmp;
        }
    }

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkBuffer,
            duration: chunkDuration
        }
    }, [chunkBuffer.buffer]);

    phase += chunkDuration;

    setTimeout(generateMusicLoop, chunkDuration * 1000 / 2); // Generate a bit ahead
}

function generatePart(size, instrumentFunc, fundamental, complexity, amplitude) {
    const buffer = new Float32Array(size);
    for (let i = 0; i < size; i++) {
        const time = phase + i / sampleRate;
        let value = 0;
        for (let j = 1; j <= complexity; j++) {
            const freq = fundamental * (Math.floor(time * j * a) % j + 1);
            if (freq > 20 && freq < sampleRate / 2) {
                 value += instrumentFunc(time, freq) / j;
            }
        }
        buffer[i] = value * amplitude;
    }
    return buffer;
}

function generateDrums(size, amplitude) {
    const buffer = new Float32Array(size).fill(0);
    if (!drumSamples.snare) return buffer;

    // Pattern: snare on the 3rd beat of a 4/4 measure (at 120bpm)
    // A 4/4 measure at 120bpm is 2 seconds long. The 3rd beat is at 1 second.
    const beatDuration = 0.5; // at 120 bpm
    const measureDuration = beatDuration * 4;
    
    const timeOfSnareHit = Math.floor((phase % measureDuration) * sampleRate) + (2 * beatDuration * sampleRate) ;
    
    // Place snare sample if the time is right
    const startOfChunkInMeasure = phase % measureDuration;
    const endOfChunkInMeasure = (phase + size / sampleRate) % measureDuration;
    const snareHitTimeInMeasure = 2 * beatDuration;

    // Check if the snare hit falls within this chunk
    if (startOfChunkInMeasure <= snareHitTimeInMeasure && endOfChunkInMeasure > snareHitTimeInMeasure) {
        const startIndex = Math.floor((snareHitTimeInMeasure - startOfChunkInMeasure) * sampleRate);
        mixSample(buffer, drumSamples.snare, startIndex, amplitude);
    }
    
    return buffer;
}


function mixSample(targetBuffer, sample, startIndex, amplitude) {
    for (let i = 0; i < sample.length && startIndex + i < targetBuffer.length; i++) {
        targetBuffer[startIndex + i] += sample[i] * amplitude;
    }
}


// --- INSTRUMENT WAVEFORM GENERATORS ---
function getInstrumentFunc(instrument) {
    switch (instrument) {
        case 'piano': return pianoWave;
        case 'organ': return organWave;
        case 'bass guitar': return bassGuitarWave;
        case 'synthesizer':
        default:
            return synthWave;
    }
}

function synthWave(time, freq) {
    const t = time * 2 * Math.PI;
    return Math.sin(t * freq) * Math.exp(-time * 5);
}

function pianoWave(time, freq) {
    const t = time * 2 * Math.PI * freq;
    const d = time * 4;
    return (Math.sin(t) + 0.5 * Math.sin(t * 2) + 0.2 * Math.sin(t*3)) * Math.exp(-d);
}

function organWave(time, freq) {
    const t = time * 2 * Math.PI * freq;
    return (Math.sin(t) + Math.sin(t * 2) + Math.sin(t * 3)) / 3;
}

function bassGuitarWave(time, freq) {
    const t = time * 2 * Math.PI * freq;
    const d = time * 2;
    return (Math.sin(t) + 0.3 * Math.sin(t/2)) * Math.exp(-d);
}

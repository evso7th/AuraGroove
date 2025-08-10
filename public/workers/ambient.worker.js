
// === CONFIGURATION ===
const CHUNK_DURATION_SECONDS = 1; 
const NOTE_VELOCITY = 0.5;
const NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];

// === STATE ===
let sampleRate = 44100;
let isRunning = false;
let instruments = {
    solo: 'synthesizer',
    accompaniment: 'piano',
    bass: 'bass guitar'
};
let drumsEnabled = true;
let drumSamples = {};
let generationInterval;

// === DSP & SYNTHESIS ===

// --- Oscillators ---
function sine(t, freq) { return Math.sin(2 * Math.PI * freq * t); }
function square(t, freq) { return Math.sign(sine(t, freq)); }
function sawtooth(t, freq) { return 2 * (t * freq - Math.floor(0.5 + t * freq)); }
function triangle(t, freq) { return 2 * Math.abs(sawtooth(t, freq)) - 1; }

const oscillators = {
    'synthesizer': triangle,
    'piano': sawtooth,
    'organ': square,
    'bass guitar': sine
};

// --- ADSR Envelope ---
function adsr(t, attack, decay, sustain, release, duration) {
    const sustainLevel = 0.7;
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1 - (1 - sustainLevel) * (t - attack) / decay;
    if (t < duration - release) return sustainLevel;
    if (t < duration) return sustainLevel * (duration - t) / release;
    return 0;
}

// --- Note Frequency (Hz) ---
function noteToFreq(note) {
    const A4 = 440;
    const noteMap = { "C": -9, "D": -7, "E": -5, "F": -4, "G": -2, "A": 0, "B": 2 };
    const octave = parseInt(note.slice(-1));
    const key = note.slice(0, -1);
    const semitones = noteMap[key] + (octave - 4) * 12;
    return A4 * Math.pow(2, semitones / 12);
}

// --- Music Generation ---
function generateNotes(part) {
    let sequence;
    if (part === 'solo') {
        sequence = [
            { note: NOTES[Math.floor(Math.random() * NOTES.length)], time: 0, duration: 0.5 },
            { note: NOTES[Math.floor(Math.random() * NOTES.length)], time: 0.5, duration: 0.5 },
        ];
    } else if (part === 'accompaniment') {
        sequence = [
            { note: NOTES[Math.floor(Math.random() * 2)], time: 0, duration: 1.0 }
        ];
    } else { // bass
        sequence = [
            { note: "C2", time: 0, duration: 1.0 }
        ];
    }
    return sequence;
}

function generateDrums() {
    return [
        { sample: 'snare', time: 0.5, gain: 0.8 },
    ];
}


// --- Audio Rendering ---
function renderChunk() {
    const numSamples = Math.floor(CHUNK_DURATION_SECONDS * sampleRate);
    const chunkBuffer = new Float32Array(numSamples).fill(0);
    
    // Render melodic parts
    for (const part of ['solo', 'accompaniment', 'bass']) {
        const instrumentType = instruments[part];
        if (instrumentType === 'none') continue;

        const noteSequence = generateNotes(part);
        const oscillator = oscillators[instrumentType];

        for (const noteEvent of noteSequence) {
            const freq = noteToFreq(noteEvent.note);
            const startSample = Math.floor(noteEvent.time * sampleRate);
            const endSample = Math.floor((noteEvent.time + noteEvent.duration) * sampleRate);

            for (let i = startSample; i < endSample && i < numSamples; i++) {
                const t = (i - startSample) / sampleRate;
                const envelope = adsr(t, 0.01, 0.1, 0.7, 0.2, noteEvent.duration);
                chunkBuffer[i] += oscillator(i / sampleRate, freq) * envelope * NOTE_VELOCITY;
            }
        }
    }

    // Render drums
    if (drumsEnabled && drumSamples.snare) {
        const drumSequence = generateDrums();
        for (const hit of drumSequence) {
            if (drumSamples[hit.sample]) {
                const sampleData = drumSamples[hit.sample];
                const startSample = Math.floor(hit.time * sampleRate);
                for (let i = 0; i < sampleData.length && startSample + i < numSamples; i++) {
                    chunkBuffer[startSample + i] += sampleData[i] * (hit.gain || 1.0);
                }
            }
        }
    }
    
    // Normalize (simple peak normalization)
    let maxAmp = 0;
    for (let i = 0; i < numSamples; i++) {
        maxAmp = Math.max(maxAmp, Math.abs(chunkBuffer[i]));
    }
    if (maxAmp > 1.0) {
        for (let i = 0; i < numSamples; i++) {
            chunkBuffer[i] /= maxAmp;
        }
    }


    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkBuffer,
            duration: CHUNK_DURATION_SECONDS,
        }
    }, [chunkBuffer.buffer]);
}


// === Worker Event Handling ===
self.onmessage = function(e) {
    const { command, data } = e.data;

    if (command === 'start') {
        if (isRunning) return;
        isRunning = true;
        sampleRate = data.sampleRate;
        instruments = data.instruments;
        drumsEnabled = data.drumsEnabled;
        
        self.postMessage({ type: 'generation_started' });
        
        // Initial chunk
        renderChunk(); 
        
        // Subsequent chunks
        generationInterval = setInterval(renderChunk, CHUNK_DURATION_SECONDS * 1000);

    } else if (command === 'stop') {
        if (!isRunning) return;
        isRunning = false;
        if (generationInterval) {
            clearInterval(generationInterval);
            generationInterval = null;
        }

    } else if (command === 'set_instruments') {
        instruments = data;

    } else if (command === 'toggle_drums') {
        drumsEnabled = data.enabled;

    } else if (command === 'load_samples') {
        for (const key in data) {
            drumSamples[key] = data[key];
        }
        console.log('Worker: Received and stored raw sample data for:', Object.keys(data).join(', '));
    }
};

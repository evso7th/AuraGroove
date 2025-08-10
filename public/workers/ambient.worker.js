
// Import the music generation logic.
// This path is relative to the 'public' directory.
self.importScripts('/lib/fractal-music-generator.js');


// --- Worker State ---
let isRunning = false;
let sampleRate = 44100;
let instruments = {
    solo: 'synthesizer',
    accompaniment: 'piano',
    bass: 'bass guitar',
};
let drumsEnabled = true;
let samples = {}; // To store loaded audio samples like snare, kick, etc.

// Seed the random number generator for deterministic output
const random = lcg(Date.now());

// --- Synthesis Functions ---
// These functions convert MIDI notes into raw audio data (PCM).

const NOTE_DURATION_SECONDS = 0.5;
const GAIN = 0.2;

function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function createOscillator(type, frequency, duration, sampleRate) {
    const numSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(numSamples);
    const angularFrequency = 2 * Math.PI * frequency / sampleRate;

    for (let i = 0; i < numSamples; i++) {
        let sample = 0;
        switch (type) {
            case 'sine':
                sample = Math.sin(angularFrequency * i);
                break;
            case 'square':
                sample = Math.sign(Math.sin(angularFrequency * i));
                break;
            case 'sawtooth': // organ-like
                 sample = 2 * ( (i * frequency / sampleRate) % 1) - 1;
                break;
            case 'triangle': // piano-like
                 sample = 2 * Math.abs(2 * ( (i * frequency / sampleRate) % 1) - 1) - 1;
                break;
            default:
                sample = Math.sin(angularFrequency * i);
        }
        // Simple ADSR-like envelope
        const envelope = 1.0 - (i / numSamples);
        buffer[i] = sample * GAIN * envelope;
    }
    return buffer;
}

function getSynthTypeForInstrument(instrument) {
    switch (instrument) {
        case 'synthesizer': return 'sine';
        case 'organ': return 'sawtooth';
        case 'piano': return 'triangle';
        case 'bass guitar': return 'square';
        default: return 'sine';
    }
}


// --- Main Generation Loop ---

// We generate audio in small chunks to avoid blocking and send it to the main thread.
const CHUNK_DURATION_SECONDS = 0.5;

function generateAudioChunk() {
    const numSamplesInChunk = Math.floor(CHUNK_DURATION_SECONDS * sampleRate);
    const audioChunk = new Float32Array(numSamplesInChunk).fill(0);

    // Generate notes for each instrument
    const soloNotes = instruments.solo !== 'none' ? generateSimpleSolo(random) : [];
    const accompanimentNotes = instruments.accompaniment !== 'none' ? generateSimpleAccompaniment(random) : [];
    const bassNotes = instruments.bass !== 'none' ? generateSimpleBass(random) : [];

    // Mix the audio for each instrument into the main chunk
    [
        { notes: soloNotes, type: getSynthTypeForInstrument(instruments.solo) },
        { notes: accompanimentNotes, type: getSynthTypeForInstrument(instruments.accompaniment) },
        { notes: bassNotes, type: getSynthTypeForInstrument(instruments.bass) }
    ].forEach(({ notes, type }) => {
        if (!notes || notes.length === 0) return;
        
        notes.forEach(note => {
            const frequency = midiToFrequency(note);
            const noteBuffer = createOscillator(type, frequency, NOTE_DURATION_SECONDS, sampleRate);
            for (let i = 0; i < noteBuffer.length && i < numSamplesInChunk; i++) {
                audioChunk[i] += noteBuffer[i];
            }
        });
    });

    // Generate and mix drum samples
    if (drumsEnabled && samples.snare) { // Check if snare sample is loaded
        const beatsPerChunk = CHUNK_DURATION_SECONDS / (60 / 120); // Assume 120 BPM
        
        // This is a simplified drum pattern for stability
        const step = Math.floor(random() * 4); // Pick one beat per chunk randomly for now
        const drumBeat = simpleDrumPattern[step];

        drumBeat.forEach(drumHit => {
            if (samples[drumHit.sample]) {
                const sampleBuffer = samples[drumHit.sample];
                const startSample = Math.floor(drumHit.time * (numSamplesInChunk / beatsPerChunk));
                for(let i=0; i < sampleBuffer.length && startSample + i < numSamplesInChunk; i++) {
                    audioChunk[startSample + i] += sampleBuffer[i] * 0.5; // drum gain
                }
            }
        });
    }

    // Normalize to prevent clipping (simple version)
    let max = 0;
    for(let i=0; i < audioChunk.length; i++) {
        max = Math.max(max, Math.abs(audioChunk[i]));
    }
    if (max > 1) {
        for(let i=0; i < audioChunk.length; i++) {
            audioChunk[i] /= max;
        }
    }

    return audioChunk;
}


function startGeneration() {
    if (!isRunning) return;

    // IMPORTANT: Signal to the main thread that generation has started.
    // This prevents the UI from getting stuck in a "loading" state.
    self.postMessage({ type: 'generation_started' });

    const generationLoop = () => {
        if (!isRunning) return;
        
        const chunk = generateAudioChunk();
        
        self.postMessage({
            type: 'chunk',
            data: {
                chunk: chunk,
                duration: CHUNK_DURATION_SECONDS
            }
        }, [chunk.buffer]); // Transfer buffer ownership for performance

        // Schedule the next chunk generation
        setTimeout(generationLoop, CHUNK_DURATION_SECONDS * 1000 * 0.9); // Schedule slightly ahead
    };
    
    generationLoop();
}

// --- Worker Message Handling ---

self.onmessage = (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'start':
                isRunning = true;
                instruments = data.instruments;
                drumsEnabled = data.drumsEnabled;
                sampleRate = data.sampleRate;
                // Wait a moment for samples to be loaded before starting
                setTimeout(startGeneration, 100); 
                break;
            case 'stop':
                isRunning = false;
                break;
            case 'set_instruments':
                instruments = data;
                break;
            case 'toggle_drums':
                drumsEnabled = data.enabled;
                break;
            case 'load_samples':
                // The main thread sends decoded Float32Array data
                samples.snare = data.snare;
                // In a real app, you'd handle kick, hat, etc. the same way
                samples.kick = data.snare; // Using snare as placeholder for kick
                samples.hat = data.snare; // Using snare as placeholder for hat
                break;
            default:
                console.warn('Unknown worker command:', command);
        }
    } catch (error) {
        self.postMessage({
            type: 'error',
            error: error.message,
        });
    }
};

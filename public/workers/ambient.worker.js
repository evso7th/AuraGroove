// public/workers/ambient.worker.js

// --- Configuration ---
const CHUNK_DURATION_SECONDS = 1.0; // How much audio to generate per message
const LOOKAHEAD_SECONDS = 1.2; // How far ahead to schedule notes

// --- State ---
let sampleRate = 44100;
let tempoBPM = 60;
let isRunning = false;
let samples = {}; // To store decoded audio samples
let instruments = { // Default instruments
  solo: "none",
  accompaniment: "none",
  bass: "bass guitar",
};
let drumsEnabled = true;

// --- Timing ---
let secondsPerBeat;
let ticksPerChunk;
let currentTick = 0;

function updateTiming() {
    secondsPerBeat = 60.0 / tempoBPM;
    ticksPerChunk = CHUNK_DURATION_SECONDS / secondsPerBeat;
}

// --- Oscillators (for synthesized instruments) ---
// A simple sine wave oscillator
function sineWave(freq, time) {
    return Math.sin(freq * 2 * Math.PI * time);
}

// Note frequencies (simple mapping, can be expanded)
const noteFrequencies = {
    'E2': 82.41,
    'G2': 98.00,
    'A2': 110.00,
    'C3': 130.81,
};

// ADSR Envelope
function applyEnvelope(sample, time, duration, adsr) {
    const { attack, decay, sustain, release } = adsr;
    const totalDuration = attack + decay + release;
    if (time > totalDuration) return 0;

    let amplitude = 0;
    if (time < attack) {
        amplitude = time / attack; // Attack phase
    } else if (time < attack + decay) {
        amplitude = 1.0 - (1.0 - sustain) * ((time - attack) / decay); // Decay phase
    } else {
        amplitude = sustain - sustain * ((time - (attack + decay)) / release); // Release phase
    }
    return sample * Math.max(0, amplitude);
}

// --- Audio Generation ---
function generateAudioChunk() {
    const chunkSamples = Math.floor(CHUNK_DURATION_SECONDS * sampleRate);
    const buffer = new Float32Array(chunkSamples).fill(0);
    const ticksPerBar = 4; // Assuming 4/4 time signature
    
    // Function to apply a fade-out envelope to a sample
    function applyCrashFadeOut(sampleData) {
        const fadedSample = new Float32Array(sampleData.length);
        for (let i = 0; i < sampleData.length; i++) {
            const progress = i / sampleData.length;
            const gain = 1.0 - progress; // Linear fade-out
            fadedSample[i] = sampleData[i] * gain;
        }
        return fadedSample;
    }

    const crashSampleFaded = samples.crash ? applyCrashFadeOut(samples.crash) : null;

    for (let i = 0; i < chunkSamples; i++) {
        const time = i / sampleRate;
        const tick = currentTick + (time / secondsPerBeat);

        // --- Drums ---
        if (drumsEnabled) {
            // Kick on the first beat of every bar
            if (isBeat(tick, ticksPerBar, 0)) {
                 if (currentTick > 0) { // Skip the very first beat
                    mixSample(buffer, i, samples.kick, 0.5);
                    // Bass plays with the kick
                    if (instruments.bass === 'bass guitar') {
                        const freq = noteFrequencies['E2'];
                        const bassSound = sineWave(freq, time);
                        const adsr = { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.3 };
                        buffer[i] += applyEnvelope(bassSound, time, CHUNK_DURATION_SECONDS, adsr) * 0.6;
                    }
                }
            }
            // Snare on the third beat of every bar
            if (isBeat(tick, ticksPerBar, 2)) {
                mixSample(buffer, i, samples.snare, 1.0);
            }
            // Hi-hat on every beat
            if (isBeat(tick, ticksPerBar, 0) || isBeat(tick, ticksPerBar, 1) || isBeat(tick, ticksPerBar, 2) || isBeat(tick, ticksPerBar, 3)) {
                mixSample(buffer, i, samples.hat, 0.7);
            }
            // Crash on the first beat of every 4th bar
            if (isBeat(tick, ticksPerBar * 4, 0)) {
                if (crashSampleFaded) {
                   mixSample(buffer, i, crashSampleFaded, 0.9);
                }
            }
            // Ride on every quarter note
            if (isBeat(tick, 1, 0)) { // Every beat
                mixSample(buffer, i, samples.ride, 1.0);
            }
            // Tom fill at the end of every 4th bar
            const barNumber = Math.floor(tick / ticksPerBar);
            if (barNumber > 0 && barNumber % 4 === 3) {
                 if (isBeat(tick, 1, 3.5)) { mixSample(buffer, i, samples.tom1, 0.8); }
                 if (isBeat(tick, 1, 3.625)) { mixSample(buffer, i, samples.tom2, 0.8); }
                 if (isBeat(tick, 1, 3.75)) { mixSample(buffer, i, samples.tom3, 0.8); }
            }
        }
    }

    currentTick += ticksPerChunk;

    self.postMessage({ type: 'chunk', data: { chunk: buffer, duration: CHUNK_DURATION_SECONDS } }, [buffer.buffer]);
}

function isBeat(tick, division, beat, tolerance = 0.05) {
    const positionInDivision = tick % division;
    return Math.abs(positionInDivision - beat) < tolerance;
}

function mixSample(buffer, offset, sampleData, gain) {
    if (!sampleData) return;
    for (let j = 0; j < sampleData.length && offset + j < buffer.length; j++) {
        buffer[offset + j] += sampleData[j] * gain;
    }
}


// --- Control ---
function start() {
    if (isRunning) return;
    isRunning = true;
    currentTick = 0;
    updateTiming();
    
    // Generate initial chunks to fill the lookahead buffer
    const initialChunks = Math.ceil(LOOKAHEAD_SECONDS / CHUNK_DURATION_SECONDS);
    for (let i = 0; i < initialChunks; i++) {
        generateAudioChunk();
    }
    
    // Start the continuous generation loop
    const intervalId = setInterval(() => {
        if (!isRunning) {
            clearInterval(intervalId);
            return;
        }
        generateAudioChunk();
    }, CHUNK_DURATION_SECONDS * 1000);
}

function stop() {
    isRunning = false;
}

// --- Message Handling ---
self.onmessage = (event) => {
    const { command, data } = event.data;

    try {
        if (command === 'load_samples') {
            samples = data;
            self.postMessage({ type: 'samples_loaded' });
        } else if (command === 'start') {
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            start();
        } else if (command === 'stop') {
            stop();
        } else if (command === 'set_instruments') {
            instruments = data;
        } else if (command === 'toggle_drums') {
            drumsEnabled = data.enabled;
        } else if (command === 'set_tempo') {
            tempoBPM = data.tempo;
            updateTiming();
        }
    } catch (error) {
        self.postMessage({ type: 'error', error: error.message });
    }
};

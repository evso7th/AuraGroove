
// Simple synthesis functions
const createSineOscillator = (audioContext, freq, gain) => {
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(gain, audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    return { oscillator, gainNode };
};


// Global state for the worker
let audioContext = null;
let sampleRate = 44100;
let samples = {};
let isPlaying = false;
let instruments = {
    solo: 'none',
    accompaniment: 'none',
    bass: 'none'
};
let drumsEnabled = true;

let tempoBPM = 60;
let currentTick = 0;
let tickDuration = 0;

// =============================================================================
// DSP / Synthesis Functions
// =============================================================================

function applyExponentialDecay(sample) {
    const decayFactor = 0.9998;
    const decayedSample = new Float32Array(sample.length);
    let amp = 1.0;
    for (let i = 0; i < sample.length; i++) {
        decayedSample[i] = sample[i] * amp;
        amp *= decayFactor;
    }
    return decayedSample;
}


// =============================================================================
// Music Generation Logic
// =============================================================================
function generateBass(tick, duration) {
    const freq = 65.41; // E2
    const gain = 0.15;
    const attack = 0.01;
    const decay = 0.1;
    const numSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(numSamples).fill(0);

    for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const envelope = t < attack ? t / attack : Math.exp(-(t - attack) / decay);
        buffer[i] += Math.sin(2 * Math.PI * freq * t) * gain * envelope;
    }
    return buffer;
}


function generateDrums(tick, duration) {
    const numSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(numSamples).fill(0);

    const sixteenth = tick % 16;
    const eighth = tick % 8;
    const quarter = tick % 4;

    const addSample = (sampleName, gain = 1.0, condition = true) => {
        if (condition && samples[sampleName]) {
            const sample = samples[sampleName];
            const len = Math.min(sample.length, buffer.length);
            for (let i = 0; i < len; i++) {
                buffer[i] += sample[i] * gain;
            }
        }
    };
    
    // Kick: On beats 1 and 3 (with first beat skipped sometimes)
    addSample('kick', 0.4, quarter === 0 && tick > 0);

    // Snare: On beats 2 and 4
    addSample('snare', 1.0, quarter === 2);
    
    // Closed Hi-hat: on every 8th note
    addSample('hat', 0.5, eighth === 0);

    // Ride: every quarter note
    addSample('ride', 1.0, quarter === 0);

    // Crash: every 4 bars
    addSample('crash', 1.0, tick % 64 === 0);

    // Toms Fill at the end of every 4 bars
    if (tick % 64 >= 60) { // last beat of the 4-bar phrase
        addSample('tom1', 0.8, tick % 64 === 60);
        addSample('tom2', 0.8, tick % 64 === 61);
        addSample('tom3', 0.8, tick % 64 === 62);
    }
    
    return buffer;
}


function generateNextChunk() {
    tickDuration = 60 / tempoBPM / 4; // duration of a 16th note
    const numSamples = Math.floor(tickDuration * sampleRate);
    let combinedBuffer = new Float32Array(numSamples).fill(0);

    if (drumsEnabled) {
       const drumBuffer = generateDrums(currentTick, tickDuration);
        for(let i=0; i<numSamples; i++) {
            combinedBuffer[i] += drumBuffer[i];
        }
    }
    
    if (instruments.bass === 'bass guitar') {
         if (currentTick % 4 === 0 && currentTick > 0) { // Play on quarter notes with kick
            const bassBuffer = generateBass(currentTick, tickDuration);
            for(let i=0; i<numSamples; i++) {
                combinedBuffer[i] += bassBuffer[i];
            }
        }
    }

    currentTick = (currentTick + 1) % 64; // Loop every 4 bars (64 16th notes)

    return combinedBuffer;
}


// =============================================================================
// Worker Message Handling
// =============================================================================

function start() {
    if (isPlaying) return;
    isPlaying = true;
    currentTick = 0;
    
    const sendChunk = () => {
        if (!isPlaying) return;
        const chunk = generateNextChunk();
        self.postMessage({ type: 'chunk', data: { chunk, duration: tickDuration } }, [chunk.buffer]);
        setTimeout(sendChunk, tickDuration * 1000);
    };
    sendChunk();
}

function stop() {
    isPlaying = false;
}

self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            samples = data;
            // Pre-process crash sample
            if (samples.crash) {
                samples.crash = applyExponentialDecay(samples.crash);
            }
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            start();
            break;
        case 'stop':
            stop();
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
    }
};

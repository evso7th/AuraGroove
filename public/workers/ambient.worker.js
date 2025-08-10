
// Simple gain adjustment
const applyGain = (buffer, gain) => {
    const newBuffer = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        newBuffer[i] = buffer[i] * gain;
    }
    return newBuffer;
};

// Simple ADSR envelope
function applyADSR(buffer, adsr, sampleRate) {
    const { attack, decay, sustain, release } = adsr;
    const newBuffer = new Float32Array(buffer.length);
    const attackSamples = Math.floor(attack * sampleRate);
    const decaySamples = Math.floor(decay * sampleRate);
    const releaseSamples = Math.floor(release * sampleRate);
    const sustainSamples = buffer.length - attackSamples - decaySamples - releaseSamples;

    // Attack
    for (let i = 0; i < attackSamples; i++) {
        newBuffer[i] = buffer[i] * (i / attackSamples);
    }
    // Decay & Sustain
    for (let i = 0; i < decaySamples; i++) {
        const sampleIdx = attackSamples + i;
        newBuffer[sampleIdx] = buffer[sampleIdx] * (1.0 - (1.0 - sustain) * (i / decaySamples));
    }
    if (sustainSamples > 0) {
       for (let i = 0; i < sustainSamples; i++) {
            const sampleIdx = attackSamples + decaySamples + i;
            newBuffer[sampleIdx] = buffer[sampleIdx] * sustain;
        }
    }
     // Release
    for (let i = 0; i < releaseSamples; i++) {
        const sampleIdx = attackSamples + decaySamples + sustainSamples + i;
        if (sampleIdx >= buffer.length) break;
        newBuffer[sampleIdx] = buffer[sampleIdx] * (sustain - sustain * (i / releaseSamples));
    }


    return newBuffer;
}

// Function to mix multiple audio buffers
const mixSamples = (buffers) => {
    if (buffers.length === 0) return new Float32Array(0);
    const maxLength = Math.max(...buffers.map(b => b.length));
    const mixedBuffer = new Float32Array(maxLength);
    for (const buffer of buffers) {
        for (let i = 0; i < buffer.length; i++) {
            mixedBuffer[i] += buffer[i];
        }
    }
    // Basic clipping prevention
    for (let i = 0; i < mixedBuffer.length; i++) {
        mixedBuffer[i] = Math.max(-1, Math.min(1, mixedBuffer[i]));
    }
    return mixedBuffer;
};

// Function to generate a sine wave for a given frequency and duration
const generateSineWave = (frequency, sampleRate, duration, gain = 1.0) => {
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate));
    }
    return applyGain(buffer, gain);
};

const getNoteFrequency = (note) => {
    const notes = {
        'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31,
        'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
        'E1': 41.20, 'G1': 49.00
    };
    return notes[note] || 0;
};

const state = {
    isPlaying: false,
    tempoBPM: 60,
    instruments: {
      solo: "none",
      accompaniment: "none",
      bass: "none",
    },
    drumsEnabled: true,
    sampleRate: 44100,
    samples: {},
};

let tickInterval;
let currentTick = 0;

const applyFadeOut = (buffer) => {
    const newBuffer = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        const gain = 1.0 - (i / buffer.length);
        newBuffer[i] = buffer[i] * gain;
    }
    return newBuffer;
};

function generateMusicChunk() {
    if (!state.isPlaying) return;

    const tempoBPM = state.tempoBPM;
    const sampleRate = state.sampleRate;
    const instruments = state.instruments;
    const drumsEnabled = state.drumsEnabled;

    const noteDuration = 60 / tempoBPM / 2; // 8th note duration
    const chunkSize = Math.floor(sampleRate * noteDuration);

    const kickInterval = 4; // every 4 ticks (1 beat)
    const snareInterval = 8; // every 8 ticks (2 beats)
    const hatInterval = 2;   // every 2 ticks (1/2 beat)
    const rideInterval = 4; // every 4 ticks (1 beat)
    const crashInterval = 32; // every 32 ticks (4 beats)
    const tomInterval = 32; // every 32 ticks (4 beats)

    let drumSamples = [];
    if (drumsEnabled && Object.keys(state.samples).length > 0) {
        if (currentTick > 0 && currentTick % kickInterval === 0) {
            drumSamples.push(applyGain(state.samples.kick, 0.4));
        }
        if (currentTick % snareInterval === 4) {
            drumSamples.push(applyGain(state.samples.snare, 1.0));
        }
        if (currentTick % hatInterval === 0) {
            drumSamples.push(applyGain(state.samples.hat, 0.5));
        }
        if (currentTick % rideInterval === 0) {
            drumSamples.push(applyGain(state.samples.ride, 1.0));
        }
        if (currentTick > 0 && currentTick % crashInterval === 0) {
            const fadedCrash = applyFadeOut(state.samples.crash);
            drumSamples.push(applyGain(fadedCrash, 0.8));
        }

        if (currentTick > 0 && (currentTick + 4) % tomInterval === 0) {
             const tomIndex = (currentTick + 4) / tomInterval;
             if (tomIndex % 1 === 0) { // only on the beat
                if (currentTick % 2 === 0) { // stagger toms
                    const tomNumber = (currentTick / 2) % 3;
                    if (tomNumber === 0) drumSamples.push(applyGain(state.samples.tom1, 0.9));
                    if (tomNumber === 1) drumSamples.push(applyGain(state.samples.tom2, 0.9));
                }
             }
        }
         if (currentTick > 0 && (currentTick + 2) % tomInterval === 0) {
             if (currentTick % 2 === 0) { // stagger toms
                 drumSamples.push(applyGain(state.samples.tom3, 0.9));
             }
         }
    }

    let bassSamples = [];
    if (instruments.bass === 'bass guitar' && drumsEnabled && currentTick > 0 && currentTick % kickInterval === 0) {
         bassSamples.push(generateSineWave(getNoteFrequency('E2'), sampleRate, noteDuration, 0.15));
    }


    const drumMix = mixSamples(drumSamples);
    const bassMix = mixSamples(bassSamples);
    const finalMix = mixSamples([drumMix, bassMix]);


    const chunkBuffer = new Float32Array(chunkSize).fill(0);
    const length = Math.min(chunkBuffer.length, finalMix.length);
    for (let i = 0; i < length; i++) {
        chunkBuffer[i] = finalMix[i];
    }
    
    self.postMessage({ type: 'chunk', data: { chunk: chunkBuffer, duration: noteDuration } });
    
    currentTick++;
}


self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'start':
            if (state.isPlaying) return;
            state.isPlaying = true;
            state.instruments = data.instruments;
            state.drumsEnabled = data.drumsEnabled;
            state.sampleRate = data.sampleRate;
            currentTick = 0;
            const intervalMilliseconds = (60 / state.tempoBPM / 2) * 1000;
            tickInterval = setInterval(generateMusicChunk, intervalMilliseconds);
            break;
        case 'stop':
            state.isPlaying = false;
            if (tickInterval) clearInterval(tickInterval);
            currentTick = 0;
            break;
        case 'set_instruments':
            state.instruments = data;
            break;
        case 'toggle_drums':
            state.drumsEnabled = data.enabled;
            break;
        case 'load_samples':
            state.samples = data;
            self.postMessage({ type: 'samples_loaded' });
            break;
        default:
            self.postMessage({ type: 'error', error: `Unknown command: ${command}`});
    }
};

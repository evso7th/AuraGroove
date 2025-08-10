
// public/workers/ambient.worker.js

// --- State ---
let sampleRate = 44100;
let tempoBPM = 60;
let isRunning = false;
let instruments = {
    solo: 'none',
    accompaniment: 'none',
    bass: 'none',
};
let drumsEnabled = true;

// --- Timing ---
let secondsPerBeat;
let beatCounter = 0;
let nextBeatTime = 0;
let lookahead = 25.0; // ms
let scheduleAheadTime = 0.1; // s
let timerID;

// --- Synthesis & Samples ---
let samples = {};
let masterGain = 0.5;

// --- Oscillators for Synths ---
const oscillators = {
    synthesizer: (freq) => Math.sin(freq * 2 * Math.PI),
    piano: (freq, phase) => {
        let y = 0;
        for (let i = 1; i < 7; i++) {
            y += Math.sin(freq * i * 2 * Math.PI + phase) / i;
        }
        return y;
    },
    organ: (freq, phase) => {
        let y = 0;
        y += Math.sin(freq * 2 * Math.PI + phase);
        y += 0.5 * Math.sin(freq * 2 * 2 * Math.PI + phase);
        y += 0.25 * Math.sin(freq * 3 * 2 * Math.PI + phase);
        return y;
    },
     'bass guitar': (freq) => Math.sin(freq * 2 * Math.PI),
};

// --- Note Generation ---
const scales = {
    minorPentatonic: [0, 3, 5, 7, 10],
};

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// =============================================================================
//  AUDIO GENERATION
// =============================================================================

function generateAudioChunk(chunkSize) {
    const chunk = new Float32Array(chunkSize);
    let currentTime = beatCounter * secondsPerBeat;
    
    // --- Drum pattern ---
    const drumParts = { kick: 0, snare: 0, hat: 0, tom1: 0, tom2: 0, tom3: 0, crash: 0, ride: 0 };
    if (drumsEnabled) {
        if (beatCounter % 4 === 0) drumParts.kick = 0.5;
        if (beatCounter % 4 === 2) drumParts.snare = 0.7;
        if (beatCounter % 2 === 0 || beatCounter % 2 === 1) drumParts.hat = 0.4;
        
        // Toms on the last beat of every 4th bar
        const barNumber = Math.floor(beatCounter / 16);
        const beatInBar = beatCounter % 16;
        if (beatInBar === 15) {
             if (Math.abs(currentTime - (barNumber * 16 + 15.5) * secondsPerBeat) < 0.1) drumParts.tom1 = 0.6;
             if (Math.abs(currentTime - (barNumber * 16 + 15.75) * secondsPerBeat) < 0.1) drumParts.tom2 = 0.6;
             if (Math.abs(currentTime - (barNumber * 16 + 16) * secondsPerBeat) < 0.1) drumParts.tom3 = 0.6;
        }
    }

    // --- Bass Line ---
    let bassNote = 0;
     if (instruments.bass === 'bass guitar' && drumsEnabled) {
        if (beatCounter % 4 === 0) {
            bassNote = midiToFreq(36); // E2
        }
    }

    for (let i = 0; i < chunkSize; i++) {
        const time = currentTime + i / sampleRate;
        let finalSample = 0;

        // Add drums
        for (const [drum, gain] of Object.entries(drumParts)) {
            if (gain > 0 && samples[drum]) {
                const sampleIndex = Math.floor((time - (beatCounter * secondsPerBeat)) * sampleRate);
                if (sampleIndex < samples[drum].length) {
                    finalSample += samples[drum][sampleIndex] * gain;
                }
            }
        }
        
        // Add Bass
        if(bassNote > 0) {
             finalSample += oscillators['bass guitar'](bassNote) * 0.15;
        }

        chunk[i] = finalSample * masterGain;
    }
    
    return chunk;
}

// =============================================================================
//  SCHEDULER
// =============================================================================

function scheduler() {
    while (nextBeatTime < self.performance.now() + scheduleAheadTime * 1000) {
        const chunkSize = Math.floor(secondsPerBeat * sampleRate);
        const audioChunk = generateAudioChunk(chunkSize);
        
        if (audioChunk.length > 0) {
             self.postMessage({
                type: 'chunk',
                data: {
                    chunk: audioChunk,
                    duration: secondsPerBeat,
                },
            });
        }
        
        // Advance beat
        beatCounter++;
        nextBeatTime += secondsPerBeat * 1000;
    }
}

// =============================================================================
//  WORKER MESSAGE HANDLING
// =============================================================================

self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            samples = data;
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            secondsPerBeat = 60.0 / tempoBPM;
            isRunning = true;
            beatCounter = 0;
            nextBeatTime = self.performance.now();
            timerID = setInterval(scheduler, lookahead);
            break;
        case 'stop':
            isRunning = false;
            clearInterval(timerID);
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
        case 'set_tempo':
            tempoBPM = data.tempo;
            secondsPerBeat = 60.0 / tempoBPM;
            break;
        default:
            self.postMessage({ type: 'error', error: `Unknown command: ${command}` });
    }
};

self.postMessage({ type: 'worker_ready' });

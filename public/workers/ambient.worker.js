/**
 * NOTE: This is a simplified version for stability.
 * We will progressively add complexity back.
 */
importScripts('/lib/fractal-music-generator.js');

// --- State ---
let isRunning = false;
let sampleRate = 44100;
let instruments = {};
let drumsEnabled = true;
let samples = {}; // { snare: Float32Array, ... }
let rng = null;

// --- Music Generation Parameters ---
const BPM = 100;
const SECONDS_PER_BEAT = 60.0 / BPM;
const CHUNK_DURATION_SECONDS = SECONDS_PER_BEAT * 4; // 1 bar per chunk
const STEPS_PER_BEAT = 4; // 16th notes
const STEP_DURATION_SECONDS = SECONDS_PER_BEAT / STEPS_PER_BEAT;

let beat_in_bar = 0;

// --- DSP ---
const NOTE_FADE_SECONDS = 0.05;

// Instrument synthesis functions
const instrumentSynth = {
    synthesizer: (freq, time) => Math.sin(2 * Math.PI * freq * time) * Math.exp(-time * 5),
    piano: (freq, time) => {
        const d = Math.exp(-time * 4);
        let s = 0;
        for (let i = 1; i < 7; i++) {
            s += Math.sin(2 * Math.PI * freq * i * time) * Math.exp(-time * (i * 2)) / i;
        }
        return s * d;
    },
    organ: (freq, time) => {
        let s = 0;
        s += Math.sin(2 * Math.PI * freq * time);
        s += Math.sin(2 * Math.PI * freq * 2 * time) / 2;
        s += Math.sin(2 * Math.PI * freq * 4 * time) / 4;
        return s * Math.exp(-time * 1.5);
    },
    'bass guitar': (freq, time) => {
        const d = Math.exp(-time * 3);
        let s = 0;
        s += Math.sin(2 * Math.PI * freq * time);
        s += Math.sin(2 * Math.PI * freq * 1.5 * time) * 0.5;
        return s * d;
    }
};

function midiToFreq(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

function generateAudioChunk() {
    const chunkSamples = Math.floor(CHUNK_DURATION_SECONDS * sampleRate);
    const buffer = new Float32Array(chunkSamples).fill(0);
    
    // --- Generate Music ---
    for (let step = 0; step < BEATS_PER_BAR * STEPS_PER_BEAT; step++) {
        const stepTime = step * STEP_DURATION_SECONDS;
        const currentRandom = rng();

        // Music generation (placeholders for now)
        const notesToPlay = {
            solo: instruments.solo !== 'none' ? self.generateSimpleSolo(currentRandom) : [],
            accompaniment: instruments.accompaniment !== 'none' ? self.generateSimpleAccompaniment(currentRandom) : [],
            bass: instruments.bass !== 'none' ? self.generateSimpleBass(currentRandom) : [],
        };

        // Synthesize musical parts
        ['solo', 'accompaniment', 'bass'].forEach(part => {
            if (instruments[part] && instruments[part] !== 'none') {
                const synthFn = instrumentSynth[instruments[part]];
                notesToPlay[part].forEach(midiNote => {
                    const freq = midiToFreq(midiNote);
                    const noteDuration = SECONDS_PER_BEAT;
                    const samplesToRender = Math.floor(noteDuration * sampleRate);
                    const startSample = Math.floor(stepTime * sampleRate);
                    
                    for (let i = 0; i < samplesToRender && startSample + i < chunkSamples; i++) {
                        const t = i / sampleRate;
                        const sampleValue = synthFn(freq, t) * 0.2; // 0.2 volume
                        buffer[startSample + i] += sampleValue;
                    }
                });
            }
        });
        
        // --- Drums ---
        if (drumsEnabled) {
            const currentBeat = Math.floor(step / STEPS_PER_BEAT);
            const drumSteps = self.simpleDrumPattern[currentBeat] || [];
            
            drumSteps.forEach(drumStep => {
                 // Check if the current step matches the drum step's time within the beat
                if ((step % STEPS_PER_BEAT) / STEPS_PER_BEAT === drumStep.time) {
                    const drumSample = samples[drumStep.sample];
                    if (drumSample) {
                        const startSample = Math.floor(stepTime * sampleRate);
                        for (let i = 0; i < drumSample.length && startSample + i < chunkSamples; i++) {
                            buffer[startSample + i] += drumSample[i] * 0.4; // drum volume
                        }
                    }
                }
            });
        }
    }

    return buffer;
}


function startGeneration() {
    if (!isRunning) return;
    
    // Immediately tell the main thread we're good to go
    self.postMessage({ type: 'generation_started' });

    // Initial chunk
    const firstChunk = generateAudioChunk();
    self.postMessage({
        type: 'chunk',
        data: {
            chunk: firstChunk,
            duration: CHUNK_DURATION_SECONDS
        }
    }, [firstChunk.buffer]);


    // Continuous generation loop
    const generationLoop = () => {
        if (!isRunning) return;
        const chunk = generateAudioChunk();
        self.postMessage({
            type: 'chunk',
            data: {
                chunk: chunk,
                duration: CHUNK_DURATION_SECONDS
            }
        }, [chunk.buffer]);
    };
    
    // Set up interval for continuous generation
    const intervalId = setInterval(generationLoop, CHUNK_DURATION_SECONDS * 1000 * 0.9); // Generate slightly faster

    // Handle stopping
    const stopHandler = (e) => {
        if (e.data.command === 'stop') {
            isRunning = false;
            clearInterval(intervalId);
            self.removeEventListener('message', stopHandler);
        }
    }
    self.addEventListener('message', stopHandler)
}


// --- Main Message Handler ---
self.onmessage = (e) => {
    const { command, data } = e.data;

    switch (command) {
        case 'start':
            if (isRunning) return;
            isRunning = true;
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            rng = self.lcg(Date.now()); // Re-seed the generator
            startGeneration();
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
            // The `samples` object is now populated with raw Float32Array data
            Object.keys(data).forEach(key => {
                samples[key] = data[key];
            });
            break;
    }
};

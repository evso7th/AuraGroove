
// A simple random number generator with a seed
function seededRandom(seed) {
    let s = seed % 2147483647;
    if (s <= 0) s += 2147483646;
    return () => {
        s = (s * 16807) % 2147483647;
        return (s - 1) / 2147483646;
    };
}

let random = seededRandom(Date.now());

// Simple LFO
function createLfo(rate, depth) {
  let phase = 0;
  return (sampleRate) => {
    phase += rate / sampleRate;
    if (phase > 1) phase -= 1;
    return 1 + Math.sin(phase * 2 * Math.PI) * depth;
  };
}

// Synthesizer voice
function createVoice(type = 'sine', envelope, lfo) {
    let osc, env, filter;
    let noteOn = false;
    let frequency = 0;

    const setup = (sampleRate) => {
        osc = { type, phase: 0 };
        env = { ...envelope, value: 0, state: 'idle' };
        // Basic low-pass filter (optional, can be expanded)
        filter = { cutoff: 20000, resonance: 1, lowPass: 0, bandPass: 0 };
    };

    const start = (freq) => {
        frequency = freq;
        noteOn = true;
        env.state = 'attack';
    };

    const stop = () => {
        noteOn = false;
        env.state = 'release';
    };
    
    const isActive = () => {
        return env.state !== 'idle';
    }

    const process = (sampleRate) => {
        // Envelope
        switch (env.state) {
            case 'attack':
                env.value += 1 / (env.attack * sampleRate);
                if (env.value >= 1) {
                    env.value = 1;
                    env.state = 'decay';
                }
                break;
            case 'decay':
                env.value -= (1 - env.sustain) / (env.decay * sampleRate);
                if (env.value <= env.sustain) {
                    env.value = env.sustain;
                    env.state = 'sustain';
                }
                break;
            case 'sustain':
                if (!noteOn) env.state = 'release';
                break;
            case 'release':
                env.value -= env.sustain / (env.release * sampleRate);
                if (env.value <= 0) {
                    env.value = 0;
                    env.state = 'idle';
                }
                break;
        }

        if (env.state === 'idle') return 0;
        
        let lfoValue = lfo ? lfo(sampleRate) : 1;

        // Oscillator
        let signal;
        const currentFreq = frequency * lfoValue;
        
        switch (osc.type) {
            case 'sawtooth':
                signal = (osc.phase * 2) - 1;
                break;
            case 'square':
                signal = osc.phase < 0.5 ? 1 : -1;
                break;
            case 'triangle':
                signal = 2 * (osc.phase < 0.5 ? osc.phase : 1 - osc.phase) * 2 - 1;
                break;
            case 'sine':
            default:
                signal = Math.sin(osc.phase * 2 * Math.PI);
        }
        
        osc.phase += currentFreq / sampleRate;
        if (osc.phase > 1) osc.phase -= 1;
        
        return signal * env.value;
    };
    
    return { setup, start, stop, process, isActive };
}


// --- Instrument-specific Presets ---
const presets = {
    synthesizer: {
        oscillator: 'sawtooth',
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.5, release: 0.8 }
    },
    piano: {
        oscillator: 'triangle',
        envelope: { attack: 0.01, decay: 0.5, sustain: 0.2, release: 0.4 }
    },
    organ: {
        oscillator: 'square',
        envelope: { attack: 0.2, decay: 0.1, sustain: 0.9, release: 0.3 }
    },
    'bass guitar': {
        oscillator: 'sine',
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.5 }
    }
};

let instrumentsConfig = {
    solo: "none",
    accompaniment: "none",
    bass: "bass guitar",
};
let drumsEnabled = true;

const CHUNK_DURATION = 2.0; // 2 seconds per chunk
let sampleRate = 44100;
let isRunning = false;
let lastTickTime = 0;

let samples = {};

function generateDrumPart(duration, totalSamples) {
    const buffer = new Float32Array(totalSamples).fill(0);
    const pattern = [
        { time: 0, type: 'kick', velocity: 0.8 },
        { time: 0.5, type: 'hat', velocity: 0.6 },
        { time: 1.0, type: 'snare', velocity: 1.0 },
        { time: 1.5, type: 'hat', velocity: 0.6 },
    ];
    
    const tempo = 120; // BPM
    const beatDuration = 60 / tempo; // seconds per beat
    const totalBeats = duration / beatDuration;

    for (let i = 0; i < Math.floor(totalBeats * 4); i++) {
        const patternIndex = i % pattern.length;
        const hit = pattern[patternIndex];
        const timeInBeats = Math.floor(i / 4) * 4 + hit.time;
        const timeInSeconds = timeInBeats * beatDuration;
        
        if (timeInSeconds >= duration) continue;

        let sample = samples[hit.type];
        if (!sample) continue;

        const startSample = Math.floor(timeInSeconds * sampleRate);

        if (startSample + sample.length > buffer.length) {
           const shorterSample = samples['hat'];
           if(shorterSample && startSample + shorterSample.length <= buffer.length) {
              sample = shorterSample;
           } else {
             continue; // Skip if even the short sample doesn't fit
           }
        }
        
        for (let j = 0; j < sample.length; j++) {
            if (startSample + j < buffer.length) {
                 buffer[startSample + j] += sample[j] * hit.velocity;
            }
        }
    }

    return buffer;
}


function generateInstrumentPart(instrumentType, partType, duration, totalSamples) {
    if (instrumentType === 'none') {
        return new Float32Array(totalSamples).fill(0);
    }
    
    const preset = presets[instrumentType];
    const lfo = createLfo(0.5, 0.01); // Slow, subtle vibrato
    const voice = createVoice(preset.oscillator, preset.envelope, lfo);
    voice.setup(sampleRate);
    
    const buffer = new Float32Array(totalSamples).fill(0);

    // Super simple placeholder melody/harmony generation
    const notePatterns = {
        bass: [36, 40, 43, 38], // C2, E2, G2, D#2
        accompaniment: [60, 64, 67, 62], // C4, E4, G4, D4
        solo: [72, 76, 79, 74] // C5, E5, G5, D#5
    };
    
    const pattern = notePatterns[partType];
    const notesPerSecond = 1;
    
    voice.start(440 * Math.pow(2, (pattern[0] - 69) / 12));
    
    for (let i = 0; i < totalSamples; i++) {
        buffer[i] = voice.process(sampleRate) * 0.3; // Lower volume
    }

    return buffer;
}


self.onmessage = (event) => {
    const { command, data } = event.data;

    if (command === 'load_samples') {
        samples = data;
        self.postMessage({ type: 'samples_loaded' });
    } else if (command === 'start') {
        sampleRate = data.sampleRate || 44100;
        instrumentsConfig = data.instruments;
        drumsEnabled = data.drumsEnabled;
        startGenerator();
    } else if (command === 'stop') {
        stopGenerator();
    } else if (command === 'toggle_drums') {
        drumsEnabled = data.enabled;
    } else if (command === 'set_instruments') {
        instrumentsConfig = data;
    }
};

function startGenerator() {
    if (isRunning) return;
    isRunning = true;
    lastTickTime = performance.now() / 1000;
    runGenerator();
    console.log("Generator started");
}

function stopGenerator() {
    isRunning = false;
    console.log("Generator stopped");
}

function runGenerator() {
    if (!isRunning) return;

    const now = performance.now() / 1000;
    const duration = CHUNK_DURATION;

    // Generate parts
    const totalSamples = Math.floor(duration * sampleRate);

    const bassPart = generateInstrumentPart(instrumentsConfig.bass, 'bass', duration, totalSamples);
    const soloPart = generateInstrumentPart(instrumentsConfig.solo, 'solo', duration, totalSamples);
    const accompanimentPart = generateInstrumentPart(instrumentsConfig.accompaniment, 'accompaniment', duration, totalSamples);
    const drumPart = drumsEnabled ? generateDrumPart(duration, totalSamples) : null;
    
    // Mix parts
    const finalMix = new Float32Array(totalSamples).fill(0);
    for (let i = 0; i < totalSamples; i++) {
        let sample = 0;
        if (bassPart) sample += bassPart[i];
        if (soloPart) sample += soloPart[i];
        if (accompanimentPart) sample += accompanimentPart[i];
        if (drumPart) sample += drumPart[i];

        // Basic limiter to prevent clipping
        finalMix[i] = Math.max(-1, Math.min(1, sample));
    }
    
    const chunk = finalMix;

    self.postMessage({ type: 'chunk', data: { chunk, duration } }, [chunk.buffer]);
    
    lastTickTime += duration;

    const nextTickDelay = Math.max(0, (lastTickTime - (performance.now() / 1000))) * 1000;

    setTimeout(runGenerator, nextTickDelay);
}

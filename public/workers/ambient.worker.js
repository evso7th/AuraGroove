/**
 * AuraGroove Ambient Music Worker
 *
 * This worker is responsible for the real-time procedural generation of ambient music.
 * It operates independently of the main UI thread to prevent performance issues.
 *
 * Architecture:
 * - The worker receives commands from the main thread ('start', 'stop', 'set_instruments', etc.).
 * - It pre-loads raw audio sample data (e.g., for drums) sent from the main thread.
 * - Music is generated in small, sequential chunks (e.g., 4 beats at a time).
 * - Each chunk is an array of floating-point numbers representing the audio waveform.
 * - The generated audio chunks are sent back to the main thread for scheduling and playback via the Web Audio API.
 * - It uses simple synthesis for melodic parts and sample-based generation for drums.
 * - Drum patterns use Markov chains for natural, non-repetitive transitions.
 */

// --- State and Configuration ---
let isRunning = false;
let sampleRate = 44100;
let tempo = 100; // bpm
let currentBeat = 0;
let instruments = {
    solo: 'synthesizer',
    accompaniment: 'piano',
    bass: 'bass guitar'
};
let drumsEnabled = true;

const samples = {}; // To store raw sample data (Float32Array)

// --- Drum Generation with Markov Chains ---

// Drum sample mapping
const DRUM_SAMPLES = {
    KICK: 'kick_drum6',
    SNARE: 'snare',
    SNARE_GHOST: 'snare_ghost_note',
    HAT_CLOSED: 'closed_hi_hat_accented',
    HAT_GHOST: 'closed_hi_hat_ghost',
    CYMBAL_BELL: 'cymbal_bell1',
};

// Drum Patterns (16 steps per bar, 4 bars per pattern)
const drumPatterns = {
    patternA: [
        // Bar 1
        { sample: DRUM_SAMPLES.KICK, steps: [0] },
        { sample: DRUM_SAMPLES.HAT_CLOSED, steps: [0, 4, 8, 12] },
        { sample: DRUM_SAMPLES.HAT_GHOST, steps: [2, 6, 10, 14] },
        // Bar 2
        { sample: DRUM_SAMPLES.KICK, steps: [16] },
        { sample: DRUM_SAMPLES.HAT_CLOSED, steps: [16, 20, 24, 28] },
        { sample: DRUM_SAMPLES.HAT_GHOST, steps: [18, 22, 26, 30] },
        // Bar 3
        { sample: DRUM_SAMPLES.KICK, steps: [32] },
        { sample: DRUM_SAMPLES.HAT_CLOSED, steps: [32, 36, 40, 44] },
        { sample: DRUM_SAMPLES.SNARE_GHOST, steps: [44] },
        // Bar 4
        { sample: DRUM_SAMPLES.KICK, steps: [48] },
        { sample: DRUM_SAMPLES.HAT_CLOSED, steps: [48, 52, 56, 60] },
        { sample: DRUM_SAMPLES.CYMBAL_BELL, steps: [48] },
    ],
    patternB: [
        // Bar 1 & 2 (same as A)
        ...JSON.parse(JSON.stringify(drumPatterns.patternA.slice(0, 6))),
        // Bar 3
        { sample: DRUM_SAMPLES.KICK, steps: [32] },
        { sample: DRUM_SAMPLES.HAT_CLOSED, steps: [32, 36, 40, 44] },
        { sample: DRUM_SAMPLES.SNARE_GHOST, steps: [40, 44] },
         // Bar 4
        { sample: DRUM_SAMPLES.KICK, steps: [48, 58] },
        { sample: DRUM_SAMPLES.HAT_CLOSED, steps: [48, 52, 56, 60] },
        { sample: DRUM_SAMPLES.SNARE_GHOST, steps: [56] },
    ],
    fillA: [
        // Bars 1-3 are silent to lead into the fill
        // Bar 4
        { sample: DRUM_SAMPLES.SNARE_GHOST, steps: [48, 50, 54, 56] },
        { sample: DRUM_SAMPLES.CYMBAL_BELL, steps: [58] },
    ]
};

// Markov Chain for pattern transitions
const drumStateTransitions = {
    patternA: { patternA: 0.7, patternB: 0.2, fillA: 0.1 },
    patternB: { patternA: 0.8, patternB: 0.1, fillA: 0.1 },
    fillA: { patternA: 1.0, patternB: 0.0, fillA: 0.0 } // A fill always returns to patternA
};

let currentDrumPatternName = 'patternA';
let patternStep = 0;
const PATTERN_LENGTH_BEATS = 16; // 4 bars * 4 beats/bar

function getNextDrumPattern() {
    const transitions = drumStateTransitions[currentDrumPatternName];
    let rand = Math.random();
    for (const patternName in transitions) {
        rand -= transitions[patternName];
        if (rand <= 0) {
            return patternName;
        }
    }
    return 'patternA'; // Fallback
}

// --- Synthesis Functions ---

// Oscillator function for basic synth sounds
function oscillator(freq, time, type = 'sine') {
    switch (type) {
        case 'sine':
            return Math.sin(freq * 2 * Math.PI * time);
        case 'square':
            return Math.sign(Math.sin(freq * 2 * Math.PI * time));
        case 'sawtooth':
            return 2 * (time * freq - Math.floor(0.5 + time * freq));
        case 'triangle':
            return 2 * Math.abs(2 * (time * freq - Math.floor(0.5 + time * freq))) - 1;
        default:
            return 0;
    }
}

// ADSR Envelope
function adsr(time, attack, decay, sustain, release, duration) {
    if (time < attack) return time / attack;
    if (time < attack + decay) return 1.0 - ((time - attack) / decay) * (1.0 - sustain);
    if (time < duration) return sustain;
    // Release is handled by the note duration
    return 0;
}

// --- Music Generation ---

function generateMusicChunk(chunkDuration) {
    const beatsPerSecond = tempo / 60;
    const samplesPerChunk = Math.floor(sampleRate * chunkDuration);
    const chunk = new Float32Array(samplesPerChunk).fill(0);

    const notes = []; // { freq, start, duration, instrument, volume }
    const beatsInChunk = chunkDuration * beatsPerSecond;

    // --- Part Generation ---
    if (instruments.bass !== 'disabled') {
        // Simple bass: one long note per chunk
        const bassFreq = mtof(36); // C2
        notes.push({ freq: bassFreq, start: 0, duration: chunkDuration, instrument: 'bass', volume: 0.4 });
    }
    
    if (instruments.accompaniment !== 'disabled') {
        // Simple accompaniment: one chord per chunk
        const chord = [60, 64, 67]; // C Major
        chord.forEach(note => {
            notes.push({ freq: mtof(note), start: 0, duration: chunkDuration, instrument: 'accompaniment', volume: 0.3 });
        });
    }

    if (instruments.solo !== 'disabled') {
        // Simple solo: a few random notes from a scale
        const scale = [60, 62, 64, 65, 67, 69, 71]; // C Major scale
        for(let i = 0; i < 2; i++) {
             const note = scale[Math.floor(Math.random() * scale.length)];
             const start = Math.random() * chunkDuration * 0.8;
             const duration = 0.5;
             notes.push({ freq: mtof(note), start, duration, instrument: 'solo', volume: 0.5 });
        }
    }

    // --- Synthesize melodic parts ---
    for (let i = 0; i < samplesPerChunk; i++) {
        const time = i / sampleRate;
        let sampleValue = 0;

        notes.forEach(note => {
            if (time >= note.start && time < note.start + note.duration) {
                const noteTime = time - note.start;
                let envelope = 1;
                let wave = 0;

                if (note.instrument === 'bass') {
                    envelope = adsr(noteTime, 0.05, 0.2, 0.7, 0.3, note.duration);
                    wave = oscillator(note.freq, noteTime, 'sine');
                } else if (note.instrument === 'accompaniment') {
                     envelope = adsr(noteTime, 0.2, 0.4, 0.5, 0.4, note.duration);
                     wave = oscillator(note.freq, noteTime, 'triangle');
                } else if (note.instrument === 'solo') {
                    envelope = adsr(noteTime, 0.1, 0.3, 0.6, 0.2, note.duration);
                    wave = oscillator(note.freq, noteTime, 'sawtooth');
                }
                sampleValue += wave * envelope * note.volume;
            }
        });
        chunk[i] += sampleValue;
    }
    
    // --- Generate drum parts ---
    if (drumsEnabled) {
        const secondsPerBeat = 60.0 / tempo;
        const totalStepsInPattern = 64; // 4 bars * 16 steps

        if (patternStep >= totalStepsInPattern) {
            currentDrumPatternName = getNextDrumPattern();
            patternStep = 0;
        }

        const patternData = drumPatterns[currentDrumPatternName];
        
        for (const part of patternData) {
            const sampleData = samples[part.sample];
            if (!sampleData) continue;

            for (const step of part.steps) {
                // Check if the step falls within the current chunk
                const stepOffset = step - patternStep;
                const timeInChunk = stepOffset * secondsPerBeat / 4; // 16th notes

                if (timeInChunk >= 0 && timeInChunk < chunkDuration) {
                    const startSample = Math.floor(timeInChunk * sampleRate);
                    // Mix sample into the chunk
                    for (let i = 0; i < sampleData.length && startSample + i < chunk.length; i++) {
                        chunk[startSample + i] += sampleData[i] * 0.7; // Mix volume for drums
                    }
                }
            }
        }
        patternStep += beatsInChunk * 4; // Advance pattern steps
    }

    // --- Clipping ---
    for (let i = 0; i < chunk.length; i++) {
        chunk[i] = Math.max(-1, Math.min(1, chunk[i]));
    }
    
    currentBeat += beatsInChunk;

    return chunk;
}

function mtof(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}


// --- Worker Main Loop ---
function loop() {
    if (!isRunning) return;

    const chunkDuration = 4 * (60 / tempo); // Generate 4 beats at a time
    const audioChunk = generateMusicChunk(chunkDuration);

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: audioChunk,
            duration: chunkDuration
        }
    }, [audioChunk.buffer]);

    setTimeout(loop, chunkDuration * 1000 / 2); // Generate next chunk halfway through the current one
}


// --- Message Handling ---
self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'start':
            if (isRunning) return;
            isRunning = true;
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            currentBeat = 0;
            patternStep = 0;
            currentDrumPatternName = 'patternA';
            self.postMessage({ type: 'generation_started' });
            loop();
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
            for (const key in data) {
                if (data.hasOwnProperty(key)) {
                    samples[DRUM_SAMPLES[key.toUpperCase()]] = data[key];
                    console.log(`Worker: Received and stored raw sample data for: ${key}`);
                }
            }
            break;
    }
};

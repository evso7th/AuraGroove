// Simple generative music worker
// This is a simplified example and can be expanded with more complex algorithms.

// --- State ---
let isRunning = false;
let sampleRate = 44100;
let instruments = { solo: 'none', accompaniment: 'none', bass: 'none' };
let drumsEnabled = true;
let samples = {}; // To hold the decoded audio data for drums

let soloSynthesizer, accompanimentSynthesizer, bassSynthesizer;
let mainLoopId = null;

// --- DSP & Synthesis (Basic) ---
// A very simple oscillator class
class Oscillator {
    constructor(type = 'sine') {
        this.type = type;
        this.phase = 0;
    }

    process(freq, detune = 0) {
        const finalFreq = freq * Math.pow(2, detune / 1200);
        const increment = finalFreq / sampleRate;
        let value = 0;

        switch (this.type) {
            case 'sine':
                value = Math.sin(this.phase * 2 * Math.PI);
                break;
            case 'square':
                value = Math.sign(Math.sin(this.phase * 2 * Math.PI));
                break;
            case 'sawtooth':
                 value = (this.phase % 1.0) * 2.0 - 1.0;
                break;
            case 'triangle':
                value = Math.asin(Math.sin(this.phase * 2 * Math.PI)) * (2/Math.PI);
                break;
            default:
                value = Math.sin(this.phase * 2 * Math.PI);
        }

        this.phase += increment;
        if (this.phase > 1) this.phase -= 1;
        return value;
    }
}

// A simple ADSR envelope
class Envelope {
    constructor(attack, decay, sustain, release) {
        this.attack = attack;
        this.decay = decay;
        this.sustain = sustain;
        this.releaseTime = release;
        this.value = 0;
        this.state = 'idle'; // idle, attack, decay, sustain, release
    }

    trigger() {
        this.state = 'attack';
    }

    release() {
        this.state = 'release';
    }

    process() {
        const attackSamples = this.attack * sampleRate;
        const decaySamples = this.decay * sampleRate;
        const releaseSamples = this.releaseTime * sampleRate;

        switch (this.state) {
            case 'attack':
                this.value += 1.0 / attackSamples;
                if (this.value >= 1.0) {
                    this.value = 1.0;
                    this.state = 'decay';
                }
                break;
            case 'decay':
                this.value -= (1.0 - this.sustain) / decaySamples;
                if (this.value <= this.sustain) {
                    this.value = this.sustain;
                    this.state = 'sustain';
                }
                break;
            case 'sustain':
                // Value remains at sustain level
                break;
            case 'release':
                this.value -= this.sustain / releaseSamples;
                if (this.value <= 0) {
                    this.value = 0;
                    this.state = 'idle';
                }
                break;
        }
        return this.value;
    }
}

// Simple synthesizer
class Synthesizer {
    constructor(type) {
        this.osc = new Oscillator(type);
        this.env = new Envelope(0.1, 0.2, 0.5, 0.8);
        this.active = false;
        this.note = 0;
    }

    play(note) {
        this.note = note;
        this.env.trigger();
        this.active = true;
    }

    stop() {
        this.env.release();
    }

    process() {
        if (this.env.state === 'idle') {
            this.active = false;
            return 0;
        }
        const freq = 440 * Math.pow(2, (this.note - 69) / 12);
        const envValue = this.env.process();
        return this.osc.process(freq) * envValue * 0.5;
    }
}

// --- Music Generation (Simple) ---
const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
};
const currentScale = scales.major;
const baseNote = 60; // C4

function getRandomNoteInScale() {
    const scaleNote = currentScale[Math.floor(Math.random() * currentScale.length)];
    const octave = Math.floor(Math.random() * 3) -1; // -1, 0, or 1
    return baseNote + scaleNote + (octave * 12);
}

// --- Drum Machine (Simple) ---
let drumSequencer;

class DrumSequencer {
    constructor() {
        this.patterns = {
            basic: [
                { note: 'kick', steps: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
                { note: 'snare', steps: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0] },
                { note: 'hat', steps: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
                 { note: 'ride', steps: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0] },
                { note: 'crash', steps: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
            ],
        };
        this.currentPattern = 'basic';
        this.step = 0;
        this.stepsPerBeat = 4;
        this.beatsPerBar = 4;
        this.bar = 0;
    }
    
    getNotesForStep() {
        const notes = [];
        const pattern = this.patterns[this.currentPattern];
        
        // Simple logic for crash every 4 bars
        if (this.bar % 4 === 0 && this.step === 0) {
            notes.push('crash');
        }

        for (const instrument of pattern) {
             if (instrument.note === 'crash') continue; // Handled separately
            if (instrument.steps[this.step]) {
                notes.push(instrument.note);
            }
        }
        
        return notes;
    }

    advance() {
        this.step = (this.step + 1) % (this.stepsPerBeat * this.beatsPerBar);
        if (this.step === 0) {
            this.bar++;
        }
    }
}


function initializeSynthesizers() {
    const synthTypes = {
        synthesizer: 'sawtooth',
        piano: 'triangle',
        organ: 'square',
    }
    soloSynthesizer = instruments.solo !== 'none' ? new Synthesizer(synthTypes[instruments.solo]) : null;
    accompanimentSynthesizer = instruments.accompaniment !== 'none' ? new Synthesizer(synthTypes[instruments.accompaniment]) : null;
    bassSynthesizer = instruments.bass !== 'none' ? new Synthesizer('sine') : null;
}

// --- Main Loop ---
function generateAudioChunk() {
    const chunkSize = 2048; // A small buffer size for low latency
    const buffer = new Float32Array(chunkSize);
    
    // Musical decisions (very simple)
    const shouldPlaySolo = Math.random() < 0.1;
    const shouldPlayAccomp = Math.random() < 0.2;
    const shouldPlayBass = Math.random() < 0.4;
    
    if (soloSynthesizer && !soloSynthesizer.active && shouldPlaySolo) {
        soloSynthesizer.play(getRandomNoteInScale() + 12);
    }
    if (accompanimentSynthesizer && !accompanimentSynthesizer.active && shouldPlayAccomp) {
        accompanimentSynthesizer.play(getRandomNoteInScale());
    }
    if (bassSynthesizer && !bassSynthesizer.active && shouldPlayBass) {
        bassSynthesizer.play(getRandomNoteInScale() - 12);
    }

    // Drum sequence
    const drumNotes = drumsEnabled ? drumSequencer.getNotesForStep() : [];

    for (let i = 0; i < chunkSize; i++) {
        let sample = 0;
        
        if (soloSynthesizer) sample += soloSynthesizer.process();
        if (accompanimentSynthesizer) sample += accompanimentSynthesizer.process();
        if (bassSynthesizer) sample += bassSynthesizer.process();
        
        // Mix in drums
        for (const note of drumNotes) {
            if (samples[note] && i < samples[note].length) {
                sample += samples[note][i] * 0.8; // Mix drum sample
            }
        }

        buffer[i] = Math.max(-1, Math.min(1, sample)); // Clamp to avoid clipping
    }
    
    // Move to the next step in the drum sequence after processing the chunk
    drumSequencer.advance();


    // Release notes randomly
    if (soloSynthesizer?.active && Math.random() < 0.05) soloSynthesizer.stop();
    if (accompanimentSynthesizer?.active && Math.random() < 0.05) accompanimentSynthesizer.stop();
    if (bassSynthesizer?.active && Math.random() < 0.05) bassSynthesizer.stop();


    self.postMessage({
        type: 'chunk',
        data: {
            chunk: buffer,
            duration: chunkSize / sampleRate
        }
    });
}

// --- Message Handling ---
self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            samples = data;
            // Acknowledge that samples are loaded and worker is ready
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            if (isRunning) return;
            isRunning = true;
            sampleRate = data.sampleRate || 44100;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            initializeSynthesizers();
            drumSequencer = new DrumSequencer();
            mainLoopId = setInterval(generateAudioChunk, (2048 / sampleRate) * 1000 * 0.9); // Run slightly faster to keep buffer full
            break;
        case 'stop':
            if (!isRunning) return;
            isRunning = false;
            clearInterval(mainLoopId);
            mainLoopId = null;
            break;
        case 'set_instruments':
            instruments = data;
            initializeSynthesizers();
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
    }
};

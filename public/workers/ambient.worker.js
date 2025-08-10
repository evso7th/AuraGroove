// public/workers/ambient.worker.js

// --- State ---
let isRunning = false;
let instruments = { solo: 'none', accompaniment: 'none', bass: 'none' };
let drumsEnabled = true;
let samples = {};
let sampleRate = 44100;

let currentStep = 0;
const stepsPerBar = 16;
const tempo = 70; // BPM
const sixteenthNoteTime = 60 / tempo / 4;
const chunkSizeSeconds = sixteenthNoteTime * 4; // Generate 4 steps (a quarter note) at a time

// --- Chord Progression & Scales ---
const C_MAJOR_SCALE = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
const AM_PENTATONIC_SCALE = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4'];
const BASS_NOTES = ['C2', 'G1', 'A1', 'F1'];

let lastNoteIndices = {
    solo: 0,
    accompaniment: 0,
    bass: 0
};

// --- Main Message Handler ---
self.onmessage = function(e) {
    const { command, data } = e.data;
    switch (command) {
        case 'load_samples':
            samples = data;
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            isRunning = true;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            sampleRate = data.sampleRate;
            currentStep = 0;
            scheduleNextChunk();
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
    }
};


// --- Music Generation ---

function scheduleNextChunk() {
    if (!isRunning) return;
    
    const chunk = generateMusicChunk();
    self.postMessage({ type: 'chunk', data: { chunk, duration: chunkSizeSeconds } });
    
    currentStep = (currentStep + 4) % (stepsPerBar * 8); // Loop over 8 bars

    setTimeout(scheduleNextChunk, chunkSizeSeconds * 1000);
}


function generateMusicChunk() {
    const frameCount = Math.floor(chunkSizeSeconds * sampleRate);
    const audioChunk = new Float32Array(frameCount).fill(0);

    for (let i = 0; i < 4; i++) { // Generate 4 steps per chunk
        const step = currentStep + i;
        const stepTime = i * sixteenthNoteTime;
        const frameOffset = Math.floor(stepTime * sampleRate);

        // --- Drums ---
        if (drumsEnabled && Object.keys(samples).length > 0) {
            // Kick on the 1st beat of every bar
            if (step % stepsPerBar === 0) {
                 mixSample(audioChunk, samples['kick'], frameOffset);
            }
            // Snare on the 3rd beat
            if (step % stepsPerBar === 8) {
                mixSample(audioChunk, samples['snare'], frameOffset);
            }
             // Closed hat on every 8th note
            if (step % 2 === 0) {
                 mixSample(audioChunk, samples['hat'], frameOffset);
            }
             // Ride on every beat
            if (step % 4 === 0) {
                mixSample(audioChunk, samples['ride'], frameOffset);
            }
            // Crash every 4 bars
            if (step % (stepsPerBar * 4) === 0) {
                mixSample(audioChunk, samples['crash'], frameOffset, 0.7);
            }
        }
        
        // --- Instruments ---
        if (step % 4 === 0) { // Play on quarter notes
             if (instruments.solo !== 'none' && Math.random() < 0.25) {
                const note = getNextNote('solo', AM_PENTATONIC_SCALE);
                mixSynth(audioChunk, instruments.solo, note, sixteenthNoteTime * 4, frameOffset);
            }
        }
        if (step % 8 === 0) { // Play on half notes
            if (instruments.accompaniment !== 'none' && Math.random() < 0.5) {
                const note = getNextNote('accompaniment', C_MAJOR_SCALE);
                 mixSynth(audioChunk, instruments.accompaniment, note, sixteenthNoteTime * 8, frameOffset);
            }
        }
         if (step % 16 === 0) { // Play on whole notes
            if (instruments.bass !== 'none') {
                const note = getNextNote('bass', BASS_NOTES);
                mixSynth(audioChunk, instruments.bass, note, sixteenthNoteTime * 16, frameOffset);
            }
        }
    }

    return audioChunk;
}

function getNextNote(part, scale) {
    lastNoteIndices[part] = (lastNoteIndices[part] + Math.floor(Math.random() * 3) - 1 + scale.length) % scale.length;
    return noteToFrequency(scale[lastNoteIndices[part]]);
}


// --- Synthesis & Mixing ---

function mixSample(buffer, sample, offset, gain = 1.0) {
    if (!sample) return;
    for (let i = 0; i < sample.length && offset + i < buffer.length; i++) {
        buffer[offset + i] += sample[i] * gain;
    }
}

function mixSynth(buffer, type, freq, duration, offset, gain = 0.4) {
    if (!freq) return;
    const synthWave = generateSynthWave(type, freq, duration);
    for (let i = 0; i < synthWave.length && offset + i < buffer.length; i++) {
        buffer[offset + i] += synthWave[i] * gain;
    }
}

function generateSynthWave(type, freq, duration) {
    const frameCount = Math.floor(duration * sampleRate);
    const wave = new Float32Array(frameCount);
    
    // Basic ADSR envelope
    const attackTime = 0.05 * duration;
    const decayTime = 0.2 * duration;
    const sustainLevel = 0.6;
    const releaseTime = 0.1 * duration;

    for (let i = 0; i < frameCount; i++) {
        const time = i / sampleRate;
        let amp = 0;
        
        // Envelope calculation
        if (time < attackTime) {
            amp = time / attackTime;
        } else if (time < attackTime + decayTime) {
            amp = 1.0 - (1.0 - sustainLevel) * (time - attackTime) / decayTime;
        } else if (time < duration - releaseTime) {
            amp = sustainLevel;
        } else {
            amp = sustainLevel * (1.0 - (time - (duration - releaseTime)) / releaseTime);
        }
        
        amp = Math.max(0, amp);

        switch(type) {
            case 'synthesizer': // Sawtooth
                wave[i] = (2 * (time * freq - Math.floor(0.5 + time * freq))) * amp;
                break;
            case 'piano': // Sine with harmonics
                 wave[i] = (Math.sin(2 * Math.PI * freq * time) + 
                           0.5 * Math.sin(2 * Math.PI * freq * 2 * time) +
                           0.2 * Math.sin(2 * Math.PI * freq * 3 * time)) / 1.7 * amp;
                break;
            case 'organ': // Combination of sines
                wave[i] = (Math.sin(2 * Math.PI * freq * time) + 
                           0.5 * Math.sin(2 * Math.PI * freq * 2 * time) + 
                           0.25 * Math.sin(2 * Math.PI * freq * 4 * time)) / 1.75 * amp;
                break;
            case 'bass guitar': // Square-ish wave
                 wave[i] = Math.sign(Math.sin(2 * Math.PI * freq * time) + 0.5 * Math.sin(2 * Math.PI * freq * 2 * time)) * amp;
                break;
        }
    }
    return wave;
}


// --- Note to Frequency ---
const A4 = 440;
const noteNames = { 'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4, 'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2 };

function noteToFrequency(note) {
  const name = note.slice(0, -1).replace('#', '#');
  const octave = parseInt(note.slice(-1), 10);
  const halfSteps = noteNames[name];
  
  if (halfSteps === undefined) return 0;

  return A4 * Math.pow(2, (halfSteps + (octave - 4) * 12) / 12);
}


"use strict";

// --- Configuration ---
const CHUNK_DURATION = 1.0; // seconds
const PREDICTION_HORIZON = 4.0; // seconds
const NOTE_VELOCITY = 0.6;
const BPM = 120;
const BEATS_PER_BAR = 4;
const BEAT_DURATION = 60 / BPM; // seconds
const BAR_DURATION = BEATS_PER_BAR * BEAT_DURATION;

// --- State ---
let isRunning = false;
let nextGenerationTime = 0;
let sampleRate = 44100;
let instruments = {
    solo: 'none',
    accompaniment: 'none',
    bass: 'none'
};
let drumsEnabled = true;
let samples = {}; // To hold the decoded audio data

// --- Music Generation Logic ---

// Placeholder for a more complex chord progression generator
function getChordProgression() {
    return ['Cmaj7', 'Fmaj7', 'G7', 'Am7'];
}

// Simple mapping of chord names to notes
function getChordNotes(chord) {
    const chordMap = {
        'Cmaj7': ['C4', 'E4', 'G4', 'B4'],
        'Fmaj7': ['F4', 'A4', 'C5', 'E5'],
        'G7': ['G4', 'B4', 'D5', 'F5'],
        'Am7': ['A4', 'C5', 'E5', 'G5']
    };
    return chordMap[chord] || [];
}

function noteToFrequency(note) {
    const noteMap = { 'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
                      'C5': 523.25, 'E5': 659.25, 'G5': 783.99, 'F5': 698.46, 'D5': 587.33, 'A5': 880.00,
                      'C3': 130.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94
                    };
    return noteMap[note] || 0;
}

function createOscillator(type, frequency, startTime, duration, contextTime) {
    const osc = new OscillatorNode(globalThis, {
      type: type,
      frequency: frequency,
    });
    const gainNode = new GainNode(globalThis);
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(NOTE_VELOCITY, startTime + 0.02);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gainNode);
    osc.start(startTime);
    osc.stop(startTime + duration);
    return gainNode;
}


// A very basic drum pattern generator
function generateDrums(startTime, duration) {
    const drumNotes = [];
    const sixteenthNoteDuration = BEAT_DURATION / 4;

    for (let time = 0; time < duration; time += sixteenthNoteDuration) {
        const currentBeat = (time / BEAT_DURATION);
        const barRelativeBeat = currentBeat % BEATS_PER_BAR;
        const currentSixteenth = Math.floor(time / sixteenthNoteDuration);

        // Kick on 1 and 3
        if (barRelativeBeat === 0 || barRelativeBeat === 2) {
            drumNotes.push({ sampleKey: 'kick_drum6', time: startTime + time, velocity: 1.0 });
        }
        // Snare on 2 and 4
        if (barRelativeBeat === 1 || barRelativeBeat === 3) {
            drumNotes.push({ sampleKey: 'snare', time: startTime + time, velocity: 0.8 });
        }
        // Hi-hat on every 8th note
        if (currentSixteenth % 2 === 0) {
            drumNotes.push({ sampleKey: 'closed_hi_hat_accented', time: startTime + time, velocity: 0.6 });
        }
        
        // Crash on the first beat of every 4 bars
        if (currentSixteenth === 0 && Math.floor(startTime / BAR_DURATION) % 4 === 0) {
             drumNotes.push({ sampleKey: 'crash1', time: startTime, velocity: 0.7 });
        }
        
        // Ride pattern on every 8th note, can alternate with hi-hat or layer
        if (currentSixteenth % 2 === 0) { // Simple ride on 8ths
            drumNotes.push({ sampleKey: 'cymbal1', time: startTime + time, velocity: 0.5 });
        }
    }
    return drumNotes;
}


function renderAudioChunk(startTime, duration) {
    const chunkSampleCount = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(chunkSampleCount).fill(0);
    
    // --- Generate Drums ---
    if (drumsEnabled && Object.keys(samples).length > 0) {
        const drumNotes = generateDrums(startTime, duration);
        for (const note of drumNotes) {
            const sampleBuffer = samples[note.sampleKey];
            if (!sampleBuffer) continue;

            const startSample = Math.floor((note.time - startTime) * sampleRate);
            if (startSample >= chunkSampleCount) continue;

            for (let i = 0; i < sampleBuffer.length; i++) {
                if (startSample + i < chunkSampleCount) {
                    buffer[startSample + i] += sampleBuffer[i] * note.velocity;
                }
            }
        }
    }
    
    // --- Generate Instruments (Simplified) ---
    // This part is a placeholder. A real implementation would involve oscillators or sample playback
    // similar to the drum logic, but based on the selected instruments.
    const progression = getChordProgression();
    const barIndex = Math.floor(startTime / BAR_DURATION) % progression.length;
    const currentChord = progression[barIndex];
    const notes = getChordNotes(currentChord);
    
    // This is a highly simplified representation of playing a chord.
    // A real implementation would need to handle individual note on/off, envelopes, etc.
    if (instruments.accompaniment !== 'none' && notes.length > 0) {
         for (let i = 0; i < chunkSampleCount; i++) {
             // Placeholder for actual synthesis
         }
    }

    return buffer;
}


// --- Communication & Control ---

function generateAndPostChunk() {
    if (!isRunning) return;

    const currentTime = nextGenerationTime;
    const chunk = renderAudioChunk(currentTime, CHUNK_DURATION);

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunk,
            duration: CHUNK_DURATION
        }
    }, [chunk.buffer]);

    nextGenerationTime += CHUNK_DURATION;

    // Schedule the next chunk generation
    const timeUntilNextChunk = (nextGenerationTime - currentTime - CHUNK_DURATION) * 1000;
    setTimeout(generateAndPostChunk, timeUntilNextChunk);
}

self.onmessage = function(event) {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            samples = data;
            // Let the main thread know we're ready
            self.postMessage({ type: 'samples_loaded' });
            break;
            
        case 'start':
            if (isRunning) return;
            isRunning = true;
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            nextGenerationTime = 0; // Reset time
            self.postMessage({ type: 'generation_started' });
            generateAndPostChunk();
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

    
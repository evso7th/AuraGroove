
// Simple-to-use synth library
import {Note, Scale} from 'tonal';

// Perlin noise for smooth random fluctuations
import { perlin2 } from './perlin';

// ------------ CONFIGURATION ------------
const SAMPLE_RATE = 44100; // Default, will be updated by main thread
const CHUNK_SIZE = 128; // Number of samples per chunk
const TEMPO = 70;
const SUBDIVISIONS = 16; // 16th notes
const SECONDS_PER_MINUTE = 60;
const BEATS_PER_MEASURE = 4;

const NOTE_DURATION_IN_SECONDS = 0.5;
const GAIN_ADJUSTMENT = 0.05; // Master gain adjustment for synths

// ------------ STATE ------------
let sampleRate = SAMPLE_RATE;
let instruments = {
    solo: 'none',
    accompaniment: 'none',
    bass: 'none'
};
let drumsEnabled = true;
let samples = {};

let totalSamples = 0;
let isPlaying = false;

// Pre-calculate timing values
const samplesPerBeat = (SAMPLE_RATE * SECONDS_PER_MINUTE) / TEMPO;
const samplesPerMeasure = samplesPerBeat * BEATS_PER_MEASURE;
const samplesPerSubdivision = samplesPerBeat / (SUBDIVISIONS / BEATS_PER_MEASURE);


// ------------ SYNTHS ------------

// Oscillator functions (sine, square, sawtooth)
const oscillators = {
    sine: (t, freq) => Math.sin(2 * Math.PI * freq * t),
    square: (t, freq) => Math.sign(Math.sin(2 * Math.PI * freq * t)),
    sawtooth: (t, freq) => 2 * (t * freq - Math.floor(t * freq + 0.5)),
    triangle: (t, freq) => 2 * Math.abs(2 * (t * freq - Math.floor(t * freq + 0.5))) - 1
};

// ADSR Envelope
function adsr(t, attack, decay, sustain, release, duration) {
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1 - (1 - sustain) * (t - attack) / decay;
    if (t < duration) return sustain;
    // Release is handled by the note-off logic
    return 0;
}

// A simple synthesizer
function synthesizer(t, freq, type = 'sine', duration = 0.5, noteOffTime = 0.5) {
    if (t > noteOffTime) {
        const releaseTime = t - noteOffTime;
        const releaseDuration = duration - noteOffTime;
        const releaseValue = adsr(noteOffTime, 0.01, 0.1, 0.5, 0.3, duration); // Get value at release start
        return releaseValue * (1 - releaseTime / releaseDuration);
    }
    return oscillators[type](t, freq) * adsr(t, 0.01, 0.1, 0.5, 0.3, duration);
}

// Instrument definitions using the synthesizer
const instrumentDefs = {
    'synthesizer': { type: 'sawtooth', gain: 0.2 },
    'piano': { type: 'triangle', gain: 0.3 },
    'organ': { type: 'square', gain: 0.2 },
    'bass guitar': { type: 'sine', gain: 0.6 }
};


// ------------ MUSIC GENERATION ------------

// Holds the currently active notes
const activeNotes = {
    solo: [],
    accompaniment: [],
    bass: []
};


// Generate a new musical phrase
function generatePhrase(part, scale) {
    const notes = [];
    const baseOctave = (part === 'bass') ? 2 : 4;
    const rootNote = scale.notes[0];

    // Simple melody generator
    let lastNoteIndex = 0;
    for (let i = 0; i < BEATS_PER_MEASURE * 2; i++) {
        // Use Perlin noise for smoother transitions
        const noise = perlin2(i * 0.5, part === 'solo' ? 10 : 20);
        let noteIndex = Math.floor(Math.abs(noise) * scale.notes.length);

        // Ensure notes don't jump too far
        noteIndex = Math.max(0, Math.min(scale.notes.length - 1, lastNoteIndex + Math.round((noteIndex - lastNoteIndex) * 0.5)));
        lastNoteIndex = noteIndex;
        
        const noteName = scale.notes[noteIndex];

        notes.push({
            note: noteName,
            freq: Note.freq(noteName + baseOctave),
            time: totalSamples + i * samplesPerBeat,
            duration: samplesPerBeat,
            source: part
        });
    }
    return notes;
}


// Check for and schedule new notes
function scheduleNotes() {
    const scale = Scale.get('C major');
    ['solo', 'accompaniment', 'bass'].forEach(part => {
        if (instruments[part] !== 'none' && activeNotes[part].length === 0) {
            activeNotes[part] = generatePhrase(part, scale);
        }
    });
}


// Main audio generation function
function generateAudioChunk() {
    if (!isPlaying) return;

    const chunk = new Float32Array(CHUNK_SIZE).fill(0);
    const samplesPerSecond = sampleRate;

    // --- Instruments ---
    ['solo', 'accompaniment', 'bass'].forEach(part => {
        if (instruments[part] === 'none') return;
        
        const instrumentDef = instrumentDefs[instruments[part]];
        if (!instrumentDef) return;

        const notesToPlay = activeNotes[part].filter(note =>
            totalSamples < note.time + note.duration && totalSamples + CHUNK_SIZE > note.time
        );
        
        for (let i = 0; i < CHUNK_SIZE; i++) {
            const currentTimeInSong = (totalSamples + i) / samplesPerSecond;
            let sampleValue = 0;

            notesToPlay.forEach(note => {
                const noteStartTime = note.time / samplesPerSecond;
                const timeInNote = currentTimeInSong - noteStartTime;

                if (timeInNote >= 0 && timeInNote < (note.duration / samplesPerSecond)) {
                    sampleValue += synthesizer(timeInNote, note.freq, instrumentDef.type, note.duration / samplesPerSecond);
                }
            });
            chunk[i] += sampleValue * instrumentDef.gain;
        }

        activeNotes[part] = activeNotes[part].filter(note => totalSamples < note.time + note.duration);
    });
    
    // --- Drums ---
    if (drumsEnabled) {
         const drumGain = {
            kick: 0.5,
            snare: 0.4,
            hat: 0.1,
            crash: 0.6,
            ride: 0.4,
            tom1: 0.5,
            tom2: 0.5,
            tom3: 0.5,
        };

        for (let i = 0; i < CHUNK_SIZE; i++) {
            const currentSample = totalSamples + i;
            const currentMeasure = Math.floor(currentSample / samplesPerMeasure);
            const currentBeat = Math.floor(currentSample / samplesPerBeat) % BEATS_PER_MEASURE;
            const isFirstBeat = (currentSample % samplesPerMeasure) < 100; // a small tolerance
            
            // Kick on 1 and 3
            if (currentSample % samplesPerBeat < 100 && (currentBeat === 0 || currentBeat === 2)) {
                 chunk[i] += samples.kick[0] * drumGain.kick;
            }
             // Snare on 2 and 4
            if (currentSample % samplesPerBeat < 100 && (currentBeat === 1 || currentBeat === 3)) {
                 chunk[i] += samples.snare[0] * drumGain.snare;
            }

            // Hi-hat on every 8th note
             if (currentSample % (samplesPerBeat / 2) < 100) {
                 chunk[i] += samples.hat[0] * drumGain.hat;
            }

            // Crash on the first beat of every 4th measure
            if (isFirstBeat && currentMeasure % 4 === 0) {
                 chunk[i] += samples.crash[0] * drumGain.crash;
            }

            // Simple tom fill on the 4th beat of every 8th measure
            if (currentMeasure % 8 === 7 && currentBeat === 3) {
                 const sixteenth = Math.floor((currentSample % samplesPerBeat) / (samplesPerBeat / 4));
                 if (sixteenth === 0) chunk[i] += samples.tom1[0] * drumGain.tom1;
                 if (sixteenth === 1) chunk[i] += samples.tom2[0] * drumGain.tom2;
                 if (sixteenth === 2) chunk[i] += samples.tom3[0] * drumGain.tom3;
            }

             // Ride cymbal on quarter notes on some measures instead of hat
            if (currentMeasure % 4 > 1) {
                 if (currentSample % samplesPerBeat < 100) {
                    chunk[i] += samples.ride[0] * drumGain.ride;
                 }
            }
        }
    }


    // Master gain and clipping protection
    for (let i = 0; i < CHUNK_SIZE; i++) {
        chunk[i] *= GAIN_ADJUSTMENT;
        chunk[i] = Math.max(-1, Math.min(1, chunk[i]));
    }

    totalSamples += CHUNK_SIZE;
    
    // Clean up notes that have finished
    for (const part in activeNotes) {
        activeNotes[part] = activeNotes[part].filter(note => (note.time + note.duration) > totalSamples);
    }


    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunk,
            duration: CHUNK_SIZE / sampleRate,
        },
    });
}


function start() {
    if (isPlaying) return;
    isPlaying = true;
    totalSamples = 0;

    function loop() {
        if (!isPlaying) return;
        scheduleNotes();
        generateAudioChunk();
        setTimeout(loop, (CHUNK_SIZE / sampleRate) * 1000);
    }
    loop();
}

function stop() {
    isPlaying = false;
    for (const part in activeNotes) {
        activeNotes[part] = [];
    }
}


// ------------ MAIN THREAD COMMUNICATION ------------

self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            samples = data;
            // Now that samples are loaded in the worker, signal back to the main thread
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            sampleRate = data.sampleRate || SAMPLE_RATE;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            start();
            break;
        case 'stop':
            stop();
            break;
        case 'set_instruments':
            instruments = data;
            // Clear notes for parts that are now 'none'
            for (const part in instruments) {
                if (instruments[part] === 'none') {
                    activeNotes[part] = [];
                }
            }
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
    }
};

    
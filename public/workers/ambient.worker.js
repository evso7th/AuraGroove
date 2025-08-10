// public/workers/ambient.worker.js

let instruments = {};
let drumsEnabled = true;
let sampleRate = 44100;
let samples = {};
let isRunning = false;
let scheduleTimeoutId = null;

const noteFrequencies = {
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77
};

const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10]
};
const scaleNotes = scales.minor.map(i => Object.keys(noteFrequencies)[i + 2]); // C minor starting from C3

// --- Oscillators & Synthesis ---
function sineWave(freq, t) {
    return Math.sin(2 * Math.PI * freq * t);
}

function squareWave(freq, t) {
    return Math.sign(Math.sin(2 * Math.PI * freq * t));
}

function organWave(freq, t) {
    return (
        0.5 * Math.sin(2 * Math.PI * freq * t) +
        0.3 * Math.sin(2 * Math.PI * freq * 2 * t) +
        0.1 * Math.sin(2 * Math.PI * freq * 3 * t) +
        0.1 * Math.sin(2 * Math.PI * freq * 4 * t)
    );
}

function pianoWave(freq, t, duration) {
    const fundamental = Math.sin(2 * Math.PI * freq * t) * Math.exp(-3 * t);
    const harmonic1 = 0.5 * Math.sin(2 * Math.PI * freq * 2 * t) * Math.exp(-5 * t);
    const harmonic2 = 0.25 * Math.sin(2 * Math.PI * freq * 3 * t) * Math.exp(-7 * t);
    return (fundamental + harmonic1 + harmonic2);
}

// --- Envelope ---
function adsr(t, duration, attack, decay, sustainLevel, release) {
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1 - (1 - sustainLevel) * (t - attack) / decay;
    if (t < duration - release) return sustainLevel;
    if (t < duration) return sustainLevel * (duration - t) / release;
    return 0;
}

// --- Note Generation ---
function createNote(freq, duration, type) {
    const noteLength = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(noteLength);

    for (let i = 0; i < noteLength; i++) {
        const t = i / sampleRate;
        let sample = 0;
        switch(type) {
            case 'synthesizer': sample = squareWave(freq, t); break;
            case 'organ': sample = organWave(freq, t); break;
            case 'piano': sample = pianoWave(freq, t, duration); break;
            case 'bass guitar': sample = sineWave(freq, t); break;
            default: sample = sineWave(freq, t);
        }
        const envelope = adsr(t, duration, 0.01, 0.1, 0.7, 0.2);
        buffer[i] = sample * envelope * 0.3;
    }
    return buffer;
}


// --- Drum Generation ---
function generateDrums(pattern, sixteenthNoteTime) {
    const drumPart = {};
    for(let i=0; i<pattern.length; i++) {
        if(pattern[i] !== '-') {
            const time = i * sixteenthNoteTime;
            if(!drumPart[pattern[i]]) drumPart[pattern[i]] = [];
            drumPart[pattern[i]].push(time);
        }
    }
    return drumPart;
}


function renderAudioChunk(duration, soloPart, accompanimentPart, bassPart, drumPart) {
    const chunkLength = Math.floor(sampleRate * duration);
    const chunk = new Float32Array(chunkLength).fill(0);

    const addNotesToChunk = (part, type) => {
        if (!part || instruments[type] === 'none') return;
        part.forEach(note => {
            const noteBuffer = createNote(noteFrequencies[note.pitch], note.duration, instruments[type]);
            const startSample = Math.floor(note.time * sampleRate);
            for (let i = 0; i < noteBuffer.length && startSample + i < chunkLength; i++) {
                chunk[startSample + i] += noteBuffer[i];
            }
        });
    };
    
    addNotesToChunk(soloPart, 'solo');
    addNotesToChunk(accompanimentPart, 'accompaniment');
    addNotesToChunk(bassPart, 'bass');
    
    if (drumsEnabled && drumPart) {
       const addDrumsToChunk = (drumTimes, sampleKey) => {
            if (drumTimes && samples[sampleKey]) {
                drumTimes.forEach(time => {
                    const startSample = Math.floor(time * sampleRate);
                    for (let i = 0; i < samples[sampleKey].length && startSample + i < chunkLength; i++) {
                        chunk[startSample + i] += samples[sampleKey][i] * 0.5; // Drum volume
                    }
                });
            }
        };

        addDrumsToChunk(drumPart.k, 'kick_drum6');
        addDrumsToChunk(drumPart.s, 'snare');
        addDrumsToChunk(drumPart.h, 'closed_hi_hat_accented');
        addDrumsToChunk(drumPart.c, 'crash1');
        addDrumsToChunk(drumPart.r, 'cymbal1');
    }
    
    return chunk;
}


let measureCount = 0;
function scheduleNextChunk() {
    if (!isRunning) return;

    const sixteenthNoteTime = 0.25; // Slower tempo: 60 BPM (15s per 16 notes) -> 0.25s per 16th note
    const chunkDuration = 16 * sixteenthNoteTime; // 4 seconds per chunk (1 measure of 4/4)

    // --- Music Logic ---
    const soloPart = [];
    if (Math.random() < 0.7) { // Sparser solo
        const noteIndex = Math.floor(Math.random() * scaleNotes.length);
        const startTime = Math.floor(Math.random() * 12) * sixteenthNoteTime; // Random start time
        soloPart.push({ pitch: scaleNotes[noteIndex], time: startTime, duration: sixteenthNoteTime * (Math.random() > 0.8 ? 8 : 4) });
    }

    const accompanimentPart = [];
    const rootNoteIndex = Math.floor(Math.random() * (scaleNotes.length - 2));
    const chord = [scaleNotes[rootNoteIndex], scaleNotes[rootNoteIndex+2], scaleNotes[rootNoteIndex+4]];
    accompanimentPart.push({ pitch: chord[0], time: 0, duration: chunkDuration });
    accompanimentPart.push({ pitch: chord[1], time: 0, duration: chunkDuration });
    accompanimentPart.push({ pitch: chord[2], time: 0, duration: chunkDuration });
    
    const bassPart = [{ pitch: chord[0].replace('4','3'), time: 0, duration: chunkDuration }];
    
    // --- Drum Logic ---
    let drumPattern;
    if (measureCount % 8 === 0) {
        drumPattern = 'c-k-s-k-h-k-s-kh--s-k-h-'; // Intro fill with crash
    } else if (measureCount % 4 === 0) {
        drumPattern = 'k-h-s-h-k-h-s-hr-s-k-h-'; // Fill with ride
    } else {
        drumPattern = 'k-h-s-h-k-h-s-h-k-h-s-h-k-h-s-h'; // Standard beat
    }
    const drumPart = generateDrums(drumPattern, sixteenthNoteTime);

    // --- Render and Post ---
    const audioChunk = renderAudioChunk(chunkDuration, soloPart, accompanimentPart, bassPart, drumPart);
    self.postMessage({ type: 'chunk', data: { chunk: audioChunk, duration: chunkDuration } });

    measureCount++;

    // Schedule the next one slightly before the current one ends
    scheduleTimeoutId = setTimeout(scheduleNextChunk, chunkDuration * 1000 * 0.9);
}


self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            samples = data;
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            if (isRunning) return;
            isRunning = true;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            sampleRate = data.sampleRate;
            measureCount = 0;
            scheduleNextChunk();
            break;
        case 'stop':
            isRunning = false;
            if (scheduleTimeoutId) {
                clearTimeout(scheduleTimeoutId);
                scheduleTimeoutId = null;
            }
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
    }
};

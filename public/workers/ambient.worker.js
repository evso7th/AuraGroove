
let timerId = null;
let instruments = {};
let sampleRate = 44100;
let drumsEnabled = true;
let isGenerating = false;
let timeSignature = 4;
let measures = 0;

const CHUNK_DURATION = 0.5; // 0.5 seconds per chunk

const SAMPLES = {
    kick: null,
    snare: null,
    hat: null,
};

const FREQUENCIES = {
    'C2': 65.41, 'D2': 73.42, 'E2': 82.41, 'F2': 87.31, 'G2': 98.00, 'A2': 110.00, 'B2': 123.47,
    'C3': 130.81, 'D3': 146.83, 'E3': 164.81, 'F3': 174.61, 'G3': 196.00, 'A3': 220.00, 'B3': 246.94,
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77
};

function noteToFreq(note) {
    return FREQUENCIES[note] || 0;
}

const scales = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
};

function getNotesInScale(root, scaleName) {
    const rootIndex = Object.keys(FREQUENCIES).indexOf(root);
    const scaleIntervals = scales[scaleName];
    const noteNames = Object.keys(FREQUENCIES);
    return scaleIntervals.map(interval => noteNames[rootIndex + interval]);
}

let currentRoot = 'C3';
let currentScale = 'minor';
let scaleNotes = getNotesInScale(currentRoot, currentScale);

function generatePart(partName, duration, startOffset) {
    const notes = [];
    if (instruments[partName] === 'none') return notes;

    const numNotes = Math.random() < 0.3 ? (Math.random() < 0.7 ? 1 : 2) : 0;
    for (let i = 0; i < numNotes; i++) {
        const noteName = scaleNotes[Math.floor(Math.random() * scaleNotes.length)];
        notes.push({
            freq: noteToFreq(noteName),
            time: startOffset + Math.random() * duration,
            duration: 0.2 + Math.random() * 0.3,
            velocity: 0.2 + Math.random() * 0.2,
            instrument: instruments[partName]
        });
    }
    return notes;
}

function generateDrums(duration, startOffset) {
    const notes = [];
    if (!drumsEnabled) return notes;

    const beats = duration * 2; // 8th notes
    for (let i = 0; i < beats; i++) {
        const time = startOffset + i * (duration / beats);
        const beatInMeasure = Math.floor((measures * 4) + (i / 2));

        // Basic Kick on 1 and 3
        if (beatInMeasure % 4 === 0 || beatInMeasure % 4 === 2) {
             if(Math.random() < 0.9) {
                notes.push({ instrument: 'kick', time: time, velocity: 0.8 + Math.random() * 0.2 });
             }
        }
        
        // Basic Snare on 2 and 4
        if (beatInMeasure % 4 === 1 || beatInMeasure % 4 === 3) {
            if(Math.random() < 0.8) {
                notes.push({ instrument: 'snare', time: time, velocity: 0.6 + Math.random() * 0.2 });
            }
        }
        
        // Hi-hats
        if(Math.random() < 0.7) {
            notes.push({ instrument: 'hat', time: time, velocity: 0.1 + Math.random() * 0.2 });
        }
    }

    return notes;
}


function applyADSEnvelope(value, time, note) {
    const attackTime = 0.01;
    const decayTime = 0.1;
    const sustainLevel = 0.7;
    const releaseTime = 0.2;

    const noteTime = time - note.time;
    let amplitude = 0;

    if (noteTime >= 0 && noteTime < note.duration) {
        if (noteTime < attackTime) {
            amplitude = (noteTime / attackTime);
        } else if (noteTime < attackTime + decayTime) {
            amplitude = 1.0 - (1.0 - sustainLevel) * ((noteTime - attackTime) / decayTime);
        } else {
            amplitude = sustainLevel;
        }
    } else if (noteTime >= note.duration && noteTime < note.duration + releaseTime) {
        amplitude = sustainLevel * (1.0 - (noteTime - note.duration) / releaseTime);
    }
    
    return value * amplitude * note.velocity;
}


function mixSample(buffer, sample, startTime, velocity) {
    const startSample = Math.floor(startTime * sampleRate);
    for (let i = 0; i < sample.length && startSample + i < buffer.length; i++) {
        buffer[startSample + i] += sample[i] * velocity;
    }
}


function generateAudioChunk() {
    const chunkSamples = Math.floor(CHUNK_DURATION * sampleRate);
    const chunkBuffer = new Float32Array(chunkSamples).fill(0);
    const startOffset = measures * CHUNK_DURATION;

    const soloPart = generatePart('solo', CHUNK_DURATION, startOffset);
    const accompanimentPart = generatePart('accompaniment', CHUNK_DURATION, startOffset);
    const bassPart = generatePart('bass', CHUNK_DURATION, startOffset);
    const drumPart = generateDrums(CHUNK_DURATION, startOffset);

    const allNotes = [...soloPart, ...accompanimentPart, ...bassPart];
    
    for (let i = 0; i < chunkSamples; i++) {
        const time = startOffset + i / sampleRate;
        let sampleValue = 0;

        for (const note of allNotes) {
             if (time >= note.time && time < note.time + note.duration) {
                let wave = 0;
                const t = (time - note.time) * note.freq * 2 * Math.PI;

                switch(note.instrument) {
                    case 'piano': // Bright, slightly complex
                         wave = Math.sin(t) * 0.5 + Math.sin(t * 2) * 0.25 + Math.sin(t * 3) * 0.15;
                         break;
                    case 'organ': // Richer, more harmonics
                         wave = (Math.sin(t) + Math.sin(t*2)*0.5 + Math.sin(t*4)*0.25) / 1.75;
                         break;
                    case 'bass guitar': // Deeper, fundamental
                         wave = Math.sin(t);
                         break;
                    case 'synthesizer':
                    default: // Default to a sawtooth for synth
                        wave = ((t / (2*Math.PI)) % 1) * 2 - 1; 
                        break;
                }
                sampleValue += applyADSEnvelope(wave, time, note);
            }
        }
        chunkBuffer[i] = sampleValue * 0.3; // Global gain
    }

    // Mix drums using samples
    for (const note of drumPart) {
        const sample = SAMPLES[note.instrument];
        if (sample) {
            mixSample(chunkBuffer, sample, note.time - startOffset, note.velocity);
        }
    }


    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkBuffer,
            duration: CHUNK_DURATION
        }
    }, [chunkBuffer.buffer]);

    measures++;
}


self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'load_samples':
            for(const key in data) {
                if(SAMPLES.hasOwnProperty(key)) {
                    SAMPLES[key] = data[key];
                }
            }
            break;
        case 'start':
            if (isGenerating) return;
            isGenerating = true;
            instruments = data.instruments;
            sampleRate = data.sampleRate;
            drumsEnabled = data.drumsEnabled;
            measures = 0;

            generateAudioChunk(); // Generate the first chunk immediately
            timerId = setInterval(generateAudioChunk, CHUNK_DURATION * 1000 * 0.9); // Schedule subsequent chunks slightly faster
            self.postMessage({ type: 'generation_started' });
            break;
        case 'stop':
            if (!isGenerating) return;
            isGenerating = false;
            if (timerId) {
                clearInterval(timerId);
                timerId = null;
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

    
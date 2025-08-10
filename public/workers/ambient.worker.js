// public/workers/ambient.worker.js

// --- State ---
let isRunning = false;
let sampleRate = 44100;
let instruments = {
    solo: 'none',
    accompaniment: 'none',
    bass: 'none'
};
let drumsEnabled = true;
let decodedSamples = null; // Will hold the decoded audio data for drums

// --- DSP & Synthesis ---

// Basic sine wave oscillator
function sine(freq, time) {
    return Math.sin(freq * 2 * Math.PI * time);
}

// ADSR Envelope
function applyAdsr(sample, adsr) {
    const { attack, decay, sustain, release } = adsr;
    const totalLength = sample.length;
    const attackEnd = Math.floor(attack * totalLength);
    const decayEnd = attackEnd + Math.floor(decay * totalLength);
    const sustainLevel = sustain;

    for (let i = 0; i < totalLength; i++) {
        const time = i / totalLength;
        let amp = 0;
        if (i < attackEnd) {
            amp = time / attack;
        } else if (i < decayEnd) {
            amp = 1 - (1 - sustainLevel) * ((i - attackEnd) / (decayEnd - attackEnd));
        } else {
            amp = sustainLevel;
        }
        // A simple linear release isn't easy here without knowing note-off time.
        // For simplicity, we'll let the synth part have a natural decay.
        sample[i] *= amp;
    }
    return sample;
}

function generateSynthesizerPart(notes, totalSamples, adsr) {
    const buffer = new Float32Array(totalSamples).fill(0);
    notes.forEach(note => {
        const noteDurationSamples = Math.floor(note.duration * sampleRate);
        const noteStartSample = Math.floor(note.time * totalSamples);
        const freq = 440 * Math.pow(2, (note.pitch - 69) / 12);

        for (let i = 0; i < noteDurationSamples && (noteStartSample + i) < totalSamples; i++) {
            const t = i / sampleRate;
            buffer[noteStartSample + i] += sine(freq, t) * note.velocity;
        }
        
        // Apply envelope to the note segment
        const noteSegment = buffer.subarray(noteStartSample, noteStartSample + noteDurationSamples);
        applyAdsr(noteSegment, adsr);

    });
    return buffer;
}


// --- Drum Machine ---

function generateDrumHits(duration) {
    // Simple 4/4 rock beat
    const hits = [];
    const sixteenth = duration / 16;
    for (let i = 0; i < 16; i++) {
        const time = i * sixteenth;
        // Kick on 1 and 3
        if (i === 0 || i === 8) {
            hits.push({ instrument: 'kick', time });
        }
        // Snare on 2 and 4
        if (i === 4 || i === 12) {
            hits.push({ instrument: 'snare', time });
        }
        // Hats on all 16ths, with accents
        hits.push({ instrument: 'hat', time });
    }
    return hits;
}


function generateDrumPart(drumHits, totalSamples) {
    const buffer = new Float32Array(totalSamples).fill(0);
    if (!decodedSamples) return buffer;

    drumHits.forEach(hit => {
        let sample = decodedSamples[hit.instrument];
        if (!sample) return;

        const startSample = Math.floor(hit.time * totalSamples);

        // Check if the sample fits
        if (startSample + sample.length > totalSamples) {
            // If it doesn't fit, try to replace it with a shorter sample (hat)
            const shorterSample = decodedSamples['hat'];
            if (shorterSample && (startSample + shorterSample.length <= totalSamples)) {
                sample = shorterSample; // Replace with hat
            } else {
                // If even the shorter sample doesn't fit, skip this hit
                return; 
            }
        }
        
        // Mix the sample into the buffer
        // Note: Simple addition for mixing. For better quality, one might use averaging or a limiter.
        for (let i = 0; i < sample.length; i++) {
            if (startSample + i < buffer.length) {
                buffer[startSample + i] += sample[i];
            }
        }
    });

    return buffer;
}


// --- Main Worker Logic ---

self.onmessage = function(event) {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            decodedSamples = data;
            // Confirm samples are loaded and worker is ready
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            if (isRunning) return;
            isRunning = true;
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            startGenerator();
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

function startGenerator() {
    if (!isRunning) return;
    // This is a simplified "recursive" call using setTimeout to avoid blocking.
    runGenerator();
}

function runGenerator() {
    if (!isRunning) return;

    const duration = 2; // Generate 2 seconds of audio at a time
    const totalSamples = Math.floor(duration * sampleRate);

    // --- Generate Parts ---
    let soloPart, accompanimentPart, bassPart, drumPart;

    if (instruments.solo !== 'none') {
        const soloNotes = [{ pitch: 76, time: 0, duration: 0.5, velocity: 0.8 }, { pitch: 79, time: 1, duration: 0.5, velocity: 0.8 }];
        soloPart = generateSynthesizerPart(soloNotes, totalSamples, { attack: 0.01, decay: 0.3, sustain: 0.4, release: 0.2 });
    }

    if (instruments.accompaniment !== 'none') {
        const accompNotes = [{ pitch: 60, time: 0, duration: 1, velocity: 0.5 }, { pitch: 64, time: 1, duration: 1, velocity: 0.5 }];
        accompanimentPart = generateSynthesizerPart(accompNotes, totalSamples, { attack: 0.1, decay: 0.5, sustain: 0.3, release: 0.2 });
    }

    if (instruments.bass !== 'none') {
        const bassNotes = [{ pitch: 36, time: 0, duration: 0.5, velocity: 0.9 }, { pitch: 43, time: 1, duration: 0.5, velocity: 0.9 }];
        bassPart = generateSynthesizerPart(bassNotes, totalSamples, { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.1 });
    }
    
    if (drumsEnabled) {
        const drumHits = generateDrumHits(duration);
        drumPart = generateDrumPart(drumHits, totalSamples);
    }

    // --- Mix Parts ---
    const chunk = new Float32Array(totalSamples).fill(0);
    const activeParts = [soloPart, accompanimentPart, bassPart, drumPart].filter(p => p);
    
    for (let i = 0; i < totalSamples; i++) {
        let sampleSum = 0;
        activeParts.forEach(part => {
             if (part && i < part.length) {
                sampleSum += part[i];
            }
        });
        // Simple limiter to prevent clipping
        chunk[i] = Math.max(-1, Math.min(1, sampleSum / (activeParts.length || 1)));
    }
    
    // --- Post message and schedule next run ---
    if (isRunning) {
         self.postMessage({ type: 'chunk', data: { chunk, duration } }, [chunk.buffer]);
         setTimeout(runGenerator, duration * 900); // Schedule next chunk slightly before the current one ends
    }
}

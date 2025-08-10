
// A simple random number generator
function mulberry32(a) {
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// Global state
let isRunning = false;
let instruments = {};
let sampleRate = 44100;
let samples = {};
let lastSeed = 0;
let rand = mulberry32(lastSeed);

const CHUNK_DURATION = 2.0; // seconds

const scales = {
    aeolian: [0, 2, 3, 5, 7, 8, 10],
};

const bassPatterns = {
    minimal: [
        { time: 0, duration: 0.9, velocity: 1.0 },
        { time: 1.0, duration: 0.4, velocity: 0.8 },
    ]
};

const drumPatterns = {
    fourOnTheFloor: [
        { time: 0, instrument: 'kick', velocity: 0.7 }, // Бочка приглушена
        { time: 0.25, instrument: 'hat', velocity: 1.0 },
        { time: 0.375, instrument: 'hat', velocity: 0.15 }, // Ghost-нота
        { time: 0.5, instrument: 'snare', velocity: 0.9 },
        { time: 0.5, instrument: 'hat', velocity: 0.6 },
        { time: 0.75, instrument: 'hat', velocity: 1.0 },
        { time: 0.875, instrument: 'hat', velocity: 0.15 }, // Ghost-нота
    ],
    // ... other patterns can be added here
};


function generateNote(note, duration, velocity, sampleRate) {
    const attackTime = 0.01;
    const decayTime = 0.2;
    const releaseTime = 0.2;
    const sustainLevel = 0.7;

    const noteLength = Math.floor(duration * sampleRate);
    const attackLength = Math.floor(attackTime * sampleRate);
    const decayLength = Math.floor(decayTime * sampleRate);
    const releaseLength = Math.floor(releaseTime * sampleRate);
    const sustainLength = noteLength - attackLength - decayLength - releaseLength;

    if (sustainLength < 0) return new Float32Array(0);

    const buffer = new Float32Array(noteLength);
    const frequency = 440 * Math.pow(2, (note - 69) / 12);

    let amplitude = 0;
    for (let i = 0; i < noteLength; i++) {
        const time = i / sampleRate;
        const angle = 2 * Math.PI * frequency * time;

        // Envelope
        if (i < attackLength) {
            amplitude = velocity * (i / attackLength);
        } else if (i < attackLength + decayLength) {
            amplitude = velocity - (velocity - sustainLevel * velocity) * ((i - attackLength) / decayLength);
        } else if (i < attackLength + decayLength + sustainLength) {
            amplitude = sustainLevel * velocity;
        } else {
            amplitude = sustainLevel * velocity * (1 - (i - (attackLength + decayLength + sustainLength)) / releaseLength);
        }

        buffer[i] = Math.sin(angle) * amplitude * 0.5; // Sine wave oscillator
    }
    return buffer;
}


function generateDrumPart(duration, sampleRate, drumSettings) {
    if (!drumSettings.enabled) return null;

    const totalSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(totalSamples).fill(0);
    const pattern = drumPatterns[drumSettings.pattern];

    for (const hit of pattern) {
        const sample = samples[hit.instrument];
        if (!sample) continue;

        const startSample = Math.floor(hit.time * (duration * 44100 / (drumSettings.bpm / 60)));
        const velocity = hit.velocity || drumSettings.velocity || 0.8;

        // Check if sample fits
        if (startSample + sample.length > totalSamples) {
            const shorterSample = samples['hat']; // Fallback to a short sample
            if (shorterSample && startSample + shorterSample.length <= totalSamples) {
                 for (let i = 0; i < shorterSample.length; i++) {
                    buffer[startSample + i] += shorterSample[i] * velocity;
                }
            }
            continue; // Skip if even the short sample doesn't fit
        }
        
        // Add sample to buffer
        for (let i = 0; i < sample.length; i++) {
            buffer[startSample + i] += sample[i] * velocity;
        }
    }
    return buffer;
}


function generateInstrumentPart(duration, sampleRate, instrumentSettings) {
    if (instrumentSettings.instrument === 'none') return null;
    
    const totalSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(totalSamples).fill(0);
    const pattern = bassPatterns[instrumentSettings.pattern];
    
    const scale = scales[instrumentSettings.scale];
    const rootNote = instrumentSettings.rootNote;

    for (const noteInfo of pattern) {
        const noteIndex = Math.floor(rand() * scale.length);
        const note = rootNote + scale[noteIndex];
        const noteBuffer = generateNote(note, noteInfo.duration, noteInfo.velocity, sampleRate);

        const startSample = Math.floor(noteInfo.time * totalSamples);
        if (startSample + noteBuffer.length > totalSamples) continue;

        for (let i = 0; i < noteBuffer.length; i++) {
            buffer[startSample + i] += noteBuffer[i];
        }
    }
    return buffer;
}


function startGenerator(newInstruments, newSampleRate) {
    instruments = newInstruments;
    sampleRate = newSampleRate;
    isRunning = true;
    runGenerator();
}

function stopGenerator() {
    isRunning = false;
}

self.onmessage = (event) => {
    const { command, data } = event.data;

    if (command === 'load_samples') {
        samples = data;
        self.postMessage({ type: 'samples_loaded' });
    } else if (command === 'start') {
        startGenerator(data.instruments, data.sampleRate);
    } else if (command === 'stop') {
        stopGenerator();
    } else if (command === 'set_instruments') {
        instruments = data;
    } else if (command === 'toggle_drums') {
        if(instruments.drums) {
           instruments.drums.enabled = data.enabled;
        }
    }
};

// --- Main Generator Loop ---
let lastTickTime = 0;

function runGenerator() {
    if (!isRunning) return;
    
    const now = Date.now() / 1000;
    if (lastTickTime === 0) {
        lastTickTime = now;
    }

    const duration = CHUNK_DURATION;

    // --- Part Generation ---
    const soloPart = generateInstrumentPart(duration, sampleRate, {
        instrument: instruments.solo,
        pattern: 'minimal',
        scale: 'aeolian',
        rootNote: 60, // C4
    });

    const accompanimentPart = generateInstrumentPart(duration, sampleRate, {
        instrument: instruments.accompaniment,
        pattern: 'minimal',
        scale: 'aeolian',
        rootNote: 48, // C3
    });

    const bassPart = generateInstrumentPart(duration, sampleRate, {
        instrument: instruments.bass,
        pattern: 'minimal',
        scale: 'aeolian',
        rootNote: 36, // C2
    });

    const drumPart = generateDrumPart(duration, sampleRate, {
        enabled: instruments.drumsEnabled,
        pattern: 'fourOnTheFloor',
        bpm: 120,
        velocity: 0.8,
    });


    // --- Mixing ---
    const totalSamples = Math.floor(duration * sampleRate);
    const chunk = new Float32Array(totalSamples).fill(0);
    
    const parts = [soloPart, accompanimentPart, bassPart, drumPart];
    
    for (const part of parts) {
        if (part) { // Mix only existing parts
             for (let i = 0; i < totalSamples; i++) {
                if (i < part.length) {
                    chunk[i] += part[i];
                }
            }
        }
    }
    
    // --- Post Message ---
    if (isRunning) {
         self.postMessage({ type: 'chunk', data: { chunk, duration } }, [chunk.buffer]);
    }
    
    lastTickTime += duration;
    const nextTickDelay = (lastTickTime - (Date.now() / 1000)) * 1000;

    setTimeout(runGenerator, Math.max(0, nextTickDelay));
}

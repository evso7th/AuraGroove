
// public/workers/ambient.worker.js

let sampleRate = 44100;
let isGenerating = false;
let instruments = {
    solo: 'none',
    accompaniment: 'none',
    bass: 'bass guitar',
};
let drumsEnabled = true;

const decodedSamples = {};

// --- UTILITY FUNCTIONS ---
function generateSineWave(frequency, duration, volume = 0.5) {
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate)) * volume;
    }
    return buffer;
}

function generateOrganSound(frequency, duration, volume = 0.3) {
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    const harmonics = [1, 2, 3, 4, 6]; 
    const harmonicAmplitudes = [0.6, 0.2, 0.1, 0.05, 0.02];

    for (let i = 0; i < numSamples; i++) {
        let sample = 0;
        for (let h = 0; h < harmonics.length; h++) {
            sample += Math.sin(2 * Math.PI * frequency * harmonics[h] * (i / sampleRate)) * harmonicAmplitudes[h];
        }
        buffer[i] = sample * volume;
    }
    return applyEnvelope(buffer);
}

function generatePianoSound(frequency, duration, volume = 0.4) {
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    const decay = 4.0; 

    for (let i = 0; i < numSamples; i++) {
        const time = i / sampleRate;
        let sample = 0;
        // Simple additive synthesis for piano-like timbre
        sample += Math.sin(2 * Math.PI * frequency * time) * Math.exp(-decay * time);
        sample += 0.5 * Math.sin(2 * Math.PI * frequency * 2 * time) * Math.exp(-decay * time);
        sample += 0.25 * Math.sin(2 * Math.PI * frequency * 3 * time) * Math.exp(-decay * time);
        buffer[i] = sample * volume;
    }
     return applyEnvelope(buffer, 0.01, 0.3, 0.2, 0.2);
}


function applyEnvelope(buffer, attack = 0.02, decay = 0.1, sustain = 0.6, release = 0.1) {
    const totalDuration = buffer.length / sampleRate;
    const attackSamples = Math.floor(sampleRate * attack);
    const decaySamples = Math.floor(sampleRate * decay);
    const releaseSamples = Math.floor(sampleRate * release);
    const sustainSamples = buffer.length - attackSamples - decaySamples - releaseSamples;

    // Attack
    for (let i = 0; i < attackSamples; i++) {
        buffer[i] *= (i / attackSamples);
    }
    // Decay and Sustain
    for (let i = attackSamples; i < attackSamples + decaySamples; i++) {
        buffer[i] *= (1.0 - (1.0 - sustain) * ((i - attackSamples) / decaySamples));
    }
    // Release
     for (let i = buffer.length - releaseSamples; i < buffer.length; i++) {
        buffer[i] *= (1.0 - ((i - (buffer.length - releaseSamples)) / releaseSamples));
    }

    return buffer;
}


function generateSynthesizerPart(duration) {
    return generateOrganSound(220, duration);
}

function generatePianoPart(duration) {
    return generatePianoSound(440, duration);
}

function generateBassPart(duration) {
    return generateSineWave(110, duration, 0.6);
}

function generateDrumPart(duration) {
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new Float32Array(numSamples);
    const beatInterval = Math.floor(sampleRate / 2); // Two beats per second (120 bpm)

    for (let i = 0; i < numSamples; i += beatInterval) {
        // Kick on the beat
        if (decodedSamples.kick) {
            const kick = decodedSamples.kick;
            buffer.set(kick, i);
        }
        // Snare on the off-beat
        if (decodedSamples.snare && (i + beatInterval / 2) < numSamples) {
            const snare = decodedSamples.snare;
            buffer.set(snare, i + beatInterval / 2);
        }
    }
    return buffer;
}


// --- MAIN WORKER LOGIC ---

self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'load_samples':
            Object.assign(decodedSamples, data);
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            if (data && data.sampleRate) {
                sampleRate = data.sampleRate;
            }
            if (data && data.instruments) {
                instruments = data.instruments;
            }
            if(data && typeof data.drumsEnabled !== 'undefined') {
                drumsEnabled = data.drumsEnabled;
            }
            startGenerator();
            break;
        case 'stop':
            stopGenerator();
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
             if(data && typeof data.enabled !== 'undefined') {
                drumsEnabled = data.enabled;
            }
            break;
    }
};

function startGenerator() {
    if (isGenerating) return;
    isGenerating = true;
    runGenerator();
}

function stopGenerator() {
    isGenerating = false;
}

function mix(buffer1, buffer2) {
    const minLength = Math.min(buffer1.length, buffer2.length);
    const result = new Float32Array(minLength);
    for (let i = 0; i < minLength; i++) {
        result[i] = (buffer1[i] || 0) + (buffer2[i] || 0);
    }
    return result;
}

function mixAll(parts) {
    if (parts.length === 0) {
        // Return a buffer of silence if no parts are generated.
        // This is important to keep the audio flowing.
        const duration = 2.0; // Standard duration for a silent chunk
        return new Float32Array(Math.floor(sampleRate * duration));
    }

    let mixed = new Float32Array(parts[0].length);
    parts.forEach(part => {
        if(part) { // Ensure part is not undefined
             for (let i = 0; i < Math.min(mixed.length, part.length); i++) {
                mixed[i] += part[i];
            }
        }
    });

    // Normalize
    let max = 0;
    for (let i = 0; i < mixed.length; i++) {
        max = Math.max(max, Math.abs(mixed[i]));
    }
    if (max > 1) {
        for (let i = 0; i < mixed.length; i++) {
            mixed[i] /= max;
        }
    }

    return mixed;
}

async function runGenerator() {
    while (isGenerating) {
        const duration = 2.0; // Generate 2 seconds of audio at a time
        const generatedParts = [];

        if (instruments.solo === 'synthesizer') {
            generatedParts.push(generateSynthesizerPart(duration));
        } else if (instruments.solo === 'piano') {
            generatedParts.push(generatePianoPart(duration));
        } else if (instruments.solo === 'organ') {
             generatedParts.push(generateOrganSound(330, duration));
        }

        if (instruments.accompaniment === 'synthesizer') {
            generatedParts.push(generateSynthesizerPart(duration));
        } else if (instruments.accompaniment === 'piano') {
            generatedParts.push(generatePianoPart(duration));
        } else if (instruments.accompaniment === 'organ') {
            generatedParts.push(generateOrganSound(330, duration, 0.2));
        }


        if (instruments.bass === 'bass guitar') {
            generatedParts.push(generateBassPart(duration));
        }

        if (drumsEnabled) {
            generatedParts.push(generateDrumPart(duration));
        }
        
        const chunk = mixAll(generatedParts.filter(p => p)); // Filter out any null/undefined parts
        
        if (chunk.length > 0) {
           self.postMessage({ type: 'chunk', data: { chunk, duration } }, [chunk.buffer]);
        }

        await new Promise(resolve => setTimeout(resolve, duration * 1000));
    }
}


self.importScripts('/lib/fractal-music-generator.js');

let generationInterval;
let currentTime = 0;
let isGenerating = false;
let sampleRate = 44100;
let instruments = {
    solo: 'synthesizer',
    accompaniment: 'piano',
    bass: 'bass guitar'
};
let drumsEnabled = true;

const CHUNK_DURATION = 0.5; // seconds

function generateAudioChunk() {
    const chunkSamples = Math.floor(CHUNK_DURATION * sampleRate);
    const chunkBuffer = new Float32Array(chunkSamples).fill(0);
    
    const soloPart = instruments.solo !== 'none' ? generatePart('solo', instruments.solo, currentTime, CHUNK_DURATION) : [];
    const accompanimentPart = instruments.accompaniment !== 'none' ? generatePart('accompaniment', instruments.accompaniment, currentTime, CHUNK_DURATION) : [];
    const bassPart = instruments.bass !== 'none' ? generatePart('bass', instruments.bass, currentTime, CHUNK_DURATION) : [];
    const drumPart = drumsEnabled ? generateDrums(currentTime, CHUNK_DURATION) : [];

    const allNotes = [...soloPart, ...accompanimentPart, ...bassPart, ...drumPart];

    for (const note of allNotes) {
        const startSample = Math.floor((note.time - currentTime) * sampleRate);
        const endSample = Math.floor(startSample + note.duration * sampleRate);

        for (let i = startSample; i < endSample && i < chunkSamples; i++) {
            if (i < 0) continue;
            const t = (i - startSample) / (note.duration * sampleRate);
            
            let sampleValue = 0;
            // Simple ADSR envelope
            const attackTime = 0.01;
            const decayTime = 0.1;
            const sustainLevel = 0.7;
            const releaseTime = 0.1;

            let envelope = 0;
            if (t < attackTime) {
                envelope = t / attackTime;
            } else if (t < attackTime + decayTime) {
                envelope = 1 - (1 - sustainLevel) * (t - attackTime) / decayTime;
            } else if (note.duration - t < releaseTime) {
                const releaseT = t - (note.duration - releaseTime);
                envelope = sustainLevel * (1 - releaseT / releaseTime);
            } else {
                envelope = sustainLevel;
            }

            // Simple sine wave oscillator
            sampleValue = Math.sin(2 * Math.PI * note.freq * t) * envelope * note.velocity;

            chunkBuffer[i] += sampleValue;
        }
    }

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkBuffer,
            duration: CHUNK_DURATION
        }
    }, [chunkBuffer.buffer]);

    currentTime += CHUNK_DURATION;
}

function startGeneration() {
    if (isGenerating) return;
    isGenerating = true;
    currentTime = 0;
    
    self.postMessage({ type: 'generation_started' });

    if (generationInterval) {
        clearInterval(generationInterval);
    }
    // Call it immediately once, then set interval
    generateAudioChunk();
    generationInterval = setInterval(generateAudioChunk, CHUNK_DURATION * 1000 * 0.9); // Schedule slightly faster
}

function stopGeneration() {
    if (!isGenerating) return;
    isGenerating = false;
    if (generationInterval) {
        clearInterval(generationInterval);
        generationInterval = null;
    }
    self.postMessage({ type: 'generation_stopped' });
}

self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'start':
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            startGeneration();
            break;
        case 'stop':
            stopGeneration();
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
    }
};

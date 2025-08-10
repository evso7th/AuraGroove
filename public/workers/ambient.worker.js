
import { 
    generateSynthesizer, 
    generatePiano, 
    generateOrgan, 
    generateBassGuitar, 
    mixParts 
} from './generation.js';

let timerId = null;
let instruments = {};
let drumsEnabled = true;
let sampleRate = 44100;
let decodedSamples = {};

const CHUNK_DURATION = 1; // 1 second chunks

function generateNextChunk() {
    if (!sampleRate) return;

    const chunkSampleLength = Math.floor(CHUNK_DURATION * sampleRate);
    let activeParts = [];

    // --- Solo ---
    if (instruments.solo && instruments.solo !== 'none') {
        let soloPart;
        if (instruments.solo === 'synthesizer') {
            soloPart = generateSynthesizer(CHUNK_DURATION, sampleRate, 440, 'sawtooth');
        } else if (instruments.solo === 'piano') {
            soloPart = generatePiano(CHUNK_DURATION, sampleRate, 60);
        } else if (instruments.solo === 'organ') {
            soloPart = generateOrgan(CHUNK_DURATION, sampleRate, 60);
        }
        if (soloPart) activeParts.push(soloPart);
    }
    
    // --- Accompaniment ---
    if (instruments.accompaniment && instruments.accompaniment !== 'none') {
        let accompanimentPart;
        if (instruments.accompaniment === 'synthesizer') {
            accompanimentPart = generateSynthesizer(CHUNK_DURATION, sampleRate, [220, 261, 329], 'sine');
        } else if (instruments.accompaniment === 'piano') {
            accompanimentPart = generatePiano(CHUNK_DURATION, sampleRate, [48, 52, 55]);
        } else if (instruments.accompaniment === 'organ') {
            accompanimentPart = generateOrgan(CHUNK_DURATION, sampleRate, [48, 52, 55]);
        }
        if (accompanimentPart) activeParts.push(accompanimentPart);
    }
    
    // --- Bass ---
    if (instruments.bass && instruments.bass !== 'none' && instruments.bass === 'bass guitar') {
        const bassPart = generateBassGuitar(CHUNK_DURATION, sampleRate, 41.2); // E1
        if (bassPart) activeParts.push(bassPart);
    }
    
    // --- Drums ---
    if (drumsEnabled && Object.keys(decodedSamples).length > 0) {
        const drumsPart = new Float32Array(chunkSampleLength).fill(0);
        const beatsPerSecond = 2; // 120 BPM
        
        for (let i = 0; i < CHUNK_DURATION * beatsPerSecond; i++) {
            const beatTime = i / beatsPerSecond;
            const beatSampleIndex = Math.floor(beatTime * sampleRate);

            // Simple 4/4 beat
            if (i % 4 === 0 || i % 4 === 2) { // Kick on 1 and 3
                if (decodedSamples.kick) mixParts([drumsPart, decodedSamples.kick], 1, beatSampleIndex);
            }
            if (i % 4 === 1 || i % 4 === 3) { // Snare on 2 and 4
                 if (decodedSamples.snare) mixParts([drumsPart, decodedSamples.snare], 1, beatSampleIndex);
            }
            // Hi-hat on every 8th note
            if (decodedSamples.hat) {
                 mixParts([drumsPart, decodedSamples.hat], 0.5, beatSampleIndex);
                 mixParts([drumsPart, decodedSamples.hat], 0.5, beatSampleIndex + Math.floor(sampleRate / (beatsPerSecond * 2)));
            }
        }
        activeParts.push(drumsPart);
    }

    const finalChunk = mixParts(activeParts, chunkSampleLength);

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: finalChunk,
            duration: CHUNK_DURATION,
        },
    }, [finalChunk.buffer]);
}

self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            decodedSamples = data;
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            sampleRate = data.sampleRate;

            if (timerId) clearInterval(timerId);
            timerId = setInterval(generateNextChunk, CHUNK_DURATION * 1000 * 0.9); // Schedule slightly faster to avoid gaps
            break;
        case 'stop':
            if (timerId) clearInterval(timerId);
            timerId = null;
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
    }
};

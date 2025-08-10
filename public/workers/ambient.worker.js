// public/workers/ambient.worker.js

let decodedSamples = {};
let instruments = {};
let drumsEnabled = true;
let isRunning = false;
let sampleRate = 44100;
let lastTickTime = 0;
const TICK_INTERVAL = 100; // ms
const CHUNK_DURATION = 2; // seconds

// --- Утилиты для генерации ---
function generateSynthesizer(duration, sampleRate) {
    const totalSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(totalSamples);
    const frequency = 440.0 * Math.pow(2, (Math.floor(Math.random() * 24) - 12) / 12);
    let lastValue = 0;

    for (let i = 0; i < totalSamples; i++) {
        const time = i / sampleRate;
        // Simple FM synthesis for a bit more texture
        const modulator = Math.sin(2 * Math.PI * frequency * 0.5 * time);
        const wav = Math.sin(2 * Math.PI * (frequency + modulator * 50) * time);
        const envelope = 1 - (i / totalSamples); // simple decay
        const value = wav * envelope * 0.3;

        // Low-pass filter to smooth it out
        const smoothedValue = (value + lastValue) / 2;
        buffer[i] = smoothedValue;
        lastValue = value;
    }
    return buffer;
}

function generatePiano(duration, sampleRate) {
    const totalSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(totalSamples);
    const fundamental = 261.63 * Math.pow(2, Math.floor(Math.random() * 5) / 12); // C4 to G4
    const harmonics = [1, 0.5, 0.25, 0.125, 0.06];

    for (let i = 0; i < totalSamples; i++) {
        const time = i / sampleRate;
        let value = 0;
        for (let h = 0; h < harmonics.length; h++) {
            value += Math.sin(2 * Math.PI * fundamental * (h + 1) * time) * harmonics[h];
        }
        const envelope = Math.exp(-time * 5); // Exponential decay
        buffer[i] = value * envelope * 0.4;
    }
    return buffer;
}


function generateOrgan(duration, sampleRate) {
    const totalSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(totalSamples);
    const fundamental = 220.0 * Math.pow(2, Math.floor(Math.random() * 7 - 3) / 12);
    const overtones = [1, 0.5, 0.2, 0.1]; // Organ-like harmonics

    for (let i = 0; i < totalSamples; i++) {
        const time = i / sampleRate;
        let value = 0;
        for (let o = 0; o < overtones.length; o++) {
            value += Math.sin(2 * Math.PI * fundamental * Math.pow(2, o) * time) * overtones[o];
        }
        const attack = Math.min(1, time * 10);
        const release = Math.max(0, 1 - (time / duration));
        buffer[i] = value * attack * release * 0.3;
    }
    return buffer;
}

function generateBass(duration, sampleRate) {
    const totalSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(totalSamples);
    const frequency = 82.41 * Math.pow(2, Math.floor(Math.random() * 4) / 12); // E2 to G#2

    for (let i = 0; i < totalSamples; i++) {
        const time = i / sampleRate;
        const value = Math.sin(2 * Math.PI * frequency * time) + Math.sin(2 * Math.PI * frequency * 2 * time) * 0.5;
        const envelope = Math.exp(-time * 3.0);
        buffer[i] = value * envelope * 0.5;
    }
    return buffer;
}

function generateDrumPart(duration, sampleRate) {
    if (!decodedSamples.kick || !decodedSamples.hat || !decodedSamples.snare) {
        return new Float32Array(Math.floor(duration * sampleRate));
    }
    const totalSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(totalSamples);

    const drumPattern = [
        { sample: 'kick', time: 0 },
        { sample: 'hat', time: 0 },
        { sample: 'hat', time: 0.25 },
        { sample: 'snare', time: 0.5 },
        { sample: 'hat', time: 0.5 },
        { sample: 'hat', time: 0.75 },
    ];
    
    for(const hit of drumPattern) {
        const sampleData = decodedSamples[hit.sample];
        if (!sampleData) continue;

        const startSample = Math.floor(hit.time * totalSamples);
        
        // --- Исправление ошибки RangeError ---
        if (startSample + sampleData.length <= buffer.length) {
            // Сэмпл полностью помещается
            buffer.set(sampleData, startSample);
        } else {
            // Основной сэмпл не помещается, пробуем короткий
            const shortSample = decodedSamples['hat'];
            if (shortSample && startSample + shortSample.length <= buffer.length) {
                 buffer.set(shortSample, startSample);
            }
            // Если даже короткий не влезает, ничего не делаем
        }
    }
    return buffer;
}


// --- Основная логика воркера ---
self.onmessage = function(event) {
    const { command, data } = event.data;

    if (command === 'load_samples') {
        decodedSamples = data;
        sampleRate = data.sampleRate;
        self.postMessage({ type: 'samples_loaded' });
    } else if (command === 'start') {
        instruments = data.instruments;
        drumsEnabled = data.drumsEnabled;
        sampleRate = data.sampleRate;
        if (!isRunning) {
            startGenerator();
        }
    } else if (command === 'stop') {
        stopGenerator();
    } else if (command === 'set_instruments') {
        instruments = data;
    } else if (command === 'toggle_drums') {
        drumsEnabled = data.enabled;
    }
};

function startGenerator() {
    isRunning = true;
    lastTickTime = performance.now();
    runGenerator();
}

function stopGenerator() {
    isRunning = false;
}

function runGenerator() {
    if (!isRunning) return;

    const now = performance.now();
    if (now >= lastTickTime + TICK_INTERVAL) {
        const duration = CHUNK_DURATION;
        const totalSamples = Math.floor(duration * sampleRate);
        const finalMix = new Float32Array(totalSamples).fill(0);
        let partCount = 0;

        // Generate parts based on selected instruments
        let soloPart, accompanimentPart, bassPart, drumPart;

        if (instruments.solo !== 'none') {
            const soloGenerator = getGeneratorForInstrument(instruments.solo);
            if (soloGenerator) soloPart = soloGenerator(duration, sampleRate);
        }
        if (instruments.accompaniment !== 'none') {
            const accompanimentGenerator = getGeneratorForInstrument(instruments.accompaniment);
            if (accompanimentGenerator) accompanimentPart = accompanimentGenerator(duration, sampleRate);
        }
        if (instruments.bass !== 'none' && instruments.bass === 'bass guitar') {
             bassPart = generateBass(duration, sampleRate);
        }
        if (drumsEnabled) {
            drumPart = generateDrumPart(duration, sampleRate);
        }

        // Mix parts together, only if they exist
        const parts = [soloPart, accompanimentPart, bassPart, drumPart];
        for (const part of parts) {
            if (part) { // Проверяем, что партия сгенерирована
                for (let i = 0; i < totalSamples; i++) {
                    finalMix[i] += part[i];
                }
                partCount++;
            }
        }
        
        // Normalize if parts were mixed
        if (partCount > 1) {
            for (let i = 0; i < totalSamples; i++) {
                finalMix[i] /= partCount;
            }
        }
        
        // Send the complete chunk to the main thread
        self.postMessage({ type: 'chunk', data: { chunk: finalMix, duration } }, [finalMix.buffer]);
        
        lastTickTime += CHUNK_DURATION * 1000;
    }

    // Continue the loop
    setTimeout(runGenerator, TICK_INTERVAL);
}


function getGeneratorForInstrument(instrument) {
    switch (instrument) {
        case 'synthesizer':
            return generateSynthesizer;
        case 'piano':
            return generatePiano;
        case 'organ':
            return generateOrgan;
        default:
            return null;
    }
}

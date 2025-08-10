
"use strict";

// --- Утилиты ---
function noteToFrequency(note) {
    const a4 = 440;
    const notes = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
    const keyNumber = (note.octave - 4) * 12 + notes.indexOf(note.name) - 9;
    return a4 * Math.pow(2, keyNumber / 12);
}

function createSineWave(frequency, duration, sampleRate) {
    const numSamples = Math.floor(duration * sampleRate);
    const buffer = new Float32Array(numSamples);
    for (let i = 0; i < numSamples; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate));
    }
    return buffer;
}

function applyADSR(buffer, adsr, sampleRate) {
    const { attack, decay, sustain, release } = adsr;
    const numSamples = buffer.length;
    const attackSamples = Math.floor(attack * sampleRate);
    const decaySamples = Math.floor(decay * sampleRate);
    const releaseSamples = Math.floor(release * sampleRate);
    const sustainSamples = numSamples - attackSamples - decaySamples - releaseSamples;

    if (sustainSamples < 0) {
        // Handle short notes that don't have a sustain phase
        return buffer;
    }

    for (let i = 0; i < numSamples; i++) {
        let amplitude = 0;
        if (i < attackSamples) {
            amplitude = i / attackSamples;
        } else if (i < attackSamples + decaySamples) {
            amplitude = 1 - (1 - sustain) * ((i - attackSamples) / decaySamples);
        } else if (i < attackSamples + decaySamples + sustainSamples) {
            amplitude = sustain;
        } else {
            amplitude = sustain * (1 - (i - (attackSamples + decaySamples + sustainSamples)) / releaseSamples);
        }
        buffer[i] *= Math.max(0, amplitude);
    }
    return buffer;
}

const instrumentADSR = {
    synthesizer: { attack: 0.1, decay: 0.2, sustain: 0.5, release: 0.4 },
    piano: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.2 },
    organ: { attack: 0.2, decay: 0.1, sustain: 0.8, release: 0.3 },
    'bass guitar': { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.3 },
};

// --- Состояние воркера ---
let state = {
    isPlaying: false,
    instruments: {
        solo: 'synthesizer',
        accompaniment: 'piano',
        bass: 'bass guitar',
    },
    drumsEnabled: true,
    sampleRate: 44100,
    samples: {}, // { snare: Float32Array, ... }
    tempo: 90,
    currentPatternType: 'main',
    nextPatternTime: 0,
};

// --- Генерация ударных (с цепями Маркова) ---
const drumPatterns = {
    main: [
        { sample: 'kick_drum6', time: 0 },
        { sample: 'closed_hi_hat_accented', time: 0 },
        { sample: 'closed_hi_hat_ghost', time: 0.25 },
        { sample: 'snare_ghost_note', time: 0.5 },
        { sample: 'closed_hi_hat_accented', time: 0.5 },
        { sample: 'closed_hi_hat_ghost', time: 0.75 },
    ],
    calm: [
        { sample: 'kick_drum6', time: 0 },
        { sample: 'cymbal_bell1', time: 0.25 },
        { sample: 'kick_drum6', time: 0.5 },
        { sample: 'cymbal_bell2', time: 0.75 },
    ],
    fill: [
        { sample: 'hightom', time: 0.5 },
        { sample: 'midtom', time: 0.625 },
        { sample: 'lowtom', time: 0.75 },
        { sample: 'crash1', time: 0.875 },
    ]
};

const markovTransitions = {
    main: { calm: 0.2, main: 0.7, fill: 0.1 },
    calm: { main: 0.8, calm: 0.2, fill: 0.0 },
    fill: { main: 1.0, calm: 0.0, fill: 0.0 },
};


function getNextPatternType(currentType) {
    const transitions = markovTransitions[currentType];
    let rand = Math.random();
    for (const nextType in transitions) {
        rand -= transitions[nextType];
        if (rand <= 0) {
            return nextType;
        }
    }
    return 'main'; // Fallback
}


function generateDrums(pattern, barDuration) {
    const drumChunk = new Float32Array(Math.floor(barDuration * state.sampleRate));
    for (const hit of pattern) {
        const sampleBuffer = state.samples[hit.sample];
        if (sampleBuffer) {
            const startTime = Math.floor(hit.time * barDuration * state.sampleRate);
            for (let i = 0; i < sampleBuffer.length; i++) {
                if (startTime + i < drumChunk.length) {
                    drumChunk[startTime + i] += sampleBuffer[i];
                }
            }
        }
    }
    return drumChunk;
}


// --- Основной цикл генерации ---

function generateMusicChunk(barDuration) {
    const numSamples = Math.floor(barDuration * state.sampleRate);
    let finalChunk = new Float32Array(numSamples);

    // Ударные
    if (state.drumsEnabled) {
        const pattern = drumPatterns[state.currentPatternType];
        const drumChunk = generateDrums(pattern, barDuration);
        for(let i = 0; i < numSamples; i++) finalChunk[i] += drumChunk[i] * 0.4;
    }

    // Бас
    if (state.instruments.bass !== 'none') {
        const adsr = instrumentADSR[state.instruments.bass];
        const bassWave = createSineWave(noteToFrequency({name: 'C', octave: 2}), barDuration, state.sampleRate);
        const processedBass = applyADSR(bassWave, adsr, state.sampleRate);
        for(let i = 0; i < numSamples; i++) finalChunk[i] += processedBass[i] * 0.3;
    }

    // Аккомпанемент
    if (state.instruments.accompaniment !== 'none') {
        const adsr = instrumentADSR[state.instruments.accompaniment];
        const chordNotes = ['C4', 'E4', 'G4'];
        for(const noteName of chordNotes) {
            const noteWave = createSineWave(noteToFrequency({name: noteName.slice(0,-1), octave: parseInt(noteName.slice(-1))}), barDuration, state.sampleRate);
            const processedNote = applyADSR(noteWave, adsr, state.sampleRate);
             for(let i = 0; i < numSamples; i++) finalChunk[i] += processedNote[i] * 0.15;
        }
    }

    // Соло
    if (state.instruments.solo !== 'none') {
         if (Math.random() > 0.6) { // Play a note sometimes
            const adsr = instrumentADSR[state.instruments.solo];
            const soloWave = createSineWave(noteToFrequency({name: 'A', octave: 4}), barDuration * 0.5, state.sampleRate);
            const processedSolo = applyADSR(soloWave, adsr, state.sampleRate);
             for(let i = 0; i < processedSolo.length; i++) finalChunk[i] += processedSolo[i] * 0.2;
        }
    }

    return finalChunk;
}

function startGeneration() {
    if (!state.isPlaying) return;

    // --- ИСПРАВЛЕНИЕ: Отправляем сообщение о старте ---
    self.postMessage({ type: 'generation_started' });

    let barCount = 0;
    const scheduleAheadTime = 1.0; // seconds

    const generatorLoop = () => {
        if (!state.isPlaying) return;

        const barDuration = 60.0 / state.tempo * 4; // 4/4 time signature

        while (state.nextPatternTime < state.sampleRate * scheduleAheadTime + barCount * barDuration * state.sampleRate) {
            
             // Выбираем следующий паттерн на основе цепей Маркова
            if (barCount % 4 === 0) { // Меняем паттерн каждые 4 такта
                 state.currentPatternType = getNextPatternType(state.currentPatternType);
            }

            const chunk = generateMusicChunk(barDuration);
            self.postMessage({
                type: 'chunk',
                data: {
                    chunk: chunk,
                    duration: barDuration
                }
            }, [chunk.buffer]);

            state.nextPatternTime += chunk.length;
            barCount++;
        }

        setTimeout(generatorLoop, (scheduleAheadTime / 2) * 1000);
    };

    generatorLoop();
}

// --- Обработчик сообщений ---
self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'start':
            Object.assign(state, data);
            state.isPlaying = true;
            state.nextPatternTime = 0;
            startGeneration();
            break;

        case 'stop':
            state.isPlaying = false;
            break;

        case 'load_samples':
            for(const key in data) {
                state.samples[key] = data[key];
                console.log(`Worker: Received and stored raw sample data for: ${key}`);
            }
            break;
            
        case 'set_instruments':
            state.instruments = data;
            break;
            
        case 'toggle_drums':
            state.drumsEnabled = data.enabled;
            break;
    }
};

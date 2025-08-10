
"use strict";

// --- Утилиты ---
const noteToFrequency = (note) => 440 * Math.pow(2, (note - 69) / 12);

function ADSR(audioParam, time, adsr, sustainLevel = 0.5, maxLevel = 1.0) {
    const { attack, decay, sustain, release } = adsr;
    audioParam.cancelScheduledValues(time);
    audioParam.setValueAtTime(0, time);
    audioParam.linearRampToValueAtTime(maxLevel, time + attack);
    audioParam.linearRampToValueAtTime(sustainLevel * maxLevel, time + attack + decay);
    audioParam.setValueAtTime(sustainLevel * maxLevel, time + attack + decay + sustain);
    audioParam.linearRampToValueAtTime(0, time + attack + decay + sustain + release);
}

// --- Осцилляторы ---
function sine(time, freq) {
    return Math.sin(freq * 2 * Math.PI * time);
}

// --- Состояние ---
let sampleRate = 44100;
let time = 0;
let isRunning = false;
let instruments = { solo: "none", accompaniment: "none", bass: "none" };
let drumsEnabled = true;

const BPM = 120;
const beatsPerSecond = BPM / 60;
const quarterNoteDuration = 1 / beatsPerSecond;

let nextKickTime = 0;
let nextSnareTime = quarterNoteDuration * 2;
let nextHiHatTime = 0;
let nextTom1Time = -1, nextTom2Time = -1, nextTom3Time = -1;

const CHUNK_DURATION_SECONDS = 0.1;

// --- Основная логика ---
function generateAudioChunk() {
    const samplesPerChunk = Math.floor(sampleRate * CHUNK_DURATION_SECONDS);
    const chunkBuffer = new Float32Array(samplesPerChunk).fill(0);
    const timeStep = 1 / sampleRate;
    const masterGain = 0.5;

    // Громкость инструментов
    const kickGain = 0.5;
    const snareGain = 0.4;
    const hiHatGain = 0.2;
    const tomGain = 0.4;
    const bassGain = 0.4;

    for (let i = 0; i < samplesPerChunk; i++) {
        let currentSample = 0;

        // --- Ударные ---
        if (drumsEnabled) {
            // Kick
            if (time >= nextKickTime) {
                const kickFreq = 60;
                const attackTime = 0.01;
                const decayTime = 0.2;
                if (time < nextKickTime + attackTime) {
                    currentSample += sine(time - nextKickTime, kickFreq) * (1 - (time - nextKickTime) / attackTime) * kickGain;
                } else if (time < nextKickTime + decayTime) {
                    currentSample += sine(time - nextKickTime, kickFreq) * Math.exp(-(time - nextKickTime - attackTime) * 5) * kickGain;
                }
                if (time >= nextKickTime + quarterNoteDuration * 4) {
                    nextKickTime += quarterNoteDuration * 4;
                }
            }

            // Snare
            if (time >= nextSnareTime) {
                const snareFreq = 250;
                 const attackTime = 0.01;
                const decayTime = 0.15;
                 if (time < nextSnareTime + attackTime) {
                    currentSample += (Math.random() * 2 - 1) * (1 - (time - nextSnareTime) / attackTime) * snareGain;
                } else if (time < nextSnareTime + decayTime) {
                    currentSample += (Math.random() * 2 - 1) * Math.exp(-(time - nextSnareTime-attackTime) * 15) * snareGain;
                }
                if (time >= nextSnareTime + quarterNoteDuration * 4) {
                    nextSnareTime += quarterNoteDuration * 4;
                }
            }
             // Toms Fill
            if (time >= nextTom1Time && nextTom1Time > 0) {
                 if (time < nextTom1Time + 0.2) currentSample += sine(time - nextTom1Time, 200) * Math.exp(-(time - nextTom1Time) * 10) * tomGain; else nextTom1Time = -1;
            }
            if (time >= nextTom2Time && nextTom2Time > 0) {
                if (time < nextTom2Time + 0.2) currentSample += sine(time - nextTom2Time, 150) * Math.exp(-(time - nextTom2Time) * 10) * tomGain; else nextTom2Time = -1;
            }
             if (time >= nextTom3Time && nextTom3Time > 0) {
                if (time < nextTom3Time + 0.3) currentSample += sine(time - nextTom3Time, 100) * Math.exp(-(time - nextTom3Time) * 8) * tomGain; else nextTom3Time = -1;
            }
        }
        
        // Hi-Hat (проблема "призрака" все еще здесь)
        if (time >= nextHiHatTime) {
            const decayTime = 0.05;
            if (time < nextHiHatTime + decayTime) {
                 currentSample += (Math.random() * 2 - 1) * Math.exp(-(time - nextHiHatTime) * 30) * hiHatGain;
            }
            if (time >= nextHiHatTime + quarterNoteDuration) {
                nextHiHatTime += quarterNoteDuration;
                // Сбивка томами в конце каждого 4-го такта
                if (Math.floor(nextHiHatTime / (quarterNoteDuration * 16)) % 1 === 0 && nextHiHatTime > 0) {
                     if (drumsEnabled) {
                        nextTom1Time = nextHiHatTime - quarterNoteDuration * 2;
                        nextTom2Time = nextHiHatTime - quarterNoteDuration * 1.5;
                        nextTom3Time = nextHiHatTime - quarterNoteDuration;
                     }
                }
            }
        }

        // --- Бас ---
         if (instruments.bass === 'bass guitar') {
             if (time >= nextKickTime) { // Привязка к бочке
                const bassNote = 31; // E1
                const bassFreq = noteToFrequency(bassNote);
                const decayTime = 0.2;
                 if (time < nextKickTime + decayTime) {
                    currentSample += sine(time - nextKickTime, bassFreq) * Math.exp(-(time - nextKickTime) * 5) * bassGain;
                }
            }
        }


        chunkBuffer[i] = currentSample * masterGain;
        time += timeStep;
    }
    return chunkBuffer;
}


// --- Управление Worker'ом ---
function run() {
    if (!isRunning) return;
    const chunk = generateAudioChunk();
    self.postMessage({ type: 'chunk', data: { chunk, duration: CHUNK_DURATION_SECONDS } }, [chunk.buffer]);
    setTimeout(run, CHUNK_DURATION_SECONDS * 0.9 * 1000);
}

self.onmessage = (event) => {
    const { command, data } = event.data;
    switch (command) {
        case 'start':
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            isRunning = true;
            time = 0;
            // Сброс времени для всех партий
            nextKickTime = 0;
            nextSnareTime = quarterNoteDuration * 2;
            nextHiHatTime = 0;
            nextTom1Time = -1;
            nextTom2Time = -1;
            nextTom3Time = -1;
            run();
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

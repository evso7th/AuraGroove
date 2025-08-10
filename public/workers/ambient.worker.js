
"use strict";

// --- Configuration ---
const CHUNK_DURATION_SECONDS = 2.0; // How much audio to generate per chunk
const NOTE_LOOKAHEAD_SECONDS = 0.1; // How far ahead to schedule notes

// --- State ---
let sampleRate = 44100;
let tempoBPM = 60; 
let instruments = { solo: "none", accompaniment: "none", bass: "none" };
let drumsEnabled = true;
let samples = {}; 
let tick = 0;
let isRunning = false;
let nextChunkTime = 0;
let timerId = null;

// --- DSP and Synthesis Functions ---

function midiToFreq(midi) {
    return Math.pow(2, (midi - 69) / 12) * 440;
}

function createEnvelope(level, attackTime, decayTime, sampleRate) {
    const attackSamples = Math.floor(attackTime * sampleRate);
    const decaySamples = Math.floor(decayTime * sampleRate);
    const totalSamples = attackSamples + decaySamples;
    const envelope = new Float32Array(totalSamples);
    for (let i = 0; i < attackSamples; i++) {
        envelope[i] = level * (i / attackSamples);
    }
    for (let i = 0; i < decaySamples; i++) {
        envelope[attackSamples + i] = level * (1 - i / decaySamples);
    }
    return envelope;
}

function applyFadeOut(buffer) {
    const fadeOutSamples = Math.floor(0.5 * buffer.length); // Fade out over last 50%
    for (let i = 0; i < fadeOutSamples; i++) {
        const sampleIndex = buffer.length - fadeOutSamples + i;
        if (sampleIndex < buffer.length) {
            buffer[sampleIndex] *= (1 - i / fadeOutSamples);
        }
    }
    return buffer;
}


// --- Music Generation ---

function generateMusicChunk(startTime, endTime) {
    const chunkSamples = Math.floor((endTime - startTime) * sampleRate);
    const outputBuffer = new Float32Array(chunkSamples).fill(0);
    const secondsPerBeat = 60.0 / tempoBPM;
    const beatsPerBar = 4;
    const barDurationSeconds = beatsPerBar * secondsPerBeat;
    
    // --- Instruments ---
    if (instruments.bass === 'bass guitar') {
        const totalBeatsInPattern = 8;
        const bassPattern = [
            { note: 28, startBeat: 0, durationBeats: 2 }, // E1
            { note: 28, startBeat: 2, durationBeats: 2 }, // E1
            { note: 28, startBeat: 4, durationBeats: 4 }, // E1
            { note: 31, startBeat: 6, durationBeats: 2 }, // G1
        ];

        for (let i = 0; i < chunkSamples; i++) {
            const currentTime = startTime + i / sampleRate;
            const currentBeat = (currentTime / secondsPerBeat);
            const beatInPattern = currentBeat % totalBeatsInPattern;

            for (const note of bassPattern) {
                if (beatInPattern >= note.startBeat && beatInPattern < note.startBeat + note.durationBeats) {
                    const timeInNote = (beatInPattern - note.startBeat) * secondsPerBeat;
                    const freq = midiToFreq(note.note);
                    
                    // Simple sine wave oscillator
                    const val = Math.sin(2 * Math.PI * freq * timeInNote);
                    
                     // Simple AD envelope
                    const attack = 0.01;
                    const decay = 0.3;
                    const totalEnvelopeTime = attack + decay;
                    let envelope = 0;
                    if (timeInNote < totalEnvelopeTime) {
                         if (timeInNote < attack) {
                            envelope = timeInNote / attack;
                        } else {
                            envelope = 1.0 - (timeInNote - attack) / decay;
                        }
                    }

                    outputBuffer[i] += val * envelope * 0.4; // Bass gain
                }
            }
        }
    }

    // --- Drums ---
    if (drumsEnabled) {
        const ticksPerBeat = 4; // 16th notes
        const totalTicksPerBar = ticksPerBeat * beatsPerBar;
        
        for (let i = 0; i < chunkSamples; i++) {
            const currentTime = startTime + i / sampleRate;
            const currentTick = Math.floor(currentTime / (secondsPerBeat / ticksPerBeat));
            const lastTick = Math.floor((startTime + (i - 1) / sampleRate) / (secondsPerBeat / ticksPerBeat));

            if (currentTick > lastTick) { // Play note only on tick change
                const currentBar = Math.floor(currentTick / totalTicksPerBar);
                const tickInBar = currentTick % totalTicksPerBar;
                
                // Kick: on beats 1 and 3
                if (tickInBar % (ticksPerBeat * 2) === 0 && currentTick > 0) {
                     mixSample(outputBuffer, samples.kick, i, 0.5);
                }
                // Snare: on beats 2 and 4
                if ((tickInBar - ticksPerBeat) % (ticksPerBeat * 2) === 0) {
                     mixSample(outputBuffer, samples.snare, i, 1.0);
                }
                // Hi-hat: on every beat
                if (tickInBar % ticksPerBeat === 0) {
                     mixSample(outputBuffer, samples.hat, i, 0.6);
                }
                 // Ride: every beat
                if (tickInBar % ticksPerBeat === 0) {
                    mixSample(outputBuffer, samples.ride, i, 1.0);
                }
                // Crash: 1st beat of every 4th bar
                if (currentBar % 4 === 0 && tickInBar === 0 && currentTick > 0) {
                    const crashCopy = samples.crash.slice(0);
                    mixSample(outputBuffer, applyFadeOut(crashCopy), i, 0.7);
                }

                // Tom fill at the end of every 4th bar
                if (currentBar % 4 === 3) {
                   if (tickInBar === totalTicksPerBar - 3) { // 4.3.2
                       mixSample(outputBuffer, samples.tom1, i, 0.9);
                   }
                   if (tickInBar === totalTicksPerBar - 2) { // 4.4.1
                       mixSample(outputBuffer, samples.tom2, i, 0.9);
                   }
                   if (tickInBar === totalTicksPerBar - 1) { // 4.4.3
                       mixSample(outputBuffer, samples.tom3, i, 0.9);
                   }
                }
            }
        }
    }

    return outputBuffer;
}


function mixSample(output, sample, offset, gain) {
    if (!sample) return;
    for (let j = 0; j < sample.length; j++) {
        if (offset + j < output.length) {
            output[offset + j] += sample[j] * gain;
        }
    }
}


// --- Worker Control ---
function scheduleNextChunk() {
    if (!isRunning) return;

    const currentTime = self.performance.now() / 1000;
    if (currentTime >= nextChunkTime) {
        const startTime = nextChunkTime;
        const endTime = startTime + CHUNK_DURATION_SECONDS;
        
        const chunkBuffer = generateMusicChunk(startTime, endTime);
        
        self.postMessage({
            type: 'chunk',
            data: {
                chunk: chunkBuffer,
                duration: CHUNK_DURATION_SECONDS
            }
        }, [chunkBuffer.buffer]);

        nextChunkTime = endTime;
    }
    
    const delay = (nextChunkTime - (self.performance.now() / 1000) - NOTE_LOOKAHEAD_SECONDS) * 1000;
    timerId = self.setTimeout(scheduleNextChunk, Math.max(0, delay));
}


self.onmessage = function(e) {
    const { command, data } = e.data;

    if (command === 'load_samples') {
        samples = data;
        self.postMessage({ type: 'samples_loaded' });
    } else if (command === 'start') {
        sampleRate = data.sampleRate;
        instruments = data.instruments;
        drumsEnabled = data.drumsEnabled;
        isRunning = true;
        tick = 0;
        nextChunkTime = self.performance.now() / 1000 + 0.1; // Start scheduling shortly after play is pressed
        scheduleNextChunk();
    } else if (command === 'stop') {
        isRunning = false;
        if (timerId) {
            self.clearTimeout(timerId);
            timerId = null;
        }
    } else if (command === 'set_instruments') {
        instruments = data;
    } else if (command === 'toggle_drums') {
        drumsEnabled = data.enabled;
    }
};

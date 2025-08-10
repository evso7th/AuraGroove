
"use strict";

import {
  drumPatternA,
  drumPatternB,
  generateSimpleBass,
  generateSimpleAccompaniment,
  generateSimpleSolo
} from '../lib/fractal-music-generator.js';

// --- State ---
let isRunning = false;
let sampleRate = 44100;
let instruments = {};
let drumsEnabled = true;

let loadedSamples = {
  snare: null
};

let totalBeatsGenerated = 0;
const BEAT_DURATION_SECONDS = 0.5; // Corresponds to 120 BPM

// --- Main Message Handler ---
self.onmessage = function(e) {
  const { command, data } = e.data;

  switch (command) {
    case 'start':
      startGeneration(data);
      break;
    case 'stop':
      stopGeneration();
      break;
    case 'load_samples':
      loadSamples(data);
      break;
    case 'set_instruments':
      instruments = data;
      break;
    case 'toggle_drums':
      drumsEnabled = data.enabled;
      break;
  }
};

// --- Core Logic ---

function loadSamples(data) {
  console.log("Worker: Received sample data.");
  loadedSamples = { ...data };
}

function startGeneration(config) {
  if (isRunning) return;
  isRunning = true;
  
  sampleRate = config.sampleRate;
  instruments = config.instruments;
  drumsEnabled = config.drumsEnabled;
  totalBeatsGenerated = 0;

  console.log("Worker: Starting generation...");
  self.postMessage({ type: 'generation_started' });
  
  generateAndSendChunk();
}

function stopGeneration() {
  if (!isRunning) return;
  isRunning = false;
  console.log("Worker: Stopping generation.");
}

function generateAndSendChunk() {
    if (!isRunning) return;

    const chunkDurationSeconds = BEAT_DURATION_SECONDS;
    const chunkSampleLength = Math.floor(chunkDurationSeconds * sampleRate);
    const outputBuffer = new Float32Array(chunkSampleLength).fill(0);

    // Decide which pattern to use
    const barNumber = Math.floor(totalBeatsGenerated / 4);
    const currentPattern = (barNumber % 4 === 3) ? drumPatternB : drumPatternA;
    const beatInBar = totalBeatsGenerated % 16;
    
    // Drums
    if (drumsEnabled && loadedSamples.snare) {
        const drumSteps = currentPattern[totalBeatsGenerated % currentPattern.length];
        drumSteps.forEach(step => {
            if (loadedSamples[step.sample]) {
                const sample = loadedSamples[step.sample];
                const startSample = Math.floor(step.time * chunkSampleLength);
                // Simple mix, potential for clipping if many samples overlap
                for (let i = 0; i < sample.length && startSample + i < chunkSampleLength; i++) {
                    outputBuffer[startSample + i] += sample[i] * 0.5; // Mix at 50% volume
                }
            }
        });
    }

    // Simple placeholder for instruments
    const random = () => Math.random(); // In a real scenario, use a seeded RNG
    
    // Bass
    if (instruments.bass !== 'none') {
        const bassNotes = generateSimpleBass(random);
        // This part needs a simple synth to convert MIDI notes to audio
    }
    
    // Accompaniment
    if (instruments.accompaniment !== 'none') {
        const accompNotes = generateSimpleAccompaniment(random);
        // This part needs a simple synth
    }
    
    // Solo
    if (instruments.solo !== 'none') {
        const soloNotes = generateSimpleSolo(random);
        // This part needs a simple synth
    }

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: outputBuffer,
            duration: chunkDurationSeconds
        }
    }, [outputBuffer.buffer]);

    totalBeatsGenerated++;
    
    // Schedule the next chunk
    setTimeout(generateAndSendChunk, chunkDurationSeconds * 1000 * 0.9); // Schedule slightly ahead
}

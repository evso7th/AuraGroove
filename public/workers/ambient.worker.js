
"use strict";

const CHUNK_DURATION = 2.0; // seconds

// --- State Management ---
let state = {};
let samples = {};

function resetState() {
  state = {
    isRunning: false,
    instruments: { solo: "none", accompaniment: "none", bass: "none" },
    drumsEnabled: true,
    sampleRate: 44100,
    lastTickTime: 0,
    barCount: 0,
  };
}

// Initialize state on script load
resetState();

// --- Music Generation ---

function generateBassPart(buffer, { sampleRate, instruments }) {
  if (instruments.bass !== "bass guitar") return;
  // This is a placeholder for a real bass line generation.
  // For now, it's a simple sine wave to represent the bass.
  const frequency = 55.0; // A1
  for (let i = 0; i < buffer.length; i++) {
    const time = i / sampleRate;
    const sampleValue = Math.sin(2 * Math.PI * frequency * time) * 0.4;
    buffer[i] += sampleValue; // Add to buffer
  }
}

function generateDrumPart(buffer, { sampleRate, barCount, drumsEnabled }) {
  if (!drumsEnabled || Object.keys(samples).length === 0) return;

  const tempo = 120;
  const beatsPerBar = 4;
  const barDuration = (60 / tempo) * beatsPerBar;
  const totalSamples = buffer.length;

  const drumPattern = [
    { sound: "kick", time: 0.0, velocity: 0.8 },
    { sound: "hat", time: 0.0, velocity: 0.6 },
    { sound: "snare", time: 0.5, velocity: 1.0 },
    { sound: "hat", time: 0.5, velocity: 0.4 },
  ];

  // Add ride cymbal on every beat in most bars
  if (barCount % 4 !== 0) {
    drumPattern.push({ sound: "ride", time: 0.0, velocity: 0.5 });
    drumPattern.push({ sound: "ride", time: 0.25, velocity: 0.5 });
    drumPattern.push({ sound: "ride", time: 0.5, velocity: 0.5 });
    drumPattern.push({ sound: "ride", time: 0.75, velocity: 0.5 });
  }

  // Add crash cymbal on the first beat of every 4th bar
  if (barCount % 4 === 0) {
    drumPattern.push({ sound: "crash", time: 0.0, velocity: 0.9 });
  }

  for (const hit of drumPattern) {
    const sample = samples[hit.sound];
    if (!sample) continue;

    const startSampleIndex = Math.floor(
      (hit.time * barDuration * sampleRate * (CHUNK_DURATION / barDuration))
    );
    
    // Check if the sample fits
    if (startSampleIndex + sample.length > totalSamples) {
      // If the main sample doesn't fit, try a shorter one.
      const shortSample = samples['hat'];
      if (shortSample && startSampleIndex + shortSample.length <= totalSamples) {
         for (let i = 0; i < shortSample.length; i++) {
            buffer[startSampleIndex + i] += shortSample[i] * (hit.velocity * 0.5);
        }
      }
      // If even the short sample doesn't fit, skip it.
      continue;
    }

    // Mix the sample into the buffer
    for (let i = 0; i < sample.length; i++) {
      buffer[startSampleIndex + i] += sample[i] * hit.velocity;
    }
  }
}

// --- Main Generator Loop ---

function runGenerator() {
  if (!state.isRunning) return;

  const now = self.performance.now() / 1000;
  if (now < state.lastTickTime + CHUNK_DURATION) {
    // Not time for the next chunk yet
    requestAnimationFrame(runGenerator);
    return;
  }
  
  const bufferSize = Math.floor(CHUNK_DURATION * state.sampleRate);
  const audioChunk = new Float32Array(bufferSize).fill(0);

  // --- Generate audio for each part ---
  generateBassPart(audioChunk, state);
  generateDrumPart(audioChunk, state);
  // Future instrument parts would be called here

  // --- Post chunk and schedule next run ---
  self.postMessage({
    type: 'chunk',
    data: {
      chunk: audioChunk,
      duration: CHUNK_DURATION,
    },
  }, [audioChunk.buffer]);

  state.barCount++;
  state.lastTickTime += CHUNK_DURATION;

  requestAnimationFrame(runGenerator);
}

function startGenerator(data) {
  if (state.isRunning) return;
  
  resetState(); // Ensure clean state before starting

  state.instruments = data.instruments;
  state.drumsEnabled = data.drumsEnabled;
  state.sampleRate = data.sampleRate;
  state.isRunning = true;
  state.lastTickTime = self.performance.now() / 1000;
  
  console.log("Worker starting generation with state:", state);
  runGenerator();
}

function stopGenerator() {
    state.isRunning = false;
    resetState(); // Reset state on stop
    console.log("Worker stopped and state reset.");
}

// --- Worker Message Handler ---

self.onmessage = (event) => {
  const { command, data } = event.data;

  switch (command) {
    case 'load_samples':
      samples = data;
      self.postMessage({ type: 'samples_loaded' });
      break;
    case 'start':
      startGenerator(data);
      break;
    case 'stop':
      stopGenerator();
      break;
    case 'set_instruments':
      state.instruments = data;
      break;
    case 'toggle_drums':
      state.drumsEnabled = data.enabled;
      break;
    default:
      self.postMessage({
        type: 'error',
        error: `Unknown command: ${command}`,
      });
  }
};

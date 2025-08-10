
"use strict";

let state = {};
let generatorInterval = null;

const SAMPLES_PER_CHUNK = 8192; // A small buffer size for low latency

function resetState() {
  console.log("Resetting worker state");
  state = {
    sampleRate: 44100,
    isRunning: false,
    instruments: {
      solo: "none",
      accompaniment: "none",
      bass: "bass guitar",
    },
    drumsEnabled: true,
    samples: {}, // To store raw audio data for drums
    
    // Time and rhythm state
    barCount: 0,
    lastTickTime: 0,
    tickCount: 0,
    tempo: 100, // bpm
    
    // Part-specific states
    bassNote: 'E1', // Starting bass note
    lastChordTime: 0,
    
    // Internal buffer state
    generatorBuffer: new Float32Array(SAMPLES_PER_CHUNK),
    bufferPosition: 0,
  };
}

// Simple synth functions (will be replaced with more complex generation)
function generateSineWave(freq, duration, sampleRate) {
    const buffer = new Float32Array(Math.floor(duration * sampleRate));
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * freq * (i / sampleRate));
    }
    return buffer;
}

function generateBassPart(chunkDuration) {
    if (state.instruments.bass === 'none') {
        return new Float32Array(SAMPLES_PER_CHUNK);
    }
    
    const noteDuration = 4 * 60 / state.tempo; // One note per bar
    const bassBuffer = new Float32Array(SAMPLES_PER_CHUNK);
    
    // This is a placeholder. A real implementation would be more complex.
    const freq = state.bassNote === 'E1' ? 41.20 : 55.00; // Simple E1 or A1
    
    const samplesInNote = Math.floor(noteDuration * state.sampleRate);
    for (let i = 0; i < SAMPLES_PER_CHUNK; i++) {
      const time = state.lastTickTime + (i / state.sampleRate);
      if (time - state.lastChordTime < noteDuration) {
          bassBuffer[i] = Math.sin(2 * Math.PI * freq * (time - state.lastChordTime)) * 0.4;
          // Fade out last 500 samples
           if (i > samplesInNote - 500) {
               bassBuffer[i] *= (samplesInNote - i) / 500;
           }
      }
    }
    
    // Change note every bar
    const barLengthInSeconds = 4 * 60 / state.tempo;
    if (state.lastTickTime + chunkDuration - state.lastChordTime >= barLengthInSeconds) {
       state.bassNote = state.bassNote === 'E1' ? 'A1' : 'E1';
       state.lastChordTime += barLengthInSeconds;
    }

    return bassBuffer;
}


function generateDrumPart(chunkDuration) {
  if (!state.drumsEnabled || Object.keys(state.samples).length === 0) {
    return new Float32Array(SAMPLES_PER_CHUNK);
  }

  const drumBuffer = new Float32Array(SAMPLES_PER_CHUNK);
  const beatsPerSecond = state.tempo / 60;
  const samplesPerBeat = state.sampleRate / beatsPerSecond;

  const drumPattern = [
    { sound: "kick", time: 0.0, velocity: 0.8 },
    { sound: "hat", time: 0.0, velocity: 0.6 },
    { sound: "hat", time: 0.25, velocity: 0.3 },
    { sound: "snare", time: 0.5, velocity: 1.0 },
    { sound: "hat", time: 0.5, velocity: 0.6 },
    { sound: "hat", time: 0.75, velocity: 0.3 },
  ];
  
  // Add Ride or Crash based on bar count
  if (state.barCount % 4 === 0) {
      drumPattern.push({ sound: 'crash', time: 0.0, velocity: 0.7 });
  } else {
      drumPattern.push({ sound: 'ride', time: 0.0, velocity: 0.5 });
      drumPattern.push({ sound: 'ride', time: 0.25, velocity: 0.2 });
      drumPattern.push({ sound: 'ride', time: 0.5, velocity: 0.5 });
      drumPattern.push({ sound: 'ride', time: 0.75, velocity: 0.2 });
  }

  const barDurationInSamples = 4 * samplesPerBeat;

  for (let i = 0; i < SAMPLES_PER_CHUNK; i++) {
    const currentSampleInBar = (state.tickCount + i) % barDurationInSamples;
    const timeInBar = currentSampleInBar / samplesPerBeat; // Time in beats

    for (const hit of drumPattern) {
      if (Math.abs(timeInBar - hit.time) < 0.001) { // Check if it's time for a hit
        const sample = state.samples[hit.sound];
        if (!sample) continue;

        const startSample = i;
        const endSample = startSample + sample.length;

        if (endSample > SAMPLES_PER_CHUNK) {
          // If the sample doesn't fit, skip it to prevent errors.
          // A more robust solution might fade it out or use a shorter sample.
          continue;
        }

        // Mix the drum sample into the buffer
        for (let j = 0; j < sample.length; j++) {
          if (startSample + j < SAMPLES_PER_CHUNK) {
            drumBuffer[startSample + j] += sample[j] * hit.velocity;
          }
        }
      }
    }
  }

  return drumBuffer;
}


function runGenerator() {
    const chunkDuration = SAMPLES_PER_CHUNK / state.sampleRate;

    // Generate parts
    const drumPart = generateDrumPart(chunkDuration);
    const bassPart = generateBassPart(chunkDuration);
    // Other instruments would be generated here

    const finalChunk = new Float32Array(SAMPLES_PER_CHUNK);

    // Mix parts
    for (let i = 0; i < SAMPLES_PER_CHUNK; i++) {
        const mix = (drumPart[i] || 0) + (bassPart[i] || 0);
        finalChunk[i] = Math.max(-1, Math.min(1, mix)); // Basic clipping
    }
    
    self.postMessage({
        type: 'chunk',
        data: {
            chunk: finalChunk,
            duration: chunkDuration
        }
    }, [finalChunk.buffer]);
    
    // --- Update State ---
    state.tickCount += SAMPLES_PER_CHUNK;

    const barLengthInSamples = 4 * (state.sampleRate / (state.tempo / 60));
    if (state.tickCount > (state.barCount + 1) * barLengthInSamples) {
      state.barCount++;
       console.log(`Bar: ${state.barCount}`);
    }
    state.lastTickTime += chunkDuration;
}

function startGenerator() {
  if (state.isRunning || generatorInterval !== null) {
    console.log("Generator is already running.");
    return;
  }
  console.log("Starting generator...");
  state.isRunning = true;
  
  const intervalTime = (SAMPLES_PER_CHUNK / state.sampleRate) * 1000 * 0.95; // Run slightly faster to stay ahead

  generatorInterval = setInterval(runGenerator, intervalTime);
}

function stopGenerator() {
  if (!state.isRunning || generatorInterval === null) return;
  console.log("Stopping generator...");
  clearInterval(generatorInterval);
  generatorInterval = null;
  state.isRunning = false;
  resetState(); // Reset state on stop
}


self.onmessage = function (e) {
  const { command, data } = e.data;

  switch (command) {
    case 'load_samples':
      resetState();
      state.samples = data;
      self.postMessage({ type: 'samples_loaded' });
      break;
    case 'start':
      if (state.isRunning) return;
      // Do not reset here, reset is handled on stop and load.
      state.instruments = data.instruments;
      state.drumsEnabled = data.drumsEnabled;
      state.sampleRate = data.sampleRate || 44100;
      state.lastTickTime = 0;
      state.lastChordTime = 0;
      state.tickCount = 0;
      state.barCount = 0;
      startGenerator();
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
  }
};

// Initialize state on worker load
resetState();

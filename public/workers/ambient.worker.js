
// AuraGroove Ambient Music Worker
// This worker is responsible for generating and scheduling all music parts.

"use strict";

// --- State ---
let sampleRate = 44100;
let samples = {};
let isPlaying = false;
let instruments = {};
let drumsEnabled = true;
let tick = 0;
let scheduleTimeoutId = null;

// --- Rhythm Generation ---
const tempoBPM = 60;
const beatsPerBar = 4;
const subdivisions = 4; // 16th notes
const ticksPerBeat = subdivisions;
const ticksPerBar = ticksPerBeat * beatsPerBar;
const secondsPerTick = 60.0 / tempoBPM / ticksPerBeat;
const chunkSizeSeconds = 0.5; // Generate audio in chunks
const chunkSizeTicks = Math.ceil(chunkSizeSeconds / secondsPerTick);

// --- Sample Processing ---
function applyGain(buffer, gain) {
    if (gain === 1.0) return buffer;
    const newBuffer = new Float32Array(buffer.length);
    for (let i = 0; i < buffer.length; i++) {
        newBuffer[i] = buffer[i] * gain;
    }
    return newBuffer;
}

function applyEnvelope(buffer) {
    const newBuffer = new Float32Array(buffer.length);
    const length = buffer.length;
    for (let i = 0; i < length; i++) {
        const gain = 1.0 - (i / length); // Linear fade out
        newBuffer[i] = buffer[i] * gain;
    }
    return newBuffer;
}


// --- Music Generation ---

const drumPatterns = {
    kick: {
      sample: 'kick',
      pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      gain: 0.5,
      skipFirst: true,
    },
    snare: {
      sample: 'snare',
      pattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      gain: 1.0,
    },
    hat: {
      sample: 'hat',
      pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
      gain: 0.8,
    },
    crash: {
        sample: 'crash',
        pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        gain: 0.9,
        ticksPerBarOverride: ticksPerBar * 4, // Once every 4 bars
        useEnvelope: true,
    },
    ride: {
        sample: 'ride',
        pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        gain: 1.0,
    }
};

function generateMusicChunk(startTick, numTicks) {
    const chunkDuration = numTicks * secondsPerTick;
    const bufferSize = Math.floor(sampleRate * chunkDuration);
    const mainBuffer = new Float32Array(bufferSize).fill(0);

    if (drumsEnabled) {
        for (const [key, def] of Object.entries(drumPatterns)) {
            const sampleBuffer = def.useEnvelope ? applyEnvelope(samples[def.sample]) : samples[def.sample];
            if (!sampleBuffer) continue;

            const processedSample = applyGain(sampleBuffer, def.gain);
            const patternLength = def.ticksPerBarOverride || ticksPerBar;

            for (let i = 0; i < numTicks; i++) {
                const currentTick = startTick + i;
                const patternIndex = currentTick % patternLength;
                
                if (def.skipFirst && currentTick === 0) {
                    continue;
                }

                if (def.pattern[patternIndex % def.pattern.length] === 1) {
                    const offset = Math.floor(i * secondsPerTick * sampleRate);
                    for (let j = 0; j < processedSample.length; j++) {
                        if (offset + j < mainBuffer.length) {
                            mainBuffer[offset + j] += processedSample[j];
                        }
                    }
                }
            }
        }
    }
    
    // Normalize buffer to prevent clipping
    let maxAmplitude = 0;
    for(let i=0; i<mainBuffer.length; i++) {
        maxAmplitude = Math.max(maxAmplitude, Math.abs(mainBuffer[i]));
    }
    if (maxAmplitude > 1.0) {
        for(let i=0; i<mainBuffer.length; i++) {
            mainBuffer[i] /= maxAmplitude;
        }
    }

    return mainBuffer;
}


// --- Worker Control ---

function scheduleNextChunk() {
  if (!isPlaying) {
    return;
  }

  const chunk = generateMusicChunk(tick, chunkSizeTicks);

  self.postMessage({
    type: 'chunk',
    data: {
      chunk: chunk,
      duration: chunkSizeSeconds,
    },
  }, [chunk.buffer]);

  tick += chunkSizeTicks;

  const timeToNextChunk = chunkSizeSeconds * 1000 - 100; // schedule a bit ahead
  scheduleTimeoutId = setTimeout(scheduleNextChunk, Math.max(50, timeToNextChunk));
}

self.onmessage = (event) => {
  const { command, data } = event.data;

  switch (command) {
    case 'load_samples':
      samples = data;
      self.postMessage({ type: 'samples_loaded' });
      break;
    case 'start':
      if (isPlaying) return;
      isPlaying = true;
      tick = 0;
      instruments = data.instruments;
      drumsEnabled = data.drumsEnabled;
      sampleRate = data.sampleRate;
      scheduleNextChunk();
      break;
    case 'stop':
      isPlaying = false;
      if (scheduleTimeoutId) {
        clearTimeout(scheduleTimeoutId);
        scheduleTimeoutId = null;
      }
      tick = 0;
      break;
    case 'set_instruments':
      instruments = data;
      break;
    case 'toggle_drums':
      drumsEnabled = data.enabled;
      break;
    default:
      self.postMessage({
        type: 'error',
        error: `Unknown command: ${command}`,
      });
  }
};

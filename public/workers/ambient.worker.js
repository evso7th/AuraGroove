
"use strict";

// --- State Management ---
let state = {};
const BPM = 100;
const CHUNK_DURATION_SECONDS = 1.5;

function resetState() {
  state = {
    sampleRate: 44100,
    samples: {},
    instruments: {
      solo: "none",
      accompaniment: "none",
      bass: "bass guitar",
    },
    drumsEnabled: true,
    isPlaying: false,
    intervalId: null,
    
    // Time and rhythm tracking
    totalTime: 0,
    barCount: 0,
    lastTick: 0,

    // Part generators
    bassPart: [],
    soloPart: [],
    accompPart: [],
  };
}

// --- Pattern Definition (The "Sheet Music") ---
const drumPatterns = {
  // A measure is 4 beats. At 100 BPM, one beat is 0.6 seconds. A measure is 2.4s.
  // Our chunk is 1.5s, so we'll have patterns that span across chunks.
  main: [
    // Time is within a 4-beat measure.
    { sample: 'kick', time: 0, velocity: 0.9 },
    { sample: 'hat', time: 0, velocity: 0.5 },
    { sample: 'hat', time: 0.5, velocity: 0.3 }, // Ghost note
    { sample: 'snare', time: 1, velocity: 1.0 },
    { sample: 'hat', time: 1, velocity: 0.5 },
    { sample: 'hat', time: 1.5, velocity: 0.3 }, // Ghost note
    { sample: 'kick', time: 2, velocity: 0.9 },
    { sample: 'hat', time: 2, velocity: 0.5 },
    { sample: 'hat', time: 2.5, velocity: 0.3 }, // Ghost note
    { sample: 'snare', time: 3, velocity: 1.0 },
    { sample: 'hat', time: 3, velocity: 0.5 },
    { sample: 'hat', time: 3.5, velocity: 0.3 }, // Ghost note
  ],
  getFillPattern: (barCount) => {
    // Every 4th bar has a crash
    if (barCount > 0 && barCount % 4 === 0) {
      return [{ sample: 'crash', time: 0, velocity: 0.8 }];
    }
    // Every other bar has a ride
    if (barCount > 0 && barCount % 2 === 0) {
        return [
            { sample: 'ride', time: 0, velocity: 0.6 },
            { sample: 'ride', time: 1, velocity: 0.6 },
            { sample: 'ride', time: 2, velocity: 0.6 },
            { sample: 'ride', time: 3, velocity: 0.6 },
        ];
    }
    return [];
  }
};


// --- Generator (The "Musician") ---

function generateDrums(chunkBuffer, startTime, endTime) {
  if (!state.drumsEnabled) return;

  const beatsPerSecond = BPM / 60;
  const measureDuration = 4 / beatsPerSecond; // 4 beats per measure

  let currentGlobalTime = startTime;

  while (currentGlobalTime < endTime) {
    const timeInMeasure = state.totalTime % measureDuration;
    const currentMeasureIndex = Math.floor(state.totalTime / measureDuration);
    
    // Main pattern
    for (const hit of drumPatterns.main) {
      const hitTimeInMeasure = hit.time / beatsPerSecond;
      if (hitTimeInMeasure >= timeInMeasure && hitTimeInMeasure < (timeInMeasure + (endTime - currentGlobalTime))) {
        const timeInChunk = hitTimeInMeasure - timeInMeasure;
        renderSample(chunkBuffer, hit.sample, timeInChunk, hit.velocity);
      }
    }

    // Fill pattern (Crash/Ride)
    const fillPattern = drumPatterns.getFillPattern(currentMeasureIndex);
     for (const hit of fillPattern) {
        const hitTimeInMeasure = hit.time / beatsPerSecond;
        if (hitTimeInMeasure >= timeInMeasure && hitTimeInMeasure < (timeInMeasure + (endTime - currentGlobalTime))) {
            const timeInChunk = hitTimeInMeasure - timeInMeasure;
            renderSample(chunkBuffer, hit.sample, timeInChunk, hit.velocity);
        }
    }

    const timeToAdvance = endTime - currentGlobalTime;
    state.totalTime += timeToAdvance;
    currentGlobalTime = endTime;
  }
}

/**
 * Renders a single sample into the output buffer.
 * This is the core audio processing function.
 */
function renderSample(outputBuffer, sampleName, timeInChunk, velocity) {
  const sample = state.samples[sampleName];
  if (!sample) return;

  const startFrame = Math.floor(timeInChunk * state.sampleRate);
  const endFrame = startFrame + sample.length;

  // This check prevents the "RangeError"
  if (endFrame > outputBuffer.length) {
    // If it doesn't fit, we just don't play it. No clipping, no errors.
    return;
  }

  for (let i = 0; i < sample.length; i++) {
    // Mix, not overwrite, by adding the samples together.
    outputBuffer[startFrame + i] += sample[i] * velocity;
  }
}

// This function will generate the next block of audio data.
function generateNextChunk() {
  const chunkFrameCount = Math.floor(CHUNK_DURATION_SECONDS * state.sampleRate);
  const chunkBuffer = new Float32Array(chunkFrameCount).fill(0);

  // --- Generate Parts ---
  // In a real scenario, you'd have similar pattern-based generators for bass, solo, etc.
  // For now, we focus on making the drums robust.
  generateDrums(chunkBuffer, state.totalTime, state.totalTime + CHUNK_DURATION_SECONDS);

  // --- Post a transferable message back to the main thread ---
  self.postMessage({
    type: 'chunk',
    data: {
      chunk: chunkBuffer,
      duration: CHUNK_DURATION_SECONDS
    }
  }, [chunkBuffer.buffer]);
}


// --- Command Handlers (The "Conductor") ---
function startGenerator() {
  if (state.isPlaying) return;
  
  // Reset state ONCE before starting.
  resetState(); 
  state.isPlaying = true;
  
  // This ensures generation starts immediately, then intervals.
  generateNextChunk(); 
  state.intervalId = setInterval(generateNextChunk, CHUNK_DURATION_SECONDS * 1000);
}

function stopGenerator() {
  if (!state.isPlaying) return;
  state.isPlaying = false;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  // Reset state on stop to be clean for the next run.
  resetState();
}

// --- Message Listener (The "Mailbox") ---
self.onmessage = (event) => {
  const { command, data } = event.data;

  switch (command) {
    case 'load_samples':
      state.samples = data;
      self.postMessage({ type: 'samples_loaded' });
      break;

    case 'start':
      if (data) {
          state.instruments = data.instruments;
          state.drumsEnabled = data.drumsEnabled;
          state.sampleRate = data.sampleRate;
      }
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
      
    default:
      self.postMessage({ type: 'error', error: 'Unknown command' });
  }
};

// Initialize state when worker loads
resetState();

    
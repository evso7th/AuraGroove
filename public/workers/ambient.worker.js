
// public/workers/ambient.worker.js

// --- State ---
let isRunning = false;
let sampleRate = 44100; // Default, will be updated from main thread
const CHUNK_DURATION_SECONDS = 2; // Generate 2 seconds of audio at a time
let instruments = {
  solo: 'none',
  accompaniment: 'none',
  bass: 'bass guitar',
};
let drumsEnabled = true;
let barCount = 0; // Track bars for musical progression

// --- Audio Data ---
// This will hold the raw Float32Array data for each sample
const samples = {};

// --- Synthesis Functions ---

function generateSineWave(frequency, duration) {
  const numSamples = Math.floor(duration * sampleRate);
  const buffer = new Float32Array(numSamples);
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate));
  }
  return buffer;
}

function applyADSR(buffer, adsr) {
  const { attack, decay, sustain, release } = adsr;
  const numSamples = buffer.length;
  const attackSamples = Math.floor(attack * sampleRate);
  const decaySamples = Math.floor(decay * sampleRate);
  const releaseSamples = Math.floor(release * sampleRate);
  const sustainSamples = numSamples - attackSamples - decaySamples - releaseSamples;

  // Attack
  for (let i = 0; i < attackSamples && i < numSamples; i++) {
    buffer[i] *= i / attackSamples;
  }
  // Decay
  for (let i = 0; i < decaySamples && i < numSamples; i++) {
    const t = i / decaySamples;
    buffer[attackSamples + i] *= (1.0 - t) + (t * sustain);
  }
  // Sustain part is already at the right level
  // Release
  if (sustainSamples + releaseSamples > 0) {
      for (let i = 0; i < releaseSamples && (numSamples - releaseSamples + i) < numSamples ; i++) {
          const frame = numSamples - releaseSamples + i;
          buffer[frame] *= (1.0 - (i / releaseSamples)) * sustain;
      }
  }
  return buffer;
}

function generateBassPart(totalSamples) {
  const buffer = new Float32Array(totalSamples).fill(0);
  if (instruments.bass === 'none') return buffer;

  // Simple repeating bass line (E1 note)
  const noteFrequency = 41.20; // E1
  const noteDuration = CHUNK_DURATION_SECONDS / 4; // quarter note
  const adsr = { attack: 0.01, decay: 0.1, sustain: 0.8, release: 0.2 };

  for (let i = 0; i < 4; i++) {
    const noteBuffer = generateSineWave(noteFrequency, noteDuration);
    applyADSR(noteBuffer, adsr);

    const startSample = Math.floor(i * noteDuration * sampleRate);
    buffer.set(noteBuffer, startSample);
  }

  return buffer;
}

function generateAccompanimentPart(totalSamples) {
    const buffer = new Float32Array(totalSamples).fill(0);
    if (instruments.accompaniment === 'none') return buffer;
    // Placeholder for accompaniment generation
    return buffer;
}

function generateSoloPart(totalSamples) {
    const buffer = new Float32Array(totalSamples).fill(0);
    if (instruments.solo === 'none') return buffer;
    // Placeholder for solo generation
    return buffer;
}

function generateDrumPart(totalSamples, currentBar) {
    const buffer = new Float32Array(totalSamples).fill(0);
    if (!drumsEnabled) return buffer;

    const drumPattern = [
        { sample: 'kick', time: 0, velocity: 0.8 },
        { sample: 'hat', time: 0, velocity: 0.6 },
        { sample: 'hat', time: 0.25, velocity: 0.4 },
        { sample: 'snare', time: 0.5, velocity: 1.0 },
        { sample: 'hat', time: 0.5, velocity: 0.6 },
        { sample: 'hat', time: 0.75, velocity: 0.4 },
    ];
    
    // Add Ride on every beat
    if (samples.ride) {
       for(let i = 0; i < 4; i++) {
           drumPattern.push({ sample: 'ride', time: i * 0.25, velocity: 0.3 });
       }
    }

    // Add Crash on the first beat of every 4th bar
    if (currentBar % 4 === 0 && samples.crash) {
        drumPattern.push({ sample: 'crash', time: 0, velocity: 0.7 });
    }


    for (const hit of drumPattern) {
        let sampleData = samples[hit.sample];
        if (!sampleData) continue;

        const startSample = Math.floor(hit.time * totalSamples);

        // Check if the sample fits
        if (startSample + sampleData.length > totalSamples) {
            // If the primary sample doesn't fit, try replacing it with a shorter one (hat)
            const fallbackSample = samples['hat'];
            if (fallbackSample && startSample + fallbackSample.length <= totalSamples) {
                 sampleData = fallbackSample;
            } else {
                // If even the fallback doesn't fit, skip this hit
                continue;
            }
        }
        
        // Mix the sample into the buffer
        for (let i = 0; i < sampleData.length; i++) {
            // Ensure we don't write past the end of the main buffer
            if (startSample + i < buffer.length) {
                buffer[startSample + i] += sampleData[i] * hit.velocity;
            }
        }
    }

    return buffer;
}


// --- Main Worker Logic ---

self.onmessage = (event) => {
  const { command, data } = event.data;

  switch (command) {
    case 'load_samples':
      // Copy data from message to our local state
      for (const key in data) {
        samples[key] = data[key];
      }
      self.postMessage({ type: 'samples_loaded' });
      break;
    case 'start':
      if (isRunning) return;
      sampleRate = data.sampleRate;
      instruments = data.instruments;
      drumsEnabled = data.drumsEnabled;
      barCount = 0; // Reset bar count on start
      startGenerator();
      break;
    case 'stop':
      stopGenerator();
      break;
    case 'set_instruments':
        instruments = data;
        break;
    case 'toggle_drums':
        drumsEnabled = data.enabled;
        break;
  }
};

function startGenerator() {
  isRunning = true;
  runGenerator();
}

function stopGenerator() {
  isRunning = false;
}

function mixBuffers(bufferA, bufferB, weightB = 1.0) {
    const length = Math.min(bufferA.length, bufferB.length);
    const mixed = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        mixed[i] = bufferA[i] + (bufferB[i] * weightB);
    }
    return mixed;
}

function normalizeBuffer(buffer, targetPeak = 0.9) {
    let max = 0;
    for (let i = 0; i < buffer.length; i++) {
        max = Math.max(max, Math.abs(buffer[i]));
    }
    if (max > targetPeak) {
        const gain = targetPeak / max;
        for (let i = 0; i < buffer.length; i++) {
            buffer[i] *= gain;
        }
    }
    return buffer;
}

function runGenerator() {
  if (!isRunning) return;

  const duration = CHUNK_DURATION_SECONDS;
  const totalSamples = Math.floor(duration * sampleRate);

  // Generate parts
  const bassPart = generateBassPart(totalSamples);
  const accompanimentPart = generateAccompanimentPart(totalSamples);
  const soloPart = generateSoloPart(totalSamples);
  const drumPart = generateDrumPart(totalSamples, barCount);
  
  // Mix parts
  let finalMix = mixBuffers(bassPart, accompanimentPart);
  finalMix = mixBuffers(finalMix, soloPart);
  finalMix = mixBuffers(finalMix, drumPart, 0.5); // Mix drums at 50% volume

  // Normalize
  finalMix = normalizeBuffer(finalMix);
  
  // Send chunk to main thread
  // The second argument is a list of transferable objects.
  // This transfers ownership of the underlying ArrayBuffer instead of copying, which is much faster.
  self.postMessage({ type: 'chunk', data: { chunk: finalMix, duration } }, [finalMix.buffer]);
  
  barCount++;
  
  // Schedule next chunk
  setTimeout(runGenerator, duration * 1000);
}

// public/workers/ambient.worker.js

import {
  generateSimpleSolo,
  generateSimpleAccompaniment,
  generateSimpleBass,
  drumPatternA,
  drumPatternB,
  BEATS_PER_BAR,
} from '/lib/fractal-music-generator.js';


// --- State ---
let isRunning = false;
let sampleRate = 44100;
let instruments = {};
let drumsEnabled = true;
let samples = {};
let tempo = 120.0;
let sixteenthNoteDuration;
let currentBar = 0;


// --- Synthesis (Simple Oscillators) ---
// We generate raw audio frames here, no complex synth engines.

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function createOscillator(type = 'sine') {
  let phase = 0;
  return (freq, amp, duration) => {
    const buffer = new Float32Array(Math.floor(duration * sampleRate));
    const increment = (2 * Math.PI * freq) / sampleRate;
    for (let i = 0; i < buffer.length; i++) {
      if (type === 'sine') {
        buffer[i] = Math.sin(phase) * amp;
      } else if (type === 'sawtooth') {
         buffer[i] = ((phase / Math.PI) - 1) * amp;
      } else if (type === 'square') {
         buffer[i] = Math.sign(Math.sin(phase)) * amp;
      }
      phase += increment;
      if (phase > 2 * Math.PI) phase -= 2 * Math.PI;
    }
    return buffer;
  };
}

const synths = {
  synthesizer: createOscillator('sawtooth'),
  piano: createOscillator('square'), // Placeholder sound
  organ: createOscillator('sine'), // Placeholder sound
  'bass guitar': createOscillator('sine'),
};

function applyEnvelope(buffer) {
    const attackTime = 0.01 * sampleRate;
    const decayTime = 0.1 * sampleRate;
    const sustainLevel = 0.7;
    const releaseTime = 0.2 * sampleRate;

    for (let i = 0; i < buffer.length; i++) {
        const t = i / buffer.length;
        let amp = 0;
        if (i < attackTime) {
            amp = i / attackTime;
        } else if (i < attackTime + decayTime) {
            amp = 1.0 - (1.0 - sustainLevel) * ((i - attackTime) / decayTime);
        } else if (i < buffer.length - releaseTime) {
            amp = sustainLevel;
        } else {
            amp = sustainLevel * (1.0 - ((i - (buffer.length - releaseTime)) / releaseTime));
        }
        buffer[i] *= amp;
    }
    return buffer;
}


// --- Music Generation ---

// Simple pseudo-random number generator for deterministic sequences
function lcg(seed) {
  return () => (seed = (seed * 1664525 + 1013904223) & 0x7fffffff) / 0x7fffffff;
}
let random = lcg(1);

function generatePart(part, noteGenerator) {
    const instrument = instruments[part];
    if (instrument === 'none' || !synths[instrument]) {
        return new Float32Array(Math.floor(sixteenthNoteDuration * sampleRate)).fill(0);
    }

    const notes = noteGenerator(random);
    if (notes.length === 0) {
        return new Float32Array(Math.floor(sixteenthNoteDuration * sampleRate)).fill(0);
    }
    
    let mixedBuffer = new Float32Array(Math.floor(sixteenthNoteDuration * sampleRate)).fill(0);

    notes.forEach(note => {
        const freq = midiToFreq(note);
        const synthFunc = synths[instrument];
        const noteBuffer = synthFunc(freq, 0.2, sixteenthNoteDuration);
        const envelopedBuffer = applyEnvelope(noteBuffer);
        for(let i = 0; i < mixedBuffer.length; i++) {
            mixedBuffer[i] += envelopedBuffer[i] || 0;
        }
    });

    return mixedBuffer;
}

function generateDrumPart() {
    let mixedBuffer = new Float32Array(Math.floor(sixteenthNoteDuration * sampleRate)).fill(0);
    if (!drumsEnabled || !samples.snare) {
        return mixedBuffer;
    }

    const barInLoop = currentBar % 4;
    const pattern = barInLoop === 3 ? drumPatternB : drumPatternA;

    const beatInBar = currentBar % BEATS_PER_BAR;
    const steps = pattern[beatInBar] || [];

    steps.forEach(step => {
        const sample = samples[step.sample];
        if (sample) {
            const start = Math.floor(step.time * sixteenthNoteDuration * sampleRate);
            for (let i = 0; i < sample.length && start + i < mixedBuffer.length; i++) {
                mixedBuffer[start + i] += sample[i] * 0.5; // Mix at 50% volume
            }
        }
    });
    
    return mixedBuffer;
}

function generateNextMusicChunk() {
  if (!isRunning) return;

  const soloPart = generatePart('solo', generateSimpleSolo);
  const accompanimentPart = generatePart('accompaniment', generateSimpleAccompaniment);
  const bassPart = generatePart('bass', generateSimpleBass);
  const drumPart = generateDrumPart();
  
  const finalMix = new Float32Array(soloPart.length);
  for (let i = 0; i < finalMix.length; i++) {
      finalMix[i] = (soloPart[i] + accompanimentPart[i] + bassPart[i] + drumPart[i]) / 4;
  }
  
  // Post chunk and schedule next one
  self.postMessage({ type: 'chunk', data: { chunk: finalMix, duration: sixteenthNoteDuration } });

  currentBar = (currentBar + 1) % (BEATS_PER_BAR * 4); // Loop a 4-bar sequence for patterns
  setTimeout(generateNextMusicChunk, sixteenthNoteDuration * 1000 * 0.9); // Schedule slightly ahead
}


function startGeneration(data) {
    if (isRunning) return;
    
    instruments = data.instruments;
    drumsEnabled = data.drumsEnabled;
    sampleRate = data.sampleRate;
    sixteenthNoteDuration = 60.0 / tempo / 4;
    random = lcg(Date.now()); // Re-seed random number generator
    currentBar = 0;
    
    isRunning = true;
    self.postMessage({ type: 'generation_started' });
    generateNextMusicChunk();
}

// --- Worker Event Listener ---

self.onmessage = (event) => {
  const { command, data } = event.data;

  switch (command) {
    case 'start':
      startGeneration(data);
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
    case 'load_samples':
      // Assuming data is { snare: Float32Array, ... }
      samples = data;
      // Let's create some placeholder samples for now
      if (!samples.kick) samples.kick = samples.snare;
      if (!samples.hat) samples.hat = samples.snare.map(s => s * 0.2); // quieter
      break;
  }
};

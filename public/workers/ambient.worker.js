
// A basic Web Worker for generating ambient music chunks.

let tick = 0;
let sampleRate = 44100;
let instruments = {};
let drumsEnabled = true;
let samples = {}; // This will hold the Float32Array sample data
let intervalId = null;

const tempoBPM = 60;
const beatsPerBar = 4;
const barDuration = (60 / tempoBPM) * beatsPerBar;
const chunkDuration = 0.2; // Generate audio in 200ms chunks

function applyGain(sample, gain) {
  if (gain === 1) return sample;
  const newSample = new Float32Array(sample.length);
  for (let i = 0; i < sample.length; i++) {
    newSample[i] = sample[i] * gain;
  }
  return newSample;
}

function applyFadeOut(sample) {
    const newSample = new Float32Array(sample.length);
    for (let i = 0; i < sample.length; i++) {
        const gain = 1 - (i / sample.length);
        newSample[i] = sample[i] * gain;
    }
    return newSample;
}


function generateMusicChunk() {
  const chunkSize = Math.floor(sampleRate * chunkDuration);
  const chunk = new Float32Array(chunkSize).fill(0);
  
  const currentTick = tick;
  tick += chunkDuration;

  if (!drumsEnabled) {
     self.postMessage({ type: 'chunk', data: { chunk, duration: chunkDuration } });
     return;
  }

  const beatsPerSecond = tempoBPM / 60;
  const sixteenthNoteDuration = 1 / (beatsPerSecond * 4);
  const timePerTick = chunkDuration;
  
  const drumPatterns = {
      kick: { sample: samples.kick, gain: 0.5, pattern: [0, 0.5] }, // On beats 1 and 3
      snare: { sample: samples.snare, gain: 1.0, pattern: [0.25, 0.75] }, // On beats 2 and 4
      hat: { sample: samples.hat, gain: 0.7, pattern: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875] }, // 8th notes
      ride: { sample: samples.ride, gain: 1.0, pattern: [0, 0.25, 0.5, 0.75] }, // Quarter notes
      crash: { sample: applyFadeOut(samples.crash), gain: 0.8, pattern: [0] }, // Beginning of a 4-bar loop
      tom1: { sample: samples.tom1, gain: 0.9, pattern: [0.75] },
      tom2: { sample: samples.tom2, gain: 0.9, pattern: [0.8125] },
      tom3: { sample: samples.tom3, gain: 0.9, pattern: [0.875] },
  };

  const timeWithinBar = (currentTick % barDuration) / barDuration;
  const currentBar = Math.floor(currentTick / barDuration);

  for (const [instrument, { sample, gain, pattern }] of Object.entries(drumPatterns)) {
    if (!sample) continue;

    let play = false;
    let patternDuration = 1; // 1 bar for most
    let timeInPattern = timeWithinBar;

    if (instrument === 'crash') {
        if (currentBar % 4 !== 0) continue;
    } else if (['tom1', 'tom2', 'tom3'].includes(instrument)) {
        if ((currentBar + 1) % 4 !== 0) continue; // Only on the 4th bar
    } else if (instrument === 'kick' && currentTick === 0) {
        continue;
    }

    for (const beat of pattern) {
      const scheduledTime = beat * patternDuration;
      const nextScheduledTime = scheduledTime + timePerTick;

      if (timeInPattern >= scheduledTime && timeInPattern < nextScheduledTime) {
        play = true;
        break;
      }
    }

    if (play) {
        const finalSample = applyGain(sample, gain);
        for (let i = 0; i < Math.min(chunk.length, finalSample.length); i++) {
            chunk[i] += finalSample[i];
        }
    }
  }

  self.postMessage({ type: 'chunk', data: { chunk, duration: chunkDuration } });
}


function scheduleNextChunk() {
  try {
    generateMusicChunk();
  } catch (error) {
    self.postMessage({ type: 'error', error: `Error in generator: ${error.message}`});
    stop();
  }
}

function start(data) {
  tick = 0;
  instruments = data.instruments;
  drumsEnabled = data.drumsEnabled;
  sampleRate = data.sampleRate || 44100;

  if (intervalId) clearInterval(intervalId);
  // Schedule the first chunk immediately, then set interval
  scheduleNextChunk();
  intervalId = setInterval(scheduleNextChunk, chunkDuration * 1000);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  tick = 0;
}

self.onmessage = function(e) {
  const { command, data } = e.data;
  switch (command) {
    case 'load_samples':
      samples = data;
      self.postMessage({ type: 'samples_loaded' });
      break;
    case 'start':
      start(data);
      break;
    case 'stop':
      stop();
      break;
    case 'set_instruments':
      instruments = data;
      break;
    case 'toggle_drums':
      drumsEnabled = data.enabled;
      break;
    default:
      console.warn(`Unknown command: ${command}`);
  }
};

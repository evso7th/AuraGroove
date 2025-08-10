// public/workers/ambient.worker.js

let audioSamples = {};
let sampleRate = 44100;
let tick = 0;
let isRunning = false;
let intervalId = null;
let instruments = {};
let drumsEnabled = true;

const CHUNK_DURATION_SECONDS = 0.5; // 0.5 seconds per chunk
const TICKS_PER_CHUNK = 8; // 16th notes at 120bpm
const SAMPLES_PER_CHUNK = CHUNK_DURATION_SECONDS * sampleRate;
const SAMPLES_PER_TICK = SAMPLES_PER_CHUNK / TICKS_PER_CHUNK;


// Function to apply a linear fade-out envelope to a sample
function applyFadeOut(buffer) {
  const newBuffer = new Float32Array(buffer);
  for (let i = 0; i < newBuffer.length; i++) {
    const gain = 1.0 - (i / newBuffer.length);
    newBuffer[i] *= gain;
  }
  return newBuffer;
}


const drumPatterns = {
  kick:   { pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], sample: 'kick', gain: 0.7 },
  snare:  { pattern: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0], sample: 'snare', gain: 1.0 },
  hat:    { pattern: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0], sample: 'hat', gain: 0.4 },
  ride:   { pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], sample: 'ride', gain: 1.0 },
  crash:  { pattern: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], sample: 'crash', gain: 0.8 },
};


function mixSamples(noteEvents, chunkBuffer) {
  noteEvents.forEach(note => {
    const sampleData = audioSamples[note.instrument];
    if (sampleData) {
      // Ensure the note's starting position is within the chunk buffer
      if (note.startSample < chunkBuffer.length) {
        for (let i = 0; i < sampleData.length; i++) {
          const bufferIndex = note.startSample + i;
          if (bufferIndex < chunkBuffer.length) {
            chunkBuffer[bufferIndex] += sampleData[i] * (note.gain || 1.0);
          }
        }
      }
    }
  });
}

function generateMusicChunk(startTick) {
  const beatsPerMeasure = 16; 
  const totalMeasuresForCrash = 4;
  const ticksPerCrash = beatsPerMeasure * totalMeasuresForCrash;

  const noteEvents = [];

  for (let i = 0; i < TICKS_PER_CHUNK; i++) {
    const currentTick = startTick + i;
    const step = currentTick % beatsPerMeasure;

    if (drumsEnabled) {
      // Kick
      if (drumPatterns.kick.pattern[step] === 1) {
        // Skip the very first kick drum hit
        if (currentTick > 0) {
          noteEvents.push({ 
            instrument: drumPatterns.kick.sample, 
            startSample: i * SAMPLES_PER_TICK,
            gain: drumPatterns.kick.gain
          });
        }
      }

      // Snare
      if (drumPatterns.snare.pattern[step] === 1) {
        noteEvents.push({ 
          instrument: drumPatterns.snare.sample, 
          startSample: i * SAMPLES_PER_TICK,
          gain: drumPatterns.snare.gain
        });
      }

      // Hat
      if (drumPatterns.hat.pattern[step] === 1) {
        noteEvents.push({
          instrument: drumPatterns.hat.sample,
          startSample: i * SAMPLES_PER_TICK,
          gain: drumPatterns.hat.gain
        });
      }
       // Ride
      if (drumPatterns.ride.pattern[step] === 1) {
        noteEvents.push({
          instrument: drumPatterns.ride.sample,
          startSample: i * SAMPLES_PER_TICK,
          gain: drumPatterns.ride.gain
        });
      }

      // Crash
      if (currentTick % ticksPerCrash === 0) {
         noteEvents.push({
          instrument: drumPatterns.crash.sample,
          startSample: i * SAMPLES_PER_TICK,
          gain: drumPatterns.crash.gain
        });
      }
    }
  }

  const chunkBuffer = new Float32Array(SAMPLES_PER_CHUNK);
  mixSamples(noteEvents, chunkBuffer);

  return chunkBuffer;
}


function scheduleNextChunk() {
  if (!isRunning) return;

  const chunk = generateMusicChunk(tick);
  
  self.postMessage({
    type: 'chunk',
    data: {
      chunk: chunk,
      duration: CHUNK_DURATION_SECONDS,
    }
  });

  tick += TICKS_PER_CHUNK;
}

self.onmessage = (event) => {
  const { command, data } = event.data;

  if (command === 'load_samples') {
    // We already have Float32Arrays, just store them
    audioSamples = data;

    // Apply effects now that samples are loaded
    if(audioSamples.crash) {
        audioSamples.crash = applyFadeOut(audioSamples.crash);
    }


    self.postMessage({ type: 'samples_loaded' });
  } else if (command === 'start') {
    if (isRunning) return;
    
    tick = 0;
    instruments = data.instruments;
    drumsEnabled = data.drumsEnabled;
    sampleRate = data.sampleRate || 44100;
    
    // Recalculate based on new sample rate if needed
    const SAMPLES_PER_CHUNK = CHUNK_DURATION_SECONDS * sampleRate;
    const SAMPLES_PER_TICK = SAMPLES_PER_CHUNK / TICKS_PER_CHUNK;

    isRunning = true;
    // Initial chunk generation
    scheduleNextChunk(); 
    // Subsequent chunks
    intervalId = setInterval(scheduleNextChunk, CHUNK_DURATION_SECONDS * 1000);
  } else if (command === 'stop') {
    if (!isRunning) return;
    isRunning = false;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    tick = 0;
  } else if (command === 'set_instruments') {
    instruments = data;
  } else if (command === 'toggle_drums') {
    drumsEnabled = data.enabled;
  }
};

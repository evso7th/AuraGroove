// public/workers/ambient.worker.js

// --- State ---
let state = {
  isPlaying: false,
  instruments: {
    solo: 'none',
    accompaniment: 'none',
    bass: 'none',
  },
  drumsEnabled: true,
  sampleRate: 44100,
  tick: 0,
};

let samples = {};
let timeoutId = null;

// --- Music Generation Logic ---
const CHUNK_DURATION_SECONDS = 2.0; // Generate 2 seconds of audio at a time
const BPM = 75;
const SIXTEENTH_NOTE_TIME = 60 / BPM / 4;

function generateMusicChunk() {
  const chunkSampleCount = Math.floor(CHUNK_DURATION_SECONDS * state.sampleRate);
  const chunk = new Float32Array(chunkSampleCount).fill(0);

  const samplesPer16thNote = Math.floor(SIXTEENTH_NOTE_TIME * state.sampleRate);

  for (let i = 0; i < chunkSampleCount; i += samplesPer16thNote) {
    const generatedNotes = [];
    const current16thNote = state.tick;

    // --- Drums ---
    if (state.drumsEnabled) {
        // Kick (every 4 beats, but not the very first one)
        if (current16thNote > 0 && current16thNote % 4 === 0) {
            generatedNotes.push({ sample: 'kick_drum6', gain: 0.7 });
        }
        // Snare (on the 2nd and 4th beat of a 4/4 measure)
        if ((current16thNote % 8 === 2) || (current16thNote % 8 === 6)) {
             generatedNotes.push({ sample: 'snare', gain: 0.9 });
        }
        // Hi-hat (every 16th note for a driving rhythm)
        generatedNotes.push({ sample: 'closed_hi_hat_accented', gain: 0.1 });

        // Crash (every 8 bars)
        if (current16thNote % (16 * 8) === 0 && current16thNote > 0) {
            generatedNotes.push({ sample: 'crash1', gain: 0.4 });
        }
        // Ride (every beat)
        if (current16thNote % 4 === 0) {
            generatedNotes.push({ sample: 'cymbal1', gain: 0.2 });
        }
    }
    
    // --- Instruments (Placeholder Logic) ---
    // This is where you'd add complex melody, harmony, and bass lines.
    // For now, let's keep it simple.
    
    // Bass (every 4 beats)
    if (state.instruments.bass !== 'none' && current16thNote % 4 === 0) {
        // generate bass note
    }

    // Accompaniment (every 2 beats)
    if (state.instruments.accompaniment !== 'none' && current16thNote % 2 === 0) {
        // generate accompaniment chord/note
    }

    // Solo (less frequent)
    if (state.instruments.solo !== 'none' && current16thNote % 16 === 0) {
        // generate solo note
    }

    // --- Mix generated notes into the chunk ---
    for (const note of generatedNotes) {
        const sampleData = samples[note.sample];
        if (sampleData) {
            const gain = note.gain || 1.0;
            for (let j = 0; j < sampleData.length && i + j < chunkSampleCount; j++) {
                chunk[i + j] += sampleData[j] * gain;
            }
        }
    }
    
    state.tick++;
  }

  return chunk;
}

// --- Worker Lifecycle & Communication ---

function scheduleNextChunk() {
  if (!state.isPlaying) return;

  const chunk = generateMusicChunk();
  
  self.postMessage({
    type: 'chunk',
    data: {
      chunk: chunk,
      duration: CHUNK_DURATION_SECONDS
    }
  }, [chunk.buffer]);

  // Schedule the next chunk slightly before the current one ends
  timeoutId = setTimeout(scheduleNextChunk, CHUNK_DURATION_SECONDS * 1000 * 0.9);
}


self.onmessage = (event) => {
  const { command, data } = event.data;

  switch (command) {
    case 'load_samples':
      samples = data;
      self.postMessage({ type: 'samples_loaded' });
      break;
    
    case 'start':
      if (state.isPlaying) return;
      state = { ...state, ...data, isPlaying: true, tick: 0 };
      scheduleNextChunk();
      break;

    case 'stop':
      if (!state.isPlaying) return;
      state.isPlaying = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      break;
      
    case 'set_instruments':
        state.instruments = data;
        break;

    case 'toggle_drums':
        state.drumsEnabled = data.enabled;
        break;

    default:
      self.postMessage({ type: 'error', error: `Unknown command: ${command}` });
  }
};

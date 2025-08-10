
let isRunning = false;
let timeoutId = null;
let samples = {};
let instruments = {};
let drumsEnabled = true;
let sampleRate = 44100;
let currentTick = 0;

const BPM = 70;
const BEATS_PER_BAR = 4;
const SUBDIVISIONS = 4;
const SECONDS_PER_MINUTE = 60;
const sixteenthNoteTime = SECONDS_PER_MINUTE / BPM / SUBDIVISIONS;

function generateSimpleMusicChunk() {
  const generatedNotes = [];
  const time = currentTick * sixteenthNoteTime;

  // --- Drums ---
  if (drumsEnabled) {
    // Kick drum on 1st and 3rd beats
    if (currentTick > 0 && currentTick % 8 === 0) {
      generatedNotes.push({ sample: 'kick', time: time, gain: 0.7 });
    }
    // Snare on 2nd and 4th beats
    if (currentTick % 16 === 4 || currentTick % 16 === 12) {
      generatedNotes.push({ sample: 'snare', time: time, gain: 1.0 });
    }
    // Hi-hat on every 8th note
    if (currentTick % 2 === 0) {
      generatedNotes.push({ sample: 'hat', time: time, gain: 0.4 });
    }
    // Crash every 8 bars
    if (currentTick > 0 && currentTick % (BEATS_PER_BAR * SUBDIVISIONS * 8) === 0) {
        generatedNotes.push({ sample: 'crash', time: time, gain: 0.6 });
    }
    // Ride on every beat
    if (currentTick % 4 === 0) {
        generatedNotes.push({ sample: 'ride', time: time, gain: 0.5 });
    }
  }

  // --- Melodic Instruments (Placeholder) ---
  function playNote(instrumentName, noteList, chance, gain) {
      if (instruments[instrumentName] && instruments[instrumentName] !== 'none' && Math.random() < chance) {
          const note = noteList[Math.floor(Math.random() * noteList.length)];
          generatedNotes.push({ instrument: instruments[instrumentName], note, time, gain });
      }
  }
  
  if (currentTick % 16 === 0) {
      playNote('solo', ['C5', 'E5', 'G5'], 0.5, 0.5);
  }
  if (currentTick % 8 === 0) {
       playNote('accompaniment', ['C4', 'E4', 'G4', 'B4'], 0.6, 0.4);
  }
  if (currentTick % 4 === 0) {
      playNote('bass', ['C3', 'E3', 'G3'], 0.8, 0.6);
  }


  currentTick++;
  return generatedNotes;
}

function mix(notes) {
  const chunkDuration = sixteenthNoteTime;
  const chunkLength = Math.ceil(sampleRate * chunkDuration);
  const buffer = new Float32Array(chunkLength).fill(0);

  notes.forEach(note => {
    let sourceBuffer;
    if (note.sample && samples[note.sample]) {
        sourceBuffer = samples[note.sample];
    } else if (note.instrument) {
        // This part is a placeholder. Real synthesis would be complex.
        // We'll just use a simple sine wave for demonstration.
        const noteFreq = 440 * Math.pow(2, (note.note.charCodeAt(0) - 65 + (parseInt(note.note.slice(1), 10) - 4) * 12) / 12);
        const synthBuffer = new Float32Array(chunkLength);
        for(let i = 0; i < chunkLength; i++) {
            synthBuffer[i] = Math.sin(2 * Math.PI * noteFreq * (i / sampleRate));
        }
        sourceBuffer = synthBuffer;
    }

    if (sourceBuffer) {
        const gain = note.gain || 0.5;
        const noteLength = Math.min(sourceBuffer.length, chunkLength);
        for (let i = 0; i < noteLength; i++) {
            buffer[i] += sourceBuffer[i] * gain;
        }
    }
  });

  return buffer;
}


function scheduleNextChunk() {
  if (!isRunning) {
    if (timeoutId) clearTimeout(timeoutId);
    return;
  }
  
  const notes = generateSimpleMusicChunk();
  const audioChunk = mix(notes);

  if (audioChunk.length > 0) {
    self.postMessage({
      type: 'chunk',
      data: {
        chunk: audioChunk,
        duration: sixteenthNoteTime,
      },
    });
  }

  // Schedule next chunk precisely
  timeoutId = setTimeout(scheduleNextChunk, sixteenthNoteTime * 1000);
}


self.onmessage = (event) => {
  const { command, data } = event.data;

  switch (command) {
    case 'load_samples':
      samples = data;
      self.postMessage({ type: 'samples_loaded' });
      break;
    case 'start':
      if (isRunning) return;
      isRunning = true;
      instruments = data.instruments;
      drumsEnabled = data.drumsEnabled;
      sampleRate = data.sampleRate;
      currentTick = 0;
      scheduleNextChunk();
      break;
    case 'stop':
      isRunning = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      break;
    case 'set_instruments':
      instruments = data;
      break;
    case 'toggle_drums':
      drumsEnabled = data.enabled;
      break;
  }
};

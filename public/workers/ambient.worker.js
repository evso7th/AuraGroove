// Simple synth functions
function createSynth(type, envelope) {
  return { type, envelope };
}

const SYNTHS = {
  synthesizer: createSynth('sawtooth', { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }),
  piano: createSynth('triangle', { attack: 0.005, decay: 0.3, sustain: 0.05, release: 0.1 }),
  organ: createSynth('square', { attack: 0.02, decay: 0.1, sustain: 0.4, release: 0.2 }),
  'bass-guitar': createSynth('sine', { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.1 }),
};

// --- Music Generation Logic ---
const CHORD_PROGRESSION = ['Am', 'G', 'C', 'F'];
const NOTES = {
  'C': 261.63, 'C#': 277.18, 'D': 293.66, 'D#': 311.13, 'E': 329.63, 'F': 349.23,
  'F#': 369.99, 'G': 392.00, 'G#': 415.30, 'A': 440.00, 'A#': 466.16, 'B': 493.88
};
const CHORDS = {
  'Am': ['A', 'C', 'E'],
  'G': ['G', 'B', 'D'],
  'C': ['C', 'E', 'G'],
  'F': ['F', 'A', 'C']
};

function getNoteFreq(noteName, octave = 4) {
  const baseFreq = NOTES[noteName.toUpperCase()];
  if (!baseFreq) return 0;
  return baseFreq * Math.pow(2, octave - 4);
}

function generatePart(partName, bar, barDuration, instruments, octave) {
  const instrumentType = instruments[partName];
  if (!instrumentType || instrumentType === 'none') {
    return [];
  }

  const chordName = CHORD_PROGRESSION[bar % CHORD_PROGRESSION.length];
  const chordNotes = CHORDS[chordName];
  const barStart = bar * barDuration;

  switch (partName) {
    case 'solo':
      return [{
        instrument: instrumentType,
        time: barStart + (Math.floor(Math.random() * 4) * 0.25 * barDuration),
        duration: barDuration * 0.25,
        freq: getNoteFreq(chordNotes[Math.floor(Math.random() * chordNotes.length)], octave + 1),
        velocity: 0.6
      }];
    case 'accompaniment':
      return chordNotes.map((note, index) => ({
        instrument: instrumentType,
        time: barStart,
        duration: barDuration * 0.9,
        freq: getNoteFreq(note, octave),
        velocity: 0.3
      }));
    case 'bass':
      return [{
        instrument: instrumentType,
        time: barStart,
        duration: barDuration * 0.5,
        freq: getNoteFreq(chordNotes[0], octave - 2),
        velocity: 0.8
      }];
    default:
      return [];
  }
}

// More interesting 8-bar drum pattern
const DRUM_PATTERN = [
  // Bar 1-3: Main groove
  ...Array(3).fill(null).flatMap((_, barOffset) => [
    { part: 'kick', time: barOffset + 0 },
    { part: 'hat', time: barOffset + 0 },
    { part: 'hat', time: barOffset + 0.25 },
    { part: 'snare', time: barOffset + 0.5 },
    { part: 'hat', time: barOffset + 0.5 },
    { part: 'hat', time: barOffset + 0.75 },
  ]),
  // Bar 4: Variation
  { part: 'kick', time: 3 + 0 },
  { part: 'hat', time: 3 + 0 },
  { part: 'hat', time: 3 + 0.25 },
  { part: 'snare', time: 3 + 0.5 },
  { part: 'hat', time: 3 + 0.5 },
  { part: 'kick', time: 3 + 0.75 },
  { part: 'hat', time: 3 + 0.75 },
  
  // Bar 5-7: Main groove again
  ...Array(3).fill(null).flatMap((_, barOffset) => [
    { part: 'kick', time: (barOffset + 4) + 0 },
    { part: 'hat', time: (barOffset + 4) + 0 },
    { part: 'hat', time: (barOffset + 4) + 0.25 },
    { part: 'snare', time: (barOffset + 4) + 0.5 },
    { part: 'hat', time: (barOffset + 4) + 0.5 },
    { part: 'hat', time: (barOffset + 4) + 0.75 },
  ]),
  // Bar 8: Fill
  { part: 'kick', time: 7 + 0 },
  { part: 'hat', time: 7 + 0 },
  { part: 'snare', time: 7 + 0.25 },
  { part: 'hat', time: 7 + 0.25 },
  { part: 'kick', time: 7 + 0.5 },
  { part: 'snare', time: 7 + 0.625 },
  { part: 'snare', time: 7 + 0.75 },
  { part: 'snare', time: 7 + 0.875 },
];


function generateDrums(bar, barDuration) {
    if (!state.drumsEnabled) return [];
    const notes = [];
    
    // We get the bar within our 8-bar loop
    const currentBarInLoop = bar % 8;
    const barStart = bar * barDuration;

    // Find all hits for the current bar in the 8-bar pattern
    const hitsForThisBar = DRUM_PATTERN.filter(hit => Math.floor(hit.time) === currentBarInLoop);

    hitsForThisBar.forEach(hit => {
        const timeInBar = hit.time - currentBarInLoop; // time from 0.0 to 1.0
        notes.push({
            instrument: hit.part,
            time: barStart + (timeInBar * barDuration),
            duration: 0.1, // short duration for drum hits
            velocity: (hit.part === 'kick') ? 1.0 : (hit.part === 'snare' ? 0.8 : 0.3)
        });
    });

    return notes;
}


// --- Audio Synthesis Logic ---

function applyEnvelope(audio, envelope, sampleRate, duration) {
  const { attack, decay, sustain, release } = envelope;
  const attackSamples = Math.floor(attack * sampleRate);
  const decaySamples = Math.floor(decay * sampleRate);
  const sustainLevel = sustain;
  const releaseSamples = Math.floor(release * sampleRate);
  const totalSamples = Math.floor(duration * sampleRate);

  for (let i = 0; i < totalSamples; i++) {
    let amp = 0;
    if (i < attackSamples) {
      amp = i / attackSamples;
    } else if (i < attackSamples + decaySamples) {
      amp = 1.0 - ((i - attackSamples) / decaySamples) * (1.0 - sustainLevel);
    } else {
      amp = sustainLevel;
    }
     audio[i] *= amp;
  }
   // A simple release envelope applied at the end
   if (totalSamples > releaseSamples) {
    for (let i = 0; i < releaseSamples; i++) {
        const sampleIndex = totalSamples - releaseSamples + i;
        if (sampleIndex < audio.length) {
            audio[sampleIndex] *= (1.0 - (i / releaseSamples));
        }
    }
  }
}

function generateWave(type, freq, duration, sampleRate) {
  const samples = Math.floor(duration * sampleRate);
  const audio = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    switch (type) {
      case 'sine':
        audio[i] = Math.sin(2 * Math.PI * freq * t);
        break;
      case 'square':
        audio[i] = Math.sign(Math.sin(2 * Math.PI * freq * t));
        break;
      case 'sawtooth':
        audio[i] = 2 * (t * freq - Math.floor(0.5 + t * freq));
        break;
      case 'triangle':
        audio[i] = 2 * Math.abs(2 * (t * freq - Math.floor(0.5 + t * freq))) - 1;
        break;
      default:
        audio[i] = 0;
    }
  }
  return audio;
}

function generateNoise(duration, sampleRate) {
    const samples = Math.floor(duration * sampleRate);
    const audio = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
        audio[i] = Math.random() * 2 - 1;
    }
    return audio;
}


// --- Main Worker Logic ---

const state = {
  isPlaying: false,
  instruments: { solo: 'synthesizer', accompaniment: 'piano', bass: 'bass-guitar' },
  drumsEnabled: true,
  sampleRate: 44100,
  bar: 0,
  tempo: 120,
};

let timerId = null;

function generateAudioChunk() {
  if (!state.isPlaying) return;

  const barDuration = 60 / state.tempo * 4;
  const chunkDuration = barDuration; // Generate one bar at a time
  const chunkSamples = Math.floor(chunkDuration * state.sampleRate);
  const chunkBuffer = new Float32Array(chunkSamples).fill(0);

  // Generate notes for all parts for the current bar
  const soloPart = generatePart('solo', state.bar, barDuration, state.instruments, 5);
  const accompanimentPart = generatePart('accompaniment', state.bar, barDuration, state.instruments, 4);
  const bassPart = generatePart('bass', state.bar, barDuration, state.instruments, 4);
  const drumPart = generateDrums(state.bar, barDuration);

  const allNotes = [...soloPart, ...accompanimentPart, ...bassPart, ...drumPart];

  allNotes.forEach(note => {
    let noteAudio;
    
    // Drum synthesis
    if (note.instrument === 'kick') {
      noteAudio = generateWave('sine', 50, note.duration, state.sampleRate);
      applyEnvelope(noteAudio, { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 }, state.sampleRate, note.duration);
    } else if (note.instrument === 'snare') {
      const noise = generateNoise(note.duration, state.sampleRate);
      const tone = generateWave('sine', 200, note.duration, state.sampleRate);
      noteAudio = new Float32Array(noise.length);
      for(let i=0; i<noise.length; i++) {
          noteAudio[i] = noise[i] * 0.8 + tone[i] * 0.2;
      }
      applyEnvelope(noteAudio, { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 }, state.sampleRate, note.duration);
    } else if (note.instrument === 'hat') {
      noteAudio = generateNoise(note.duration, state.sampleRate);
       // Simple high-pass filter by differentiating
      for(let i=1; i<noteAudio.length; i++) {
          noteAudio[i-1] = noteAudio[i] - noteAudio[i-1];
      }
      applyEnvelope(noteAudio, { attack: 0.005, decay: 0.05, sustain: 0, release: 0.05 }, state.sampleRate, note.duration);
    }
    // Instrument synthesis
    else {
      const synth = SYNTHS[note.instrument];
      if (synth && note.freq > 0) {
        noteAudio = generateWave(synth.type, note.freq, note.duration, state.sampleRate);
        applyEnvelope(noteAudio, synth.envelope, state.sampleRate, note.duration);
      }
    }
    
    if (noteAudio) {
      const noteStartSample = Math.floor((note.time % barDuration) * state.sampleRate);
      for (let i = 0; i < noteAudio.length; i++) {
        const bufferIndex = noteStartSample + i;
        if (bufferIndex < chunkSamples) {
          chunkBuffer[bufferIndex] += noteAudio[i] * note.velocity * 0.5; // 0.5 is a master volume
        }
      }
    }
  });


  // Post the chunk back to the main thread
  self.postMessage({
    type: 'chunk',
    data: {
      chunk: chunkBuffer,
      duration: chunkDuration
    },
  }, [chunkBuffer.buffer]);

  state.bar++;
}

self.onmessage = (event) => {
  const { command, data } = event.data;

  switch (command) {
    case 'start':
      if (state.isPlaying) return;
      state.isPlaying = true;
      Object.assign(state, data);
      state.bar = 0;
      
      self.postMessage({ type: 'generation_started' });
      
      const barDuration = 60 / state.tempo * 4;
      // Start generating immediately, then set an interval
      generateAudioChunk();
      timerId = setInterval(generateAudioChunk, barDuration * 1000);
      break;
      
    case 'stop':
      if (!state.isPlaying) return;
      state.isPlaying = false;
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      break;

    case 'set_instruments':
      state.instruments = data;
      break;

    case 'toggle_drums':
      state.drumsEnabled = data.enabled;
      break;
  }
};

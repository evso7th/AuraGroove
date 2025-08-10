// Simple audio worker without Tone.js to avoid OfflineAudioContext issues.
// It generates raw audio buffers and sends them to the main thread.

// --- UTILITIES ---
class PRNG {
  private seed: number;
  constructor(seed: number) {
    this.seed = seed;
  }
  next() {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

const scales = {
  minorPentatonic: [60, 63, 65, 67, 70],
  majorPentatonic: [60, 62, 64, 67, 69],
  aeolian: [60, 62, 63, 65, 67, 68, 70],
  ionian: [60, 62, 64, 65, 67, 69, 71],
  blues: [60, 63, 65, 66, 67, 70],
};

function midiToFreq(midi: number) {
  return Math.pow(2, (midi - 69) / 12) * 440;
}

function mapValueToMidi(value: number, scale: number[], octave: number) {
  const noteIndex = Math.floor(value * scale.length);
  return scale[noteIndex] + (octave * 12);
}

// --- STATE ---
let generationInterval: any = null;
const partDuration = 4; // seconds
const sampleRate = 44100; // Standard sample rate
let instruments = {
    solo: 'synthesizer',
    accompaniment: 'piano',
    bass: 'bass guitar',
};

const soloPrng = new PRNG(Math.random() * 1000);
const accompanimentPrng = new PRNG(Math.random() * 1000);
const bassPrng = new PRNG(Math.random() * 1000);

const soloScale = scales.blues;
const accompanimentScale = scales.ionian;
const bassScale = scales.aeolian;

// --- SIMPLE SYNTHESIZERS ---
type Note = { freq: number; time: number; duration: number; velocity: number };

function adsrEnvelope(t: number, attack: number, decay: number, sustain: number, release: number, duration: number) {
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1.0 - (1.0 - sustain) * (t - attack) / decay;
    if (t < duration - release) return sustain;
    if (t < duration) return sustain * (1.0 - (t - (duration - release)) / release);
    return 0.0;
}

function oscillator(type: string, t: number, freq: number) {
    switch (type) {
        case 'sawtooth': return 2 * (t * freq - Math.floor(0.5 + t * freq));
        case 'square': return Math.sign(Math.sin(2 * Math.PI * t * freq));
        case 'pulse': return Math.sin(2 * Math.PI * t * freq) > 0.5 ? 1 : -1;
        default: return Math.sin(2 * Math.PI * t * freq); // sine
    }
}

function createSynthVoice(notes: Note[], totalDuration: number, instrument: string) {
    const buffer = new Float32Array(totalDuration * sampleRate);
    let synthOptions;

    switch (instrument) {
        case 'piano':
            synthOptions = { oscType: 'sine', attack: 0.01, decay: 1.2, sustain: 0.1, release: 2.0, volume: 0.4 };
            break;
        case 'organ':
            synthOptions = { oscType: 'sawtooth', attack: 0.2, decay: 0.1, sustain: 0.9, release: 0.8, volume: 0.3 };
            break;
        case 'bass guitar':
             synthOptions = { oscType: 'sine', attack: 0.1, decay: 0.3, sustain: 1, release: 2.5, volume: 0.6 };
             break;
        default: // synthesizer
            synthOptions = { oscType: 'pulse', attack: 0.1, decay: 0.5, sustain: 0.4, release: 1.5, volume: 0.3 };
    }

    notes.forEach(note => {
        const startSample = Math.floor(note.time * sampleRate);
        const endSample = startSample + Math.floor(note.duration * sampleRate);
        for (let i = startSample; i < endSample; i++) {
            const t = (i - startSample) / sampleRate;
            const envelope = adsrEnvelope(t, synthOptions.attack, synthOptions.decay, synthOptions.sustain, synthOptions.release, note.duration);
            const value = oscillator(synthOptions.oscType, t, note.freq) * envelope * note.velocity * synthOptions.volume;
            buffer[i] += value;
        }
    });

    return buffer;
}


// --- MUSIC GENERATION ---
function generatePart() {
  try {
    const soloNotes: Note[] = [];
    for (let i = 0; i < 8; i++) {
        const time = i * 0.5;
        const noteMidi = mapValueToMidi(soloPrng.next(), soloScale, 1);
        soloNotes.push({ freq: midiToFreq(noteMidi), time, duration: 0.4, velocity: 0.5 });
    }

    const accompanimentNotes: Note[] = [];
    for (let i = 0; i < 2; i++) {
        const time = i * 2;
        const rootNoteIndex = Math.floor(accompanimentPrng.next() * accompanimentScale.length);
        const rootNote = mapValueToMidi(0, accompanimentScale, 0) + accompanimentScale[rootNoteIndex] - 60;
        const thirdNote = mapValueToMidi(0, accompanimentScale, 0) + accompanimentScale[(rootNoteIndex + 2) % accompanimentScale.length] - 60;
        accompanimentNotes.push({ freq: midiToFreq(rootNote), time, duration: 1.9, velocity: 0.3 });
        accompanimentNotes.push({ freq: midiToFreq(thirdNote), time, duration: 1.9, velocity: 0.3 });
    }

    const bassNotes: Note[] = [];
    for (let i = 0; i < 2; i++) {
        const time = i * 2;
        const value = bassPrng.next();
        const octave = value < 0.3 ? -2 : -1;
        const noteMidi = mapValueToMidi(value, bassScale, octave);
        bassNotes.push({ freq: midiToFreq(noteMidi), time, duration: 1.9, velocity: 0.8 });
    }
    
    const soloBuffer = createSynthVoice(soloNotes, partDuration, instruments.solo);
    const accompanimentBuffer = createSynthVoice(accompanimentNotes, partDuration, instruments.accompaniment);
    const bassBuffer = createSynthVoice(bassNotes, partDuration, instruments.bass);

    const finalBuffer = new Float32Array(partDuration * sampleRate);
    for (let i = 0; i < finalBuffer.length; i++) {
        finalBuffer[i] = (soloBuffer[i] + accompanimentBuffer[i] + bassBuffer[i]) / 3;
    }

    // Clipping to prevent distortion
    for (let i = 0; i < finalBuffer.length; i++) {
      finalBuffer[i] = Math.max(-1, Math.min(1, finalBuffer[i]));
    }
    
    postMessage({ type: 'music_part', buffer: finalBuffer, duration: partDuration }, [finalBuffer.buffer]);

  } catch (e: any) {
      console.error("Error in worker generation:", e);
      postMessage({ type: 'error', message: e.message });
  }
}

// --- WORKER MESSAGE HANDLING ---
self.onmessage = function(e) {
  const { command, data } = e.data;

  if (command === 'start') {
    instruments = data;
    if (generationInterval === null) {
      generatePart(); // Generate first part immediately
      generationInterval = setInterval(generatePart, (partDuration * 1000) - 200); // Generate slightly faster than playback
    }
  } else if (command === 'stop') {
    if (generationInterval !== null) {
      clearInterval(generationInterval);
      generationInterval = null;
    }
  } else if (command === 'set_instruments') {
    instruments = data;
  }
};

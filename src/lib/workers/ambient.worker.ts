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

const soloScale = scales.minorPentatonic;
const accompanimentScale = scales.ionian;
const bassScale = scales.aeolian;

// --- SIMPLE SYNTHESIZERS ---
type Note = { freq: number; time: number; duration: number; velocity: number };

function adsrEnvelope(t: number, attack: number, decay: number, sustain: number, release: number, duration: number) {
    const sustainLevel = sustain;
    if (t < 0) return 0;
    if (t < attack) {
        return t / attack;
    }
    if (t < attack + decay) {
        return 1.0 - (1.0 - sustainLevel) * (t - attack) / decay;
    }
    if (t < duration - release) {
        return sustainLevel;
    }
    if (t < duration) {
        return sustainLevel * (1.0 - (t - (duration - release)) / release);
    }
    return 0;
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
            synthOptions = { oscType: 'sine', attack: 0.01, decay: 0.8, sustain: 0.2, release: 0.5, volume: 0.4 };
            break;
        case 'organ':
            synthOptions = { oscType: 'sawtooth', attack: 0.2, decay: 0.1, sustain: 0.9, release: 0.8, volume: 0.3 };
            break;
        case 'bass guitar':
             synthOptions = { oscType: 'sine', attack: 0.05, decay: 0.3, sustain: 0.4, release: 1.5, volume: 0.5 };
             break;
        default: // synthesizer
            synthOptions = { oscType: 'pulse', attack: 0.1, decay: 0.5, sustain: 0.4, release: 1.0, volume: 0.3 };
    }

    notes.forEach(note => {
        const startSample = Math.floor(note.time * sampleRate);
        const endSample = startSample + Math.floor(note.duration * sampleRate);

        for (let i = startSample; i < endSample; i++) {
            if (i >= buffer.length) continue;
            const t = (i - startSample) / sampleRate;
            const envelope = adsrEnvelope(t, synthOptions.attack, synthOptions.decay, synthOptions.sustain, synthOptions.release, note.duration);
            let value = oscillator(synthOptions.oscType, t, note.freq) * envelope * note.velocity * synthOptions.volume;
            buffer[i] += value;
        }

        // Apply a short fade-out at the end of the note to prevent clicks
        const fadeOutSamples = 500; // ~11ms
        const fadeStartSample = endSample - fadeOutSamples;
        if (fadeStartSample > startSample) {
             for (let i = fadeStartSample; i < endSample; i++) {
                if (i >= buffer.length) continue;
                const fadeProgress = (endSample - i) / fadeOutSamples;
                buffer[i] *= fadeProgress;
            }
        }
    });

    return buffer;
}


// --- MUSIC GENERATION ---
function generatePart() {
  try {
    // Solo
    const soloNotes: Note[] = [];
    
    // Accompaniment
    const accompanimentNotes: Note[] = [];

    // Bass
    const bassNotes: Note[] = [];
    for (let i = 0; i < 2; i++) {
        const time = i * 2;
        const value = bassPrng.next();
        const octave = value < 0.3 ? -2 : -1;
        const noteMidi = mapValueToMidi(value, bassScale, octave);
        bassNotes.push({ freq: midiToFreq(noteMidi), time, duration: 3.8, velocity: 0.8 });
    }
    
    const soloBuffer = createSynthVoice(soloNotes, partDuration, instruments.solo);
    const accompanimentBuffer = createSynthVoice(accompanimentNotes, partDuration, instruments.accompaniment);
    const bassBuffer = createSynthVoice(bassNotes, partDuration, instruments.bass);

    const finalBuffer = new Float32Array(partDuration * sampleRate);
    for (let i = 0; i < finalBuffer.length; i++) {
        finalBuffer[i] = soloBuffer[i] + accompanimentBuffer[i] + bassBuffer[i];
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

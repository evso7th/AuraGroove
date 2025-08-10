

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
const sampleRate = 44100;
let instruments = {
    solo: 'synthesizer',
    accompaniment: 'piano',
    bass: 'bass guitar',
};
let drumsEnabled = false;

const soloPrng = new PRNG(Math.random() * 1000);
const accompanimentPrng = new PRNG(Math.random() * 1000);
const bassPrng = new PRNG(Math.random() * 1000);
const drumPrng = new PRNG(Math.random() * 1000);

const soloScale = scales.minorPentatonic;
const accompanimentScale = scales.ionian;
const bassScale = scales.aeolian;


// --- SYNTH CREATION ---
type Note = { freq: number; time: number; duration: number; velocity: number };

function adsrEnvelope(t: number, attack: number, decay: number, sustainLevel: number, noteDuration: number) {
    const sustainTime = noteDuration - attack - decay;
    if (t < 0) return 0;
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1.0 - (1.0 - sustainLevel) * (t - attack) / decay;
    if (t < attack + decay + sustainTime) return sustainLevel;
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
    const buffer = new Float32Array(totalDuration * sampleRate).fill(0);
    let synthOptions;

    switch (instrument) {
        case 'piano':
            synthOptions = { oscType: 'sine', attack: 0.01, decay: 0.8, sustain: 0.2, volume: 0.4 };
            break;
        case 'organ':
            synthOptions = { oscType: 'sawtooth', attack: 0.2, decay: 0.1, sustain: 0.9, volume: 0.3 };
            break;
        case 'bass guitar':
             synthOptions = { oscType: 'sine', attack: 0.05, decay: 0.3, sustain: 0.4, volume: 0.6 };
             break;
        default: // synthesizer
            synthOptions = { oscType: 'pulse', attack: 0.1, decay: 0.5, sustain: 0.4, volume: 0.3 };
    }

    notes.forEach(note => {
        const noteDurationInSamples = Math.floor(note.duration * sampleRate);
        const startSample = Math.floor(note.time * sampleRate);
        
        for (let i = 0; i < noteDurationInSamples; i++) {
            const currentSample = startSample + i;
            if (currentSample >= buffer.length) break;

            const t_note = i / sampleRate;
            const envelope = adsrEnvelope(t_note, synthOptions.attack, synthOptions.decay, synthOptions.sustain, note.duration);
            let value = oscillator(synthOptions.oscType, t_note, note.freq) * envelope * note.velocity * synthOptions.volume;
            
            buffer[currentSample] += value;
        }

        const fadeOutSamples = 200;
        const fadeOutStartSample = startSample + noteDurationInSamples - fadeOutSamples;
         for (let i = 0; i < fadeOutSamples; i++) {
            const currentSample = fadeOutStartSample + i;
            if (currentSample < 0 || currentSample >= buffer.length) continue;
            
            const fadeOutProgress = 1 - (i / fadeOutSamples);
            buffer[currentSample] *= fadeOutProgress;
        }
    });

    return buffer;
}


// --- MUSIC GENERATION ---
async function generatePart() {
  try {
    const finalBuffer = new Float32Array(partDuration * sampleRate).fill(0);

    const soloNotes: Note[] = [];
    for (let i = 0; i < 8; i++) {
        if (soloPrng.next() > 0.6) {
            const time = i * 0.5;
            const value = soloPrng.next();
            const octave = value < 0.2 ? 1 : 2;
            const noteMidi = mapValueToMidi(value, soloScale, octave);
            soloNotes.push({ freq: midiToFreq(noteMidi), time, duration: soloPrng.next() * 0.4 + 0.1, velocity: 0.6 });
        }
    }

    const accompanimentNotes: Note[] = [];
    for (let i = 0; i < 4; i++) {
        if (accompanimentPrng.next() > 0.3) {
          const time = i * 1;
          const value = accompanimentPrng.next();
          const octave = value < 0.5 ? 0 : 1;
          const noteMidi = mapValueToMidi(value, accompanimentScale, octave);
          accompanimentNotes.push({ freq: midiToFreq(noteMidi), time, duration: 1.9, velocity: 0.4 });
        }
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

    for (let i = 0; i < finalBuffer.length; i++) {
      finalBuffer[i] = soloBuffer[i] + accompanimentBuffer[i] + bassBuffer[i];
    }
        
    for (let i = 0; i < finalBuffer.length; i++) {
      finalBuffer[i] = Math.max(-1, Math.min(1, finalBuffer[i]));
    }
    
    postMessage({ type: 'music_part', buffer: finalBuffer, duration: partDuration }, [finalBuffer.buffer]);

  } catch (e: any) {
      console.error("Error in worker generation:", e);
      postMessage({ type: 'error', message: e.message || 'An unknown error occurred in the worker.' });
  }
}

// --- WORKER MESSAGE HANDLING ---
self.onmessage = async function(e) {
  const { command, data } = e.data;

  if (command === 'start') {
    instruments = data.instruments;
    drumsEnabled = data.drumsEnabled;
    if (generationInterval === null) {
      postMessage({ type: 'loading_complete' });
      generatePart();
      generationInterval = setInterval(generatePart, (partDuration * 1000) - 20); 
    }
  } else if (command === 'stop') {
    if (generationInterval !== null) {
      clearInterval(generationInterval);
      generationInterval = null;
    }
  } else if (command === 'set_instruments') {
    instruments = data;
  } 
  else if (command === 'toggle_drums') {
    drumsEnabled = data;
  }
};

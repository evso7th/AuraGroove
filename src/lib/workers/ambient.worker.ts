// @ts-nocheck
import * as Tone from 'tone';

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

function mapValueToMidi(value, scale, octave) {
  const noteIndex = Math.floor(value * scale.length);
  return scale[noteIndex] + (octave * 12);
}

// --- STATE ---
let generationInterval = null;
const partDuration = 4; // 2 measures at 120bpm
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

// --- SYNTH CREATION ---
function createSynth(instrument) {
    let synthOptions;
    const commonOptions = { volume: -14 };
    switch (instrument) {
      case 'piano':
        synthOptions = { oscillator: { type: 'fmsine4', harmonicity: 0.5 }, envelope: { attack: 0.01, decay: 1.2, sustain: 0.1, release: 2.0 } };
        break;
      case 'organ':
        synthOptions = { oscillator: { type: 'fatsawtooth', count: 3, spread: 20 }, envelope: { attack: 0.2, decay: 0.1, sustain: 0.9, release: 0.8 } };
        break;
      default:
        synthOptions = { oscillator: { type: 'pulse', width: 0.6 }, envelope: { attack: 0.1, decay: 0.5, sustain: 0.4, release: 1.5 } };
    }
    return new Tone.PolySynth(Tone.Synth, { ...commonOptions, ...synthOptions });
}
  
function createBassSynth() {
    return new Tone.MonoSynth({
      volume: -8,
      oscillator: { type: 'fmsine' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 1, release: 2.5 },
      filterEnvelope: { attack: 0.01, decay: 0.7, sustain: 0.4, baseFrequency: 40, octaves: 4 }
    });
}

// --- MUSIC GENERATION ---
async function generateAndRenderPart() {
  try {
    const buffer = await Tone.Offline(async (Transport) => {
        Transport.bpm.value = 120;

        const masterVolume = new Tone.Volume(-12).toDestination();
        const reverb = new Tone.Reverb({ decay: 8, wet: 0.5 }).connect(masterVolume);
        const delay = new Tone.FeedbackDelay("8n", 0.4).connect(reverb);
        
        const soloSynth = createSynth(instruments.solo).connect(delay);
        const accompanimentSynth = createSynth(instruments.accompaniment).connect(delay);
        const bassSynth = createBassSynth().connect(masterVolume);

        // Schedule solo
        for (let i = 0; i < 8; i++) {
            const time = i * 0.5;
            const note = mapValueToMidi(soloPrng.next(), soloScale, 1);
            soloSynth.triggerAttackRelease(Tone.Frequency(note, "midi"), "8n", time);
        }

        // Schedule accompaniment
        for (let i = 0; i < 2; i++) {
            const time = i * 2;
            const rootNoteIndex = Math.floor(accompanimentPrng.next() * accompanimentScale.length);
            const rootNote = mapValueToMidi(0, accompanimentScale, 0) + accompanimentScale[rootNoteIndex] - 60;
            const thirdNote = mapValueToMidi(0, accompanimentScale, 0) + accompanimentScale[(rootNoteIndex + 2) % accompanimentScale.length] - 60;
            accompanimentSynth.triggerAttackRelease([rootNote, thirdNote], "1n", time);
        }

        // Schedule bass
        for (let i = 0; i < 2; i++) {
            const time = i * 2;
            const value = bassPrng.next();
            const octave = value < 0.3 ? -2 : -1;
            const note = mapValueToMidi(value, bassScale, octave);
            bassSynth.triggerAttackRelease(Tone.Frequency(note, "midi"), "1n", time);
        }
        
        Transport.start();
    }, partDuration);
    
    const bufferData = buffer.getChannelData(0);
    postMessage({ type: 'music_part', buffer: bufferData, duration: partDuration }, [bufferData.buffer]);
  } catch (e) {
      console.error("Error in worker generation:", e);
      postMessage({ type: 'error', message: e.message });
  }
}

// --- WORKER MESSAGE HANDLING ---
self.onmessage = function(e) {
  const { command, data } = e.data;

  if (command === 'start') {
    if (generationInterval === null) {
      generateAndRenderPart(); // Generate first part immediately
      generationInterval = setInterval(generateAndRenderPart, (partDuration * 1000) - 200); // Generate slightly faster than playback
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

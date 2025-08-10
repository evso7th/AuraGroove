// @ts-nocheck

let intervalId: any;

// Simple pseudo-random number generator for deterministic sequences
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

// Map numbers to musical scales
const scales = {
  minorPentatonic: ["C", "Eb", "F", "G", "Bb"],
  majorPentatonic: ["C", "D", "E", "G", "A"],
  blues: ["C", "Eb", "F", "F#", "G", "Bb"],
};

function mapValueToNote(value: number, scale: string[], octave: number): string {
  const noteIndex = Math.floor(value * scale.length);
  return `${scale[noteIndex]}${octave}`;
}

const prng = new PRNG(Math.random() * 1000);
const soloScale = scales.blues;
const soloOctave = 4;

function generateAndPostNote() {
    const note = mapValueToNote(prng.next(), soloScale, soloOctave);
    postMessage({ type: 'note', part: 'solo', note });
}

self.onmessage = function(e) {
  if (e.data.command === 'start') {
    if (intervalId) clearInterval(intervalId);
    // Generate a note every beat
    intervalId = setInterval(generateAndPostNote, 500); 
  } else if (e.data.command === 'stop') {
    clearInterval(intervalId);
    intervalId = null;
  }
};
    
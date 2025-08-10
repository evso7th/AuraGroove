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
  aeolian: ["C", "D", "Eb", "F", "G", "Ab", "Bb"],
  blues: ["C", "Eb", "F", "F#", "G", "Bb"],
};

function mapValueToNote(value: number, scale: string[], octave: number): string {
  const noteIndex = Math.floor(value * scale.length);
  return `${scale[noteIndex]}${octave}`;
}

const prng = new PRNG(Math.random() * 1000);
const bassScale = scales.aeolian;

function generateAndPostNote() {
  const value = prng.next();
  const octave = value < 0.3 ? 1 : 2; // 30% chance to go to 1st octave
  let note = mapValueToNote(value, bassScale, octave);
  // Ensure we don't go below F1
  if (octave === 1 && ["C1", "D1", "Eb1", "E1"].includes(note)) {
    note = "F1";
  }
  postMessage({ type: 'note', part: 'bass', note });
}


self.onmessage = function(e) {
  if (e.data.command === 'start') {
    if (intervalId) clearInterval(intervalId);
     // Generate a new note every measure (roughly)
    intervalId = setInterval(generateAndPostNote, 4000);
  } else if (e.data.command === 'stop') {
    clearInterval(intervalId);
    intervalId = null;
  }
};
    
// @ts-nocheck

// --- FRACTAL AND MUSIC GENERATION LOGIC ---
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
  aeolian: ["C", "D", "Eb", "F", "G", "Ab", "Bb"],
  ionian: ["C", "D", "E", "F", "G", "A", "B"],
};

function mapValueToNote(value: number, scale: string[], octave: number): string {
  const noteIndex = Math.floor(value * scale.length);
  return `${scale[noteIndex]}${octave}`;
}

const prng = new PRNG(Math.random() * 1000);
const accompanimentScale = scales.ionian;
const accompanimentOctave = 3;

function generateAndPostNote() {
    // Create simple two-note chords
    const rootNote = mapValueToNote(prng.next(), accompanimentScale, accompanimentOctave);
    const thirdNote = mapValueToNote(prng.next(), accompanimentScale, accompanimentOctave);
    
    postMessage({ type: 'note', part: 'accompaniment', note: [rootNote, thirdNote] });
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
    
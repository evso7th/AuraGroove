// @ts-nocheck

// --- SINGLE WORKER FOR ALL MUSIC GENERATION ---

let soloInterval: any;
let accompanimentInterval: any;
let bassInterval: any;

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
  blues: ["C", "Eb", "F", "F#", "G", "Bb"],
};

function mapValueToNote(value: number, scale: string[], octave: number): string {
  const noteIndex = Math.floor(value * scale.length);
  return `${scale[noteIndex]}${octave}`;
}

const soloPrng = new PRNG(Math.random() * 1000);
const accompanimentPrng = new PRNG(Math.random() * 1000);
const bassPrng = new PRNG(Math.random() * 1000);

const soloScale = scales.blues;
const accompanimentScale = scales.ionian;
const bassScale = scales.aeolian;


function generateSolo() {
  const note = mapValueToNote(soloPrng.next(), soloScale, 4);
  postMessage({ type: 'note', part: 'solo', note });
}

function generateAccompaniment() {
  const rootNote = mapValueToNote(accompanimentPrng.next(), accompanimentScale, 3);
  const thirdNote = mapValueToNote(accompanimentPrng.next(), accompanimentScale, 3);
  postMessage({ type: 'note', part: 'accompaniment', note: [rootNote, thirdNote] });
}

function generateBass() {
  const value = bassPrng.next();
  const octave = value < 0.3 ? 1 : 2; // 30% chance to go to 1st octave
  let note = mapValueToNote(value, bassScale, octave);
  // Ensure we don't go below F1
  if (octave === 1 && ["C1", "D1", "Eb1", "E1"].includes(note)) {
    note = "F1";
  }
  postMessage({ type: 'note', part: 'bass', note });
}

function stop() {
    if (soloInterval) clearInterval(soloInterval);
    if (accompanimentInterval) clearInterval(accompanimentInterval);
    if (bassInterval) clearInterval(bassInterval);
    soloInterval = null;
    accompanimentInterval = null;
    bassInterval = null;
}

function start() {
    stop();
    // Start intervals for each part
    soloInterval = setInterval(generateSolo, 500); // every beat
    accompanimentInterval = setInterval(generateAccompaniment, 4000); // every measure
    bassInterval = setInterval(generateBass, 4000); // every measure
}


self.onmessage = function(e) {
  if (e.data.command === 'start') {
    start();
  } else if (e.data.command === 'stop') {
    stop();
  }
};

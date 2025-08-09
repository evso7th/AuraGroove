// @ts-nocheck
import * as Tone from "tone";

interface MusicData {
  soloPart: string[];
  accompanimentPart: (string | string[])[];
  bassPart: string[];
}

// --- FRACTAL AND MUSIC GENERATION LOGIC ---

// Helper to get a random element from an array
function getRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

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
  aeolian: ["C", "D", "Eb", "F", "G", "Ab", "Bb"],
  ionian: ["C", "D", "E", "F", "G", "A", "B"],
};

type ScaleName = keyof typeof scales;

function mapValueToNote(value: number, scale: string[], octave: number): string {
  const noteIndex = Math.floor(value * scale.length);
  return `${scale[noteIndex]}${octave}`;
}

// Lindenmayer System (L-System) for generating fractal sequences
function generateLSystem(
  axiom: string,
  rules: { [key: string]: string },
  iterations: number
): string {
  let currentString = axiom;
  for (let i = 0; i < iterations; i++) {
    let newString = "";
    for (const char of currentString) {
      newString += rules[char] || char;
    }
    currentString = newString;
  }
  return currentString;
}

// Generate music data using fractal algorithms
export function generateFractalMusic(): { musicData: MusicData } {
  const seed = Math.random() * 1000;
  const prng = new PRNG(seed);

  // --- Configuration ---
  const soloOctave = 4;
  const accompanimentOctave = 3;
  const soloScaleName = getRandom(Object.keys(scales) as ScaleName[]);
  const accompanimentScaleName = getRandom(Object.keys(scales) as ScaleName[]);
  const bassScaleName = getRandom(['minorPentatonic', 'aeolian', 'blues'] as ScaleName[]);
  
  const soloScale = scales[soloScaleName];
  const accompanimentScale = scales[accompanimentScaleName];
  const bassScale = scales[bassScaleName];
  
  const soloIterations = 4;
  const accompanimentIterations = 3;
  const bassIterations = 2;

  const rules = {
    A: "AB",
    B: "A",
    C: "CD",
    D: "DC",
    E: "F-F+",
    F: "E+E-",
  };

  // --- Generation ---

  // Generate Solo Part (more complex, faster)
  const soloLSystem = generateLSystem("A", rules, soloIterations);
  const soloPart = soloLSystem.split("").map(() => {
    return mapValueToNote(prng.next(), soloScale, soloOctave);
  });
  
  // Generate Accompaniment Part (simpler chords)
  const accompanimentLSystem = generateLSystem("C", { C: "CD", D: "C" }, accompanimentIterations);
  const accompanimentPart = accompanimentLSystem.split("").map(() => {
    // Create simple two-note chords
    const rootNote = mapValueToNote(prng.next(), accompanimentScale, accompanimentOctave);
    const thirdNote = mapValueToNote(prng.next(), accompanimentScale, accompanimentOctave);
    return [rootNote, thirdNote];
  });

  // Generate Bass Part (slow, rhythmic foundation)
  const bassLSystem = generateLSystem("E", { E: "E-F", F: "E+F" }, bassIterations);
  const bassPart = bassLSystem.split("").map(() => {
    const value = prng.next();
    const octave = value < 0.3 ? 1 : 2; // 30% chance to go to 1st octave
    const note = mapValueToNote(value, bassScale, octave);
    // Ensure we don't go below F1
    if (octave === 1 && ["C1", "D1", "Eb1", "E1"].includes(note)) {
      return "F1";
    }
    return note;
  });
  
  const musicData: MusicData = {
    soloPart,
    accompanimentPart,
    bassPart,
  };

  return { musicData };
}

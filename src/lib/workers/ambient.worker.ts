// @ts-nocheck

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


// --- GENERATION LOGIC ---
const partDuration = 4; // seconds for 2 measures at 120bpm
const soloNotesPerPart = 8;
const accompanimentNotesPerPart = 2;
const bassNotesPerPart = 2;

let generationInterval: number | null = null;

function generateMusicPart() {
    const notes = [];
    
    // Generate solo notes
    for (let i = 0; i < soloNotesPerPart; i++) {
        notes.push({
            time: i * 0.5, // 8th notes
            note: mapValueToNote(soloPrng.next(), soloScale, 4),
            duration: '8n',
            part: 'solo'
        });
    }

    // Generate accompaniment chords
    for (let i = 0; i < accompanimentNotesPerPart; i++) {
        const rootNoteIndex = Math.floor(accompanimentPrng.next() * accompanimentScale.length);
        const rootNote = `${accompanimentScale[rootNoteIndex]}3`;
        const thirdNote = `${accompanimentScale[(rootNoteIndex + 2) % accompanimentScale.length]}3`;
        notes.push({
            time: i * 2, // half notes
            note: [rootNote, thirdNote],
            duration: '1m',
            part: 'accompaniment'
        });
    }

    // Generate bass notes
    for (let i = 0; i < bassNotesPerPart; i++) {
        const value = bassPrng.next();
        const octave = value < 0.3 ? 1 : 2; 
        let note = mapValueToNote(value, bassScale, octave);
        if (octave === 1 && ["C1", "D1", "Eb1", "E1"].includes(note)) {
            note = "F1";
        }
        notes.push({
            time: i * 2, // half notes
            note: note,
            duration: '1m',
            part: 'bass'
        });
    }
    
    postMessage({ type: 'music_part', notes, partDuration });
}

self.onmessage = function(e) {
  if (e.data.command === 'start') {
    if (generationInterval === null) {
        generateMusicPart(); // Generate immediately
        generationInterval = setInterval(generateMusicPart, partDuration * 1000);
    }
  } else if (e.data.command === 'stop') {
    if (generationInterval !== null) {
      clearInterval(generationInterval);
      generationInterval = null;
    }
  }
};

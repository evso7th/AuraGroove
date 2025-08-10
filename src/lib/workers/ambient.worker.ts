// @ts-nocheck

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
  minorPentatonic: [60, 63, 65, 67, 70], // C4, Eb4, F4, G4, Bb4
  majorPentatonic: [60, 62, 64, 67, 69], // C4, D4, E4, G4, A4
  aeolian: [60, 62, 63, 65, 67, 68, 70], // C4, D4, Eb4, F4, G4, Ab4, Bb4
  ionian: [60, 62, 64, 65, 67, 69, 71], // C4, D4, E4, F4, G4, A4, B4
  blues: [60, 63, 65, 66, 67, 70], // C4, Eb4, F4, F#4, G4, Bb4
};

function mapValueToMidi(value: number, scale: number[], octave: number): number {
  const noteIndex = Math.floor(value * scale.length);
  return scale[noteIndex] + (octave * 12);
}

const soloPrng = new PRNG(Math.random() * 1000);
const accompanimentPrng = new PRNG(Math.random() * 1000);
const bassPrng = new PRNG(Math.random() * 1000);

const soloScale = scales.blues;
const accompanimentScale = scales.ionian;
const bassScale = scales.aeolian;

const partDuration = 4; // seconds for 2 measures at 120bpm
const soloNotesPerPart = 8;
const accompanimentNotesPerPart = 2; // chords
const bassNotesPerPart = 2;
const totalNotes = soloNotesPerPart + (accompanimentNotesPerPart * 2) + bassNotesPerPart;

let generationInterval: number | null = null;

function generateMusicPart() {
    const times = new Float32Array(totalNotes);
    const pitches = new Float32Array(totalNotes);
    const durations = new Float32Array(totalNotes);
    const parts = new Uint8Array(totalNotes); // 0: solo, 1: accompaniment, 2: bass

    let currentIndex = 0;
    
    // Generate solo notes
    for (let i = 0; i < soloNotesPerPart; i++) {
        times[currentIndex] = i * 0.5;
        pitches[currentIndex] = mapValueToMidi(soloPrng.next(), soloScale, 1);
        durations[currentIndex] = 0.5; // 8n
        parts[currentIndex] = 0;
        currentIndex++;
    }

    // Generate accompaniment chords
    for (let i = 0; i < accompanimentNotesPerPart; i++) {
        const rootNoteIndex = Math.floor(accompanimentPrng.next() * accompanimentScale.length);
        const rootNote = mapValueToMidi(0, accompanimentScale, 0) + accompanimentScale[rootNoteIndex] - 60;
        const thirdNote = mapValueToMidi(0, accompanimentScale, 0) + accompanimentScale[(rootNoteIndex + 2) % accompanimentScale.length] - 60;

        times[currentIndex] = i * 2;
        pitches[currentIndex] = rootNote;
        durations[currentIndex] = 2;
        parts[currentIndex] = 1;
        currentIndex++;
        
        times[currentIndex] = i * 2;
        pitches[currentIndex] = thirdNote;
        durations[currentIndex] = 2;
        parts[currentIndex] = 1;
        currentIndex++;
    }

    // Generate bass notes
    for (let i = 0; i < bassNotesPerPart; i++) {
        const value = bassPrng.next();
        const octave = value < 0.3 ? -2 : -1;
        let note = mapValueToMidi(value, bassScale, octave);
        
        times[currentIndex] = i * 2;
        pitches[currentIndex] = note;
        durations[currentIndex] = 2;
        parts[currentIndex] = 2;
        currentIndex++;
    }
    
    const transferableObjects = [times.buffer, pitches.buffer, durations.buffer, parts.buffer];
    postMessage({ type: 'music_part', partDuration, times, pitches, durations, parts }, transferableObjects);
}

self.onmessage = function(e) {
  if (e.data.command === 'start') {
    if (generationInterval === null) {
        generateMusicPart();
        generationInterval = setInterval(generateMusicPart, partDuration * 1000);
    }
  } else if (e.data.command === 'stop') {
    if (generationInterval !== null) {
      clearInterval(generationInterval);
      generationInterval = null;
    }
  }
};

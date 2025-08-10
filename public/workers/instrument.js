
const BASE_NOTE_MAP = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
};

function noteToFrequency(note) {
    const name = note.slice(0, -1);
    const octave = parseInt(note.slice(-1), 10);
    const baseMidi = 12 + BASE_NOTE_MAP[name] + (octave * 12);
    return 440 * Math.pow(2, (baseMidi - 69) / 12);
}

// Simple musical scales
const SCALES = {
    C_MAJOR: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
    A_MINOR: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'],
    PENTATONIC_MAJOR: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'],
    PENTATONIC_MINOR: ['A3', 'C4', 'D4', 'E4', 'G4', 'A4'],
};

// Chord progressions (using root notes)
const CHORD_PROGRESSIONS = {
    POP: ['C', 'G', 'Am', 'F'],
    JAZZ: ['Dm7', 'G7', 'Cmaj7', 'A7'],
};

// --- SYNTHESIZER ---
class Synthesizer {
    constructor(type) {
        this.type = type; // 'sine', 'square', 'sawtooth', 'triangle'
        this.adsr = { attack: 0.01, decay: 0.2, sustain: 0.5, release: 0.1 };
    }

    render(notes, sampleRate) {
        let totalDuration = 0;
        notes.forEach(n => {
            totalDuration = Math.max(totalDuration, n.time + n.duration);
        });
        const buffer = new Float32Array(Math.floor(totalDuration * sampleRate)).fill(0);
        let phase = 0;

        notes.forEach(note => {
            const frequency = noteToFrequency(note.note);
            const noteStartSample = Math.floor(note.time * sampleRate);
            const noteDurationSamples = Math.floor(note.duration * sampleRate);
            const sustainLevel = this.adsr.sustain * note.velocity;

            for (let i = 0; i < noteDurationSamples; i++) {
                const t = i / sampleRate;
                const sampleIndex = noteStartSample + i;

                if (sampleIndex >= buffer.length) continue;

                // ADSR Envelope
                let amplitude = 0;
                const attackTime = this.adsr.attack;
                const decayTime = this.adsr.decay;
                const releaseTime = this.adsr.release;
                const sustainTime = note.duration - attackTime - decayTime - releaseTime;

                if (t < attackTime) {
                    amplitude = (t / attackTime) * note.velocity;
                } else if (t < attackTime + decayTime) {
                    amplitude = note.velocity - ((t - attackTime) / decayTime) * (note.velocity - sustainLevel);
                } else if (t < attackTime + decayTime + sustainTime) {
                    amplitude = sustainLevel;
                } else {
                    amplitude = sustainLevel * (1 - (t - (note.duration - releaseTime)) / releaseTime);
                }
                
                amplitude = Math.max(0, amplitude);

                // Oscillator
                let value = 0;
                const time = i / sampleRate;
                switch (this.type) {
                    case 'sine':
                        value = Math.sin(2 * Math.PI * frequency * time);
                        break;
                    case 'square':
                        value = Math.sign(Math.sin(2 * Math.PI * frequency * time));
                        break;
                    case 'sawtooth':
                        value = 2 * (frequency * time - Math.floor(0.5 + frequency * time));
                        break;
                    case 'triangle':
                        value = 2 * Math.abs(2 * (frequency * time - Math.floor(0.5 + frequency * time))) - 1;
                        break;
                }

                buffer[sampleIndex] += value * amplitude * 0.5; // 0.5 to reduce volume
            }
        });

        return buffer;
    }
}

// --- INSTRUMENT ---
export class Instrument {
    constructor(type) {
        this.type = type; // 'synthesizer', 'piano', 'organ', 'bass guitar', 'none'
        this.synth = this.createSynth(type);
        this.lastNoteTime = -1;
        this.lastChordTime = -1;
        this.currentScale = SCALES.PENTATONIC_MINOR;
        this.currentProgression = CHORD_PROGRESSIONS.JAZZ;
        this.chordIndex = 0;
    }

    createSynth(type) {
        switch (type) {
            case 'synthesizer':
                return new Synthesizer('sawtooth');
            case 'piano': // Simplified to a triangle wave
                return new Synthesizer('triangle');
            case 'organ': // Simplified to a mix of sine waves (approximated)
                return new Synthesizer('sine');
            case 'bass guitar': // Simplified to a sine wave
                return new Synthesizer('sine');
            default:
                return null;
        }
    }
    
    generate(startTime, endTime, sampleRate) {
        if (!this.synth || this.type === 'none') {
            const durationSamples = Math.floor((endTime - startTime) * sampleRate);
            return new Float32Array(durationSamples).fill(0);
        }

        const notes = [];
        const duration = endTime - startTime;

        switch (this.type) {
            case 'bass guitar':
                if (startTime >= this.lastChordTime + 4) { // Change chord every 4s
                     this.lastChordTime = startTime;
                     this.chordIndex = (this.chordIndex + 1) % this.currentProgression.length;
                }
                const chord = this.currentProgression[this.chordIndex];
                const rootNote = chord.replace(/[^A-G#b]/g, '') + '2'; // Bass octave
                notes.push({ note: rootNote, time: 0, duration: duration, velocity: 0.8 });
                break;
            default: // Solo / Accompaniment logic
                 if (startTime >= this.lastNoteTime + 0.5) { // New note every 0.5s
                    this.lastNoteTime = startTime;
                    const randomNote = this.currentScale[Math.floor(Math.random() * this.currentScale.length)];
                    notes.push({ note: randomNote, time: 0, duration: 0.4, velocity: 0.6 });
                 }
                break;
        }

        const renderedBuffer = this.synth.render(notes, sampleRate);
        const chunkStartSample = Math.floor(startTime * sampleRate);
        const chunkEndSample = Math.floor(endTime * sampleRate);
        const totalDurationSamples = Math.floor(duration * sampleRate);
        
        // This is tricky. We need to get the correct slice of the renderedBuffer.
        // For simplicity, we are generating notes starting at time 0 within the chunk.
        // A more complex implementation would handle notes crossing chunk boundaries.
        if (renderedBuffer.length > totalDurationSamples) {
            return renderedBuffer.slice(0, totalDurationSamples);
        }

        // Pad with silence if the rendered buffer is too short
        const finalChunk = new Float32Array(totalDurationSamples).fill(0);
        finalChunk.set(renderedBuffer, 0);

        return finalChunk;
    }
}

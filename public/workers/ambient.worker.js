
// Simple music theory helper
const NOTES = { C: 261.63, 'C#': 277.18, D: 293.66, 'D#': 311.13, E: 329.63, F: 349.23, 'F#': 369.99, G: 392.00, 'G#': 415.30, A: 440.00, 'A#': 466.16, B: 493.88 };
const getNoteFrequency = (note, octave = 4) => {
    const baseFreq = NOTES[note.toUpperCase()];
    if (!baseFreq) return 0;
    return baseFreq * Math.pow(2, octave - 4);
};

// --- STATE ---
let sampleRate = 44100;
let isPlaying = false;
let instruments = { solo: 'none', accompaniment: 'none', bass: 'none' };
let drumsEnabled = true;
let totalTime = 0;
let loopCount = 0;

// --- CONSTANTS ---
const BPM = 100;
const BEATS_PER_BAR = 4;
const BARS_PER_LOOP = 8;
const SECONDS_PER_BEAT = 60.0 / BPM;
const SECONDS_PER_BAR = SECONDS_PER_BEAT * BEATS_PER_BAR;
const LOOP_DURATION_SECONDS = SECONDS_PER_BAR * BARS_PER_LOOP;
const CHUNK_DURATION = 0.5; // Generate audio in 0.5s chunks

// --- SYNTHESIS ---

// ADSR Envelope
const adsr = (t, attack, decay, sustainLevel, releaseTime, noteDuration) => {
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1.0 - (1.0 - sustainLevel) * (t - attack) / decay;
    if (t < noteDuration) return sustainLevel;
    if (t < noteDuration + releaseTime) return sustainLevel * (1.0 - (t - noteDuration) / releaseTime);
    return 0;
};

// Oscillator
const oscillator = (t, freq, type = 'sine') => {
    switch (type) {
        case 'sine': return Math.sin(2 * Math.PI * freq * t);
        case 'square': return Math.sign(Math.sin(2 * Math.PI * freq * t));
        case 'sawtooth': return 2 * (t * freq - Math.floor(t * freq + 0.5));
        case 'triangle': return 2 * Math.abs(2 * (t * freq - Math.floor(t * freq + 0.5))) - 1;
        default: return Math.sin(2 * Math.PI * freq * t);
    }
};

// Simple white noise generator
const noise = () => Math.random() * 2 - 1;

// --- MUSIC GENERATION ---

// Generates a simple walking bassline for one bar
function generateBassPart(bar, scale) {
    const part = [];
    const rootNote = scale[0];
    part.push({ freq: getNoteFrequency(rootNote, 2), time: bar * SECONDS_PER_BAR, duration: SECONDS_PER_BEAT, velocity: 0.6 });
    part.push({ freq: getNoteFrequency(scale[2], 2), time: bar * SECONDS_PER_BAR + SECONDS_PER_BEAT * 2, duration: SECONDS_PER_BEAT, velocity: 0.5 });
    return part;
}

// Generates a simple arpeggiated part
function generateArpPart(bar, scale) {
    const part = [];
    const arpNotes = [scale[0], scale[2], scale[4], scale[2]];
    for (let i = 0; i < 4; i++) {
        part.push({
            freq: getNoteFrequency(arpNotes[i], 4),
            time: bar * SECONDS_PER_BAR + i * SECONDS_PER_BEAT,
            duration: SECONDS_PER_BEAT,
            velocity: 0.3
        });
    }
    return part;
}

// Generates a simple chord part
function generateChordPart(bar, scale) {
    const part = [];
    const chordNotes = [scale[0], scale[2], scale[4]];
    chordNotes.forEach(note => {
        part.push({
            freq: getNoteFrequency(note, 3),
            time: bar * SECONDS_PER_BAR,
            duration: SECONDS_PER_BAR,
            velocity: 0.2
        });
    });
    return part;
}

// Probabilistic Drum Generation
function generateDrums(bars) {
    const drumPart = [];
    const sixteenth = SECONDS_PER_BEAT / 4;

    for (let bar = 0; bar < bars; bar++) {
        const barStart = bar * SECONDS_PER_BAR;

        // --- Main Groove (Bars 1-7) ---
        if (bar < BARS_PER_LOOP - 1) {
            // Kick
            drumPart.push({ instrument: 'kick', time: barStart });
            if (Math.random() < 0.3) {
                drumPart.push({ instrument: 'kick', time: barStart + 2 * SECONDS_PER_BEAT + 2 * sixteenth });
            }

            // Snare
            drumPart.push({ instrument: 'snare', time: barStart + SECONDS_PER_BEAT });
            drumPart.push({ instrument: 'snare', time: barStart + 3 * SECONDS_PER_BEAT });
            if (Math.random() < 0.1) {
                 drumPart.push({ instrument: 'snare', time: barStart + 3 * SECONDS_PER_BEAT + 3 * sixteenth, velocity: 0.3 });
            }

            // Hi-hat
            for (let i = 0; i < 16; i++) {
                if (Math.random() < 0.7) {
                     drumPart.push({ instrument: 'hat', time: barStart + i * sixteenth });
                }
            }
        }
        // --- Fill (Bar 8) ---
        else {
             if (Math.random() < 0.6) { // 60% chance to play a fill
                const fillPatterns = [
                    // Pattern 1: Simple roll
                    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
                    // Pattern 2: Triplets
                    [0, 3, 6, 8, 11, 14],
                    // Pattern 3: Syncopated
                    [0, 2, 5, 7, 10, 11, 14, 15]
                ];
                const selectedPattern = fillPatterns[Math.floor(Math.random() * fillPatterns.length)];
                selectedPattern.forEach(pos => {
                     drumPart.push({ instrument: 'snare', time: barStart + pos * sixteenth, velocity: 0.5 + Math.random() * 0.5 });
                });
                drumPart.push({ instrument: 'kick', time: barStart });

             } else { // Play groove if no fill
                drumPart.push({ instrument: 'kick', time: barStart });
                drumPart.push({ instrument: 'snare', time: barStart + SECONDS_PER_BEAT });
             }
        }
    }
    return drumPart;
}


// --- MAIN AUDIO GENERATION ---
function generateAudioChunk() {
    if (!isPlaying) return;

    const chunkSamples = Math.floor(CHUNK_DURATION * sampleRate);
    const chunkBuffer = new Float32Array(chunkSamples).fill(0);
    const scale = ['C', 'D#', 'G', 'G#', 'C5']; // Pentatonic scale

    // Determine the notes that fall into this chunk
    const allNotes = [];
    const currentTimeInLoop = totalTime % LOOP_DURATION_SECONDS;

    // We generate the music pattern for the whole loop only once per loop
    if (currentTimeInLoop < CHUNK_DURATION) {
        if (loopCount > 0 && currentTimeInLoop === 0) {
            // This condition is tricky, might not be reliable. Let's rethink.
        }
        // Generate for the entire loop
        const soloPart = instruments.solo !== 'none' ? generateArpPart(loopCount, scale) : [];
        const accompanimentPart = instruments.accompaniment !== 'none' ? generateChordPart(loopCount, scale) : [];
        const bassPart = instruments.bass !== 'none' ? generateBassPart(loopCount, scale) : [];
        const drumPart = drumsEnabled ? generateDrums(BARS_PER_LOOP) : [];

        // This approach is flawed, it should generate based on bars.
        // Let's generate per bar inside the loop.
    }

    const currentBar = Math.floor(currentTimeInLoop / SECONDS_PER_BAR);

    const soloNotes = instruments.solo !== 'none' ? generateArpPart(currentBar, scale) : [];
    const accompanimentNotes = instruments.accompaniment !== 'none' ? generateChordPart(currentBar, scale) : [];
    const bassNotes = instruments.bass !== 'none' ? generateBassPart(currentBar, scale) : [];

    // Let's generate drums for the whole loop to have the fill logic work correctly
    const drumNotes = drumsEnabled ? generateDrums(BARS_PER_LOOP) : [];


    allNotes.push(...soloNotes, ...accompanimentNotes, ...bassNotes, ...drumNotes);

    for (let i = 0; i < chunkSamples; i++) {
        const t = totalTime + i / sampleRate;
        let sampleValue = 0;

        // --- Musical Notes ---
        [...soloNotes, ...accompanimentNotes, ...bassNotes].forEach(note => {
            if (t >= note.time && t < note.time + note.duration + 0.5) { // 0.5s release
                const timeInNote = t - note.time;
                const envelope = adsr(timeInNote, 0.01, 0.2, 0.5, 0.5, note.duration);
                sampleValue += oscillator(timeInNote, note.freq, 'sine') * envelope * note.velocity * 0.5;
            }
        });
        
        // --- Drum Notes ---
        if (drumsEnabled) {
            drumNotes.forEach(note => {
                const noteEndTime = note.time + 0.2; // Fixed duration for drums
                if (t >= note.time && t < noteEndTime) {
                    const timeInNote = t - note.time;
                    let drumSample = 0;
                    const velocity = note.velocity || 0.8;

                    if (note.instrument === 'kick') {
                        const envelope = adsr(timeInNote, 0.01, 0.2, 0, 0, 0.2);
                        drumSample = oscillator(timeInNote, 60, 'sine') * envelope;
                    } else if (note.instrument === 'snare') {
                        const envelope = adsr(timeInNote, 0.01, 0.15, 0, 0, 0.15);
                        drumSample = (noise() * 0.5 + oscillator(timeInNote, 200, 'sawtooth') * 0.5) * envelope;
                    } else if (note.instrument === 'hat') {
                        const envelope = adsr(timeInNote, 0.01, 0.05, 0, 0, 0.05);
                        drumSample = noise() * envelope * 0.4;
                    }
                    sampleValue += drumSample * velocity;
                }
            });
        }


        // Clipping
        chunkBuffer[i] = Math.max(-1, Math.min(1, sampleValue));
    }

    totalTime += CHUNK_DURATION;

    // Post the chunk back to the main thread
    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkBuffer,
            duration: CHUNK_DURATION,
        }
    }, [chunkBuffer.buffer]);

    // Schedule next chunk
    setTimeout(generateAudioChunk, CHUNK_DURATION * 1000 * 0.9);
}


// --- MESSAGE HANDLING ---
self.onmessage = (event) => {
    const { command, data } = event.data;

    if (command === 'start') {
        sampleRate = data.sampleRate;
        instruments = data.instruments;
        drumsEnabled = data.drumsEnabled;
        totalTime = 0;
        loopCount = 0;

        if (!isPlaying) {
            isPlaying = true;
            self.postMessage({ type: 'generation_started' });
            generateAudioChunk();
        }
    } else if (command === 'stop') {
        isPlaying = false;
    } else if (command === 'set_instruments') {
        instruments = data;
    } else if (command === 'toggle_drums') {
        drumsEnabled = data.enabled;
    }
};

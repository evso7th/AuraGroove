
let state = {
    isPlaying: false,
    instruments: {
        solo: 'none',
        accompaniment: 'none',
        bass: 'none',
    },
    drumsEnabled: false,
    sampleRate: 44100,
};

let musicState = {
    currentTime: 0,
    soloTime: 0,
    accompanimentTime: 0,
    bassTime: 0,
    drumTime: 0,
};

const CHUNK_DURATION = 0.5; // seconds
let generationIntervalId = null;


// --- MUSIC GENERATION LOGIC (moved directly into worker) ---

const SCALES = {
    cMajor: ["C", "D", "E", "F", "G", "A", "B"],
};

const noteToFreq = (note) => {
    const A4 = 440;
    const notes = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
    const keyNumber = (note) => {
        const octave = parseInt(note.slice(-1), 10);
        const key = note.slice(0, -1);
        const index = notes.indexOf(key);
        return octave * 12 + index - 57; // A4 is key 49, so we adjust
    };
    return A4 * Math.pow(2, keyNumber(note) / 12);
};


function generatePart(partName, currentTime, duration, scale) {
    const notes = [];
    const noteCount = Math.random() > 0.8 ? 1 : 0; // Low density notes
    if (noteCount === 0) return notes;

    const noteName = scale[Math.floor(Math.random() * scale.length)];
    let octave;

    switch (partName) {
        case 'solo': octave = 4; break;
        case 'accompaniment': octave = 3; break;
        case 'bass': octave = 2; break;
        default: octave = 3;
    }

    notes.push({
        freq: noteToFreq(`${noteName}${octave}`),
        time: currentTime + Math.random() * duration,
        duration: 0.3 + Math.random() * 0.4,
        velocity: 0.3 + Math.random() * 0.2,
    });
    return notes;
}

const DRUM_PATTERN = [
    { time: 0.0, instrument: 'kick' },
    { time: 0.5, instrument: 'hat' },
    { time: 1.0, instrument: 'snare' },
    { time: 1.5, instrument: 'hat' },
    { time: 2.0, instrument: 'kick' },
    { time: 2.5, instrument: 'hat' },
    { time: 3.0, instrument: 'snare' },
    { time: 3.5, instrument: 'hat' },
];
const DRUM_LOOP_DURATION = 4.0;

function generateDrums(currentTime, duration) {
    const notes = [];
    const loopTime = currentTime % DRUM_LOOP_DURATION;

    DRUM_PATTERN.forEach(hit => {
        if (hit.time >= loopTime && hit.time < loopTime + duration) {
            notes.push({
                instrument: hit.instrument,
                time: currentTime + (hit.time - loopTime),
                duration: 0.1,
                velocity: hit.instrument === 'kick' ? 0.9 : 0.5,
            });
        }
    });
    return notes;
}


// --- AUDIO SYNTHESIS LOGIC ---

function getWave(type, freq, t) {
    switch (type) {
        case 'sine': return Math.sin(2 * Math.PI * freq * t);
        case 'square': return Math.sign(Math.sin(2 * Math.PI * freq * t));
        case 'sawtooth': return 2 * (t * freq - Math.floor(0.5 + t * freq));
        case 'triangle': return 2 * Math.abs(2 * (t * freq - Math.floor(0.5 + t * freq))) - 1;
        default: return Math.sin(2 * Math.PI * freq * t);
    }
}

function adsr(t, attack, decay, sustainLevel, release, duration) {
    if (t < 0) return 0;
    if (t < attack) return t / attack;
    if (t < attack + decay) return 1 - (1 - sustainLevel) * (t - attack) / decay;
    if (t < duration) return sustainLevel;
    if (t < duration + release) return sustainLevel * (1 - (t - duration) / release);
    return 0;
}

function generateAudioChunk() {
    if (!state.isPlaying) return;

    const chunkSamples = Math.floor(CHUNK_DURATION * state.sampleRate);
    const chunkBuffer = new Float32Array(chunkSamples).fill(0);
    
    let allNotes = [];

    const currentScale = SCALES.cMajor;

    if (state.instruments.solo !== 'none') {
        allNotes.push(...generatePart('solo', musicState.currentTime, CHUNK_DURATION, currentScale).map(n => ({...n, instrument: state.instruments.solo })));
    }
    if (state.instruments.accompaniment !== 'none') {
        allNotes.push(...generatePart('accompaniment', musicState.currentTime, CHUNK_DURATION, currentScale).map(n => ({...n, instrument: state.instruments.accompaniment })));
    }
    if (state.instruments.bass !== 'none') {
        allNotes.push(...generatePart('bass', musicState.currentTime, CHUNK_DURATION, currentScale).map(n => ({...n, instrument: state.instruments.bass })));
    }
    if (state.drumsEnabled) {
        allNotes.push(...generateDrums(musicState.currentTime, CHUNK_DURATION));
    }

    for (let i = 0; i < chunkSamples; i++) {
        const timeInChunk = i / state.sampleRate;
        const timeAbsolute = musicState.currentTime + timeInChunk;
        let sampleValue = 0;

        for (const note of allNotes) {
            if (timeAbsolute >= note.time && timeAbsolute < note.time + note.duration + 0.1) { // 0.1 for release
                const timeInNote = timeAbsolute - note.time;
                let noteSample = 0;
                
                const envelope = adsr(timeInNote, 0.01, 0.1, 0.4, 0.1, note.duration);

                if (note.instrument === 'synthesizer') {
                     noteSample = getWave('sawtooth', note.freq, timeInNote) * 0.5 + getWave('triangle', note.freq * 0.5, timeInNote) * 0.5;
                } else if (note.instrument === 'piano') {
                    noteSample = (getWave('sine', note.freq, timeInNote) + getWave('triangle', note.freq, timeInNote)) * 0.5;
                } else if (note.instrument === 'organ') {
                    noteSample = getWave('square', note.freq, timeInNote);
                } else if (note.instrument === 'bass guitar') {
                    noteSample = getWave('sine', note.freq, timeInNote);
                } else if (note.instrument === 'kick') {
                    const kickEnv = Math.exp(-timeInNote * 30);
                    const freq = 120 * Math.exp(-timeInNote * 20);
                    noteSample = getWave('sine', freq, timeInNote) * kickEnv;
                } else if (note.instrument === 'snare') {
                     const snareEnv = Math.exp(-timeInNote * 20);
                     noteSample = (Math.random() * 2 - 1) * snareEnv * 0.5;
                } else if (note.instrument === 'hat') {
                    const hatEnv = Math.exp(-timeInNote * 40);
                    noteSample = (Math.random() * 2 - 1) * hatEnv * 0.2;
                }
                
                sampleValue += noteSample * envelope * note.velocity;
            }
        }
        chunkBuffer[i] = sampleValue / 4; // Basic mixdown, divide by num parts to avoid clipping
    }

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkBuffer,
            duration: CHUNK_DURATION,
        }
    }, [chunkBuffer.buffer]);

    musicState.currentTime += CHUNK_DURATION;

}

self.onmessage = (event) => {
    const { command, data } = event.data;

    if (command === 'start') {
        state.isPlaying = true;
        state.instruments = data.instruments;
        state.drumsEnabled = data.drumsEnabled;
        state.sampleRate = data.sampleRate;
        
        musicState = {
            currentTime: 0,
            soloTime: 0,
            accompanimentTime: 0,
            bassTime: 0,
            drumTime: 0,
        };

        if (generationIntervalId) clearInterval(generationIntervalId);
        
        self.postMessage({ type: 'generation_started' });

        generateAudioChunk(); // Generate first chunk immediately
        generationIntervalId = setInterval(generateAudioChunk, CHUNK_DURATION * 1000 * 0.9);

    } else if (command === 'stop') {
        state.isPlaying = false;
        if (generationIntervalId) {
            clearInterval(generationIntervalId);
            generationIntervalId = null;
        }
    } else if (command === 'set_instruments') {
        state.instruments = data;
    } else if (command === 'toggle_drums') {
        state.drumsEnabled = data.enabled;
    }
};

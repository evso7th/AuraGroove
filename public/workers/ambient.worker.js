
// === CONFIGURATION ===
const CHUNK_DURATION = 1.0; // seconds
const SOLO_VOICES = 2;
const ACCOMPANIMENT_VOICES = 3;
const BASS_VOICES = 1;

// === STATE ===
let sampleRate = 44100;
let isGenerating = false;
let instruments = { solo: 'none', accompaniment: 'none', bass: 'none' };
let drumsEnabled = true;
let scheduleTimeoutId = null;
let lastGenerationTime = 0;
let generatedTime = 0;

const SAMPLES = {
    kick: null,
    snare: null,
    hat: null,
};
let samplesLoaded = false;

// === MUSIC GENERATION LOGIC ===

// --- Rhythmic Patterns ---
const DRUM_FILLS = [
    // Fill 1
    [
        { time: 0, instrument: 'hat' }, { time: 1/8, instrument: 'hat' },
        { time: 2/8, instrument: 'snare' }, { time: 3/8, instrument: 'snare' },
        { time: 4/8, instrument: 'kick' }, { time: 5/8, instrument: 'hat' },
        { time: 6/8, instrument: 'snare' }, { time: 7/8, instrument: 'snare' },
    ],
    // Fill 2
    [
        { time: 0, instrument: 'kick' }, { time: 2/8, instrument: 'kick' },
        { time: 3/8, instrument: 'hat' }, { time: 4/8, instrument: 'snare' },
        { time: 6/8, instrument: 'snare' }, { time: 7/8, instrument: 'hat' },
    ]
];

// --- Note Generation ---
function generatePart(startTime, duration, partType) {
    const notes = [];
    const scale = [60, 62, 64, 65, 67, 69, 71]; // C Major scale MIDI notes
    let noteCount;

    switch (partType) {
        case 'solo':
            noteCount = Math.random() > 0.3 ? 2 : 1;
            for (let i = 0; i < noteCount; i++) {
                const noteTime = startTime + Math.random() * duration;
                const noteDuration = 0.2 + Math.random() * 0.3;
                if (noteTime + noteDuration > startTime + duration) continue;
                
                const midiNote = scale[Math.floor(Math.random() * scale.length)] + 12;
                notes.push({
                    freq: 440 * Math.pow(2, (midiNote - 69) / 12),
                    time: noteTime,
                    duration: noteDuration,
                    velocity: 0.2 + Math.random() * 0.2,
                    type: instruments.solo
                });
            }
            break;
        case 'accompaniment':
             const chordMidi = scale[Math.floor(Math.random() * 2)];
             const chordNotes = [chordMidi, chordMidi + 4, chordMidi + 7];
             const chordTime = startTime + (Math.random() > 0.5 ? 0 : duration / 2);
             const chordDuration = duration / 2 - 0.1;

             for (const note of chordNotes) {
                 notes.push({
                     freq: 440 * Math.pow(2, (note - 69) / 12),
                     time: chordTime,
                     duration: chordDuration,
                     velocity: 0.1 + Math.random() * 0.1,
                     type: instruments.accompaniment
                 });
             }
            break;
        case 'bass':
            const bassNoteMidi = scale[Math.floor(Math.random() * 2)] - 12;
             notes.push({
                 freq: 440 * Math.pow(2, (bassNoteMidi - 69) / 12),
                 time: startTime,
                 duration: duration * 0.9,
                 velocity: 0.3 + Math.random() * 0.2,
                 type: instruments.bass
             });
            break;
    }
    return notes;
}

function generateDrums(startTime, duration, currentBar) {
    const notes = [];
    const barDuration = 2.0; // Assuming 4/4 time at 120bpm
    const timeIn8BarLoop = (generatedTime + startTime) % (barDuration * 8);
    const current8Bar = Math.floor(timeIn8BarLoop / barDuration);

    let pattern = [];
    // Basic groove for most bars
    const groove = [
        { time: 0, instrument: 'kick' },
        { time: 1/4, instrument: 'hat' },
        { time: 2/4, instrument: 'snare' },
        { time: 3/4, instrument: 'hat' },
        { time: 1/8, instrument: 'hat' }, { time: 3/8, instrument: 'hat' }, { time: 5/8, instrument: 'hat' },{ time: 7/8, instrument: 'hat' }
    ];
    
    // On the 8th bar, maybe play a fill
    if (current8Bar === 7 && Math.random() < 0.6) {
        pattern = DRUM_FILLS[Math.floor(Math.random() * DRUM_FILLS.length)];
    } else {
        pattern = groove;
        // Add some variation to the main groove
        if (Math.random() < 0.2) {
             pattern.push({ time: 6/8, instrument: 'kick' });
        }
    }
    
    for (const hit of pattern) {
        const noteTime = startTime + hit.time * barDuration;
        if (noteTime < startTime + duration) {
            notes.push({
                time: noteTime,
                duration: 0.2, // Sample length will override this
                velocity: 0.4 + Math.random() * 0.2,
                type: 'drum',
                instrument: hit.instrument
            });
        }
    }

    return notes;
}


// === AUDIO SYNTHESIS & PROCESSING ===

function adsr(t, attack, decay, sustainLevel, releaseTime, duration) {
    if (t < 0) return 0;
    if (t < attack) {
        return t / attack;
    }
    t -= attack;
    if (t < decay) {
        return 1.0 - (1.0 - sustainLevel) * (t / decay);
    }
    t -= decay;
    const sustainTime = duration - attack - decay - releaseTime;
    if (t < sustainTime) {
        return sustainLevel;
    }
    t -= sustainTime;
    if (t < releaseTime) {
        return sustainLevel * (1.0 - t / releaseTime);
    }
    return 0;
}


function renderNote(note) {
    const noteSamples = new Float32Array(Math.ceil(note.duration * sampleRate));
    for (let i = 0; i < noteSamples.length; i++) {
        const t = i / sampleRate;
        const envelope = adsr(t, 0.05, 0.1, 0.7, 0.2, note.duration);
        let sampleValue = 0;
        
        switch (note.type) {
            case 'synthesizer':
                sampleValue = (Math.sin(2 * Math.PI * note.freq * t) + Math.sin(2 * Math.PI * note.freq * 2 * t) * 0.5) / 2;
                break;
            case 'piano': // Simplified piano-like sound
                 sampleValue = Math.sin(2 * Math.PI * note.freq * t) * Math.exp(-t * 4);
                 sampleValue += Math.sin(2 * Math.PI * note.freq * 2 * t) * Math.exp(-t * 5) * 0.5;
                 sampleValue /= 1.5;
                break;
            case 'organ': // Simplified organ-like sound
                sampleValue = [1, 0.5, 0.25].reduce((acc, amp, i) => acc + Math.sin(2 * Math.PI * note.freq * (i+1) * t) * amp, 0) / 1.75;
                break;
            case 'bass guitar':
                sampleValue = Math.sin(2 * Math.PI * note.freq * t) * Math.exp(-t * 2);
                break;
        }
        noteSamples[i] = sampleValue * envelope * note.velocity;
    }
    return noteSamples;
}

function mix(buffer, samples, startSample) {
    for (let i = 0; i < samples.length; i++) {
        if (startSample + i < buffer.length) {
            buffer[startSample + i] += samples[i];
        }
    }
}

// === MAIN WORKER LOGIC ===

function generateAudioChunk() {
    if (!isGenerating) return;

    const chunkSamples = Math.ceil(CHUNK_DURATION * sampleRate);
    const chunkBuffer = new Float32Array(chunkSamples);

    let allNotes = [];
    if (instruments.solo !== 'none') allNotes.push(...generatePart(0, CHUNK_DURATION, 'solo'));
    if (instruments.accompaniment !== 'none') allNotes.push(...generatePart(0, CHUNK_DURATION, 'accompaniment'));
    if (instruments.bass !== 'none') allNotes.push(...generatePart(0, CHUNK_DURATION, 'bass'));
    if (drumsEnabled && samplesLoaded) allNotes.push(...generateDrums(0, CHUNK_DURATION));
    
    for (const note of allNotes) {
        const startSample = Math.floor(note.time * sampleRate);
        if (note.type === 'drum' && SAMPLES[note.instrument]) {
             mix(chunkBuffer, SAMPLES[note.instrument], startSample);
        } else {
             const noteAudio = renderNote(note);
             mix(chunkBuffer, noteAudio, startSample);
        }
    }

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkBuffer,
            duration: CHUNK_DURATION
        }
    }, [chunkBuffer.buffer]);

    generatedTime += CHUNK_DURATION;

    const nextGenerationDelay = Math.max(0, (lastGenerationTime + CHUNK_DURATION * 1000 * 0.9) - performance.now());
    scheduleTimeoutId = setTimeout(generateAudioChunk, nextGenerationDelay);
    lastGenerationTime = performance.now();
}

self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'start':
            if (isGenerating) return;
            isGenerating = true;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            sampleRate = data.sampleRate;
            generatedTime = 0;
            
            self.postMessage({ type: 'generation_started' });
            lastGenerationTime = performance.now();
            generateAudioChunk();
            break;
        case 'stop':
            isGenerating = false;
            if (scheduleTimeoutId) {
                clearTimeout(scheduleTimeoutId);
                scheduleTimeoutId = null;
            }
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
        case 'load_samples':
            SAMPLES.kick = data.kick;
            SAMPLES.snare = data.snare;
            SAMPLES.hat = data.hat;
            samplesLoaded = true;
            self.postMessage({ type: 'samples_loaded' });
            break;
    }
};


// public/workers/ambient.worker.js

// --- State ---
let sampleRate = 44100;
let samples = {};
let instruments = {
    solo: 'none',
    accompaniment: 'none',
    bass: 'none'
};
let drumsEnabled = true;

let isRunning = false;
let sequencePosition = 0;
const bpm = 60;
const beatsPerMeasure = 4;
const measuresPerSequence = 4; // 4-bar loop for drums
const samplesPerBeat = () => (60 / bpm) * sampleRate;
const sequenceDurationInSamples = () => measuresPerSequence * beatsPerMeasure * samplesPerBeat();

// --- Oscillators & Synthesis ---
const noteFrequencies = {
    'E2': 82.41,
    'G2': 98.00,
    'A2': 110.00,
    'B2': 123.47,
    'C3': 130.81,
    'D3': 146.83,
    'E3': 164.81,
};

function sineWave(t, freq) {
    return Math.sin(2 * Math.PI * freq * t);
}

function createAdsrEnvelope(sampleRate, attack, decay, sustainLevel, release) {
    const attackSamples = Math.floor(attack * sampleRate);
    const decaySamples = Math.floor(decay * sampleRate);
    const releaseSamples = Math.floor(release * sampleRate);

    return (sample, totalSamples) => {
        if (sample < attackSamples) {
            return sample / attackSamples; // Attack phase
        }
        if (sample < attackSamples + decaySamples) {
            const decayProgress = (sample - attackSamples) / decaySamples;
            return 1.0 - (1.0 - sustainLevel) * decayProgress; // Decay phase
        }
        if (sample < totalSamples - releaseSamples) {
            return sustainLevel; // Sustain phase
        }
        const releaseProgress = (sample - (totalSamples - releaseSamples)) / releaseSamples;
        return sustainLevel * (1.0 - releaseProgress); // Release phase
    };
}

const bassEnvelope = createAdsrEnvelope(44100, 0.01, 0.1, 0.8, 0.2);


// --- Music Generation Logic ---
function getDrumSample(type, positionInSequence) {
    if (!drumsEnabled || !samples[type]) return 0;
    
    const samplesPerSeq = sequenceDurationInSamples();
    const positionInBeat = (positionInSequence % samplesPerBeat()) / samplesPerBeat();
    
    let pattern = [];
    
    // 4-bar loop
    const measure = Math.floor(positionInSequence / (beatsPerMeasure * samplesPerBeat()));
    const beatInMeasure = Math.floor((positionInSequence % (beatsPerMeasure * samplesPerBeat())) / samplesPerBeat());

    switch (type) {
        case 'kick':
            // on beats 1 and 3
            pattern = [0, 2];
            if (pattern.includes(beatInMeasure)) {
                 const sampleIndex = Math.floor(positionInBeat * samples[type].length);
                 if (sampleIndex < samples[type].length) return samples[type][sampleIndex] * 0.5; // Quieter kick
            }
            break;
        case 'snare':
            // on beats 2 and 4
            pattern = [1, 3];
            if (pattern.includes(beatInMeasure)) {
                 const sampleIndex = Math.floor(positionInBeat * samples[type].length);
                 if (sampleIndex < samples[type].length) return samples[type][sampleIndex] * 0.4;
            }
            break;
        case 'hat':
            // every 8th note
            const sixteenthsPerBeat = 4;
            const positionInSixteenths = Math.floor(positionInBeat * sixteenthsPerBeat);
             // Play on 0, 1, 2, 3 (every 16th of the beat)
            if (positionInSixteenths < sixteenthsPerBeat) {
                 const sampleIndex = Math.floor((positionInBeat * sixteenthsPerBeat - positionInSixteenths) * samples.hat.length);
                 if (sampleIndex < samples.hat.length) return samples.hat[sampleIndex] * 0.2;
            }
            break;
        case 'tom1':
        case 'tom2':
        case 'tom3':
             // Tom fill at the end of the 4th measure
            if (measure === 3 && beatInMeasure === 3) {
                 const sixteenthOfBeat = Math.floor(positionInBeat * 4); // 0, 1, 2, 3
                 if (type === 'tom1' && sixteenthOfBeat === 0) {
                     const sampleIndex = Math.floor((positionInBeat * 4 - sixteenthOfBeat) * samples.tom1.length);
                     if(sampleIndex < samples.tom1.length) return samples.tom1[sampleIndex] * 0.6;
                 }
                 if (type === 'tom2' && sixteenthOfBeat === 1) {
                     const sampleIndex = Math.floor((positionInBeat * 4 - sixteenthOfBeat) * samples.tom2.length);
                     if(sampleIndex < samples.tom2.length) return samples.tom2[sampleIndex] * 0.6;
                 }
                 if (type === 'tom3' && sixteenthOfBeat === 2) {
                     const sampleIndex = Math.floor((positionInBeat * 4 - sixteenthOfBeat) * samples.tom3.length);
                      if(sampleIndex < samples.tom3.length) return samples.tom3[sampleIndex] * 0.6;
                 }
            }
            break;
    }
    return 0;
}


function getBassNote(positionInSequence) {
    if (instruments.bass !== 'bass guitar') return 0;
    
    // Play on the first beat of every measure
    const beatInMeasure = Math.floor((positionInSequence % (beatsPerMeasure * samplesPerBeat())) / samplesPerBeat());
    const positionInBeatSamples = positionInSequence % samplesPerBeat();
    const timeInBeat = positionInBeatSamples / sampleRate;

    if (beatInMeasure === 0) { // Play on beat 1
        const freq = noteFrequencies['E2'];
        const envelope = bassEnvelope(positionInBeatSamples, samplesPerBeat());
        return sineWave(timeInBeat, freq) * envelope * 0.15; // Quieter bass
    }

    return 0;
}

// --- Main Audio Generation ---
function generateAudioChunk(chunkSize) {
    const chunk = new Float32Array(chunkSize);

    for (let i = 0; i < chunkSize; i++) {
        const currentSamplePosition = sequencePosition + i;
        
        let finalSample = 0;

        // Drums
        if(drumsEnabled) {
            finalSample += getDrumSample('kick', currentSamplePosition);
            finalSample += getDrumSample('snare', currentSamplePosition);
            finalSample += getDrumSample('hat', currentSamplePosition);
            finalSample += getDrumSample('tom1', currentSamplePosition);
            finalSample += getDrumSample('tom2', currentSamplePosition);
            finalSample += getDrumSample('tom3', currentSamplePosition);
        }

        // Bass
        if(instruments.bass === 'bass guitar') {
            finalSample += getBassNote(currentSamplePosition);
        }

        chunk[i] = finalSample;
    }
    
    sequencePosition = (sequencePosition + chunkSize) % sequenceDurationInSamples();

    return chunk;
}

// --- Worker Message Handling ---
let intervalId = null;

function start() {
    if (isRunning) return;
    isRunning = true;
    sequencePosition = 0;
    
    const chunkSize = 2048; 
    const intervalTime = (chunkSize / sampleRate) * 1000;

    const sendChunk = () => {
        if (!isRunning) return;
        const chunk = generateAudioChunk(chunkSize);
        self.postMessage({
            type: 'chunk',
            data: {
                chunk: chunk,
                duration: chunkSize / sampleRate
            }
        }, [chunk.buffer]);
    };
    
    // Initial pre-buffer
    for(let i=0; i<10; i++) {
        sendChunk();
    }
    
    intervalId = setInterval(sendChunk, intervalTime);
}


function stop() {
    if (!isRunning) return;
    isRunning = false;
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            samples = data;
             // The main thread will call 'start' after this.
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            sampleRate = data.sampleRate;
            instruments = data.instruments;
            drumsEnabled = data.drumsEnabled;
            start();
            break;
        case 'stop':
            stop();
            break;
        case 'set_instruments':
            instruments = data;
            break;
        case 'toggle_drums':
            drumsEnabled = data.enabled;
            break;
    }
};

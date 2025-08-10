
// A rough sine wave generator
function sineWave(frequency, amplitude, phase, sampleRate, duration) {
    const buffer = new Float32Array(Math.floor(sampleRate * duration));
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.sin(2 * Math.PI * frequency * (i / sampleRate) + phase) * amplitude;
    }
    return buffer;
}


// A simple synthesizer that can generate basic waveforms
const synthesizer = {
    generate(note, duration, type = 'sine', sampleRate) {
        const frequency = 440 * Math.pow(2, (note - 69) / 12);
        let wave;
        switch (type) {
            case 'sine':
                wave = sineWave(frequency, 0.5, 0, sampleRate, duration);
                break;
            // Add other waveform types here
            default:
                wave = sineWave(frequency, 0.5, 0, sampleRate, duration);
        }

        // Apply a simple envelope
        for (let i = 0; i < wave.length; i++) {
            const progress = i / wave.length;
            if (progress < 0.1) {
                wave[i] *= progress / 0.1; // Attack
            } else {
                wave[i] *= (1 - (progress - 0.1) / 0.9); // Decay/Release
            }
        }

        return wave;
    }
};

const drumSamples = {};
let sampleRate = 44100; // Default, will be updated by main thread
let tempo = 120;
let isRunning = false;
let generationIntervalId = null;

const state = {
    instruments: {
        solo: 'none',
        accompaniment: 'none',
        bass: 'none',
    },
    drumsEnabled: true,
    barCount: 0,
};

// A very simple procedural drum sequencer
function drumSequencer(bar, sixteenths) {
    const output = new Float32Array(sixteenths.length);

    function mix(sample, gain = 1.0) {
        if (!sample) return;
        for (let i = 0; i < sixteenths.length && i < sample.length; i++) {
            output[i] += sample[i] * gain;
        }
    }

    for (let i = 0; i < 16; i++) {
        let sound = null;
        let gain = 1.0;
        
        // Crash on the first beat of every 8th bar
        if (state.barCount % 8 === 0 && i === 0) {
            sound = drumSamples.crash;
            gain = 0.5;
        } 
        // Ride pattern on quarter notes
        else if (i % 4 === 0) {
            sound = drumSamples.ride;
            gain = 0.3 + (Math.random() * 0.1);
        }

        // Kick on 1 and 3
        if (i % 8 === 0) {
            sound = drumSamples.kick;
            gain = 0.9 + Math.random() * 0.1;
        }

        // Snare on 2 and 4
        if ((i - 4) % 8 === 0) {
            sound = drumSamples.snare;
            gain = 0.7 + Math.random() * 0.1;
        }
        
        // Basic hi-hat pattern
        if (i % 2 === 0) { // eighth notes
             sound = drumSamples.hat;
             gain = (i % 4 === 0) ? 0.4 : 0.2; // Accent downbeats
        }
        
        // Random ghost notes for snare
        if (Math.random() < 0.1 && i % 4 !== 0) {
            sound = drumSamples.snare;
            gain = Math.random() * 0.1;
        }
        
        // Fills at the end of every 4th bar
        if (state.barCount % 4 === 3 && i > 11) {
            if (Math.random() < 0.6) {
                 sound = Math.random() < 0.5 ? drumSamples.snare : drumSamples.hat;
                 gain = Math.random() * 0.4;
            }
        }

        if (sound) {
            const start = Math.floor(sixteenths[i]);
            for (let j = 0; j < sound.length && start + j < output.length; j++) {
                output[start + j] += sound[j] * gain;
            }
        }
    }
    
    state.barCount++;
    return output;
}

// Generate one chunk of music (e.g., one bar)
function generateChunk() {
    if (!isRunning) return;

    const chunkDuration = (60 / tempo) * 4; // 4 beats per bar
    const numSamples = Math.floor(sampleRate * chunkDuration);
    const chunkBuffer = new Float32Array(numSamples).fill(0);
    
    const sixteenthDuration = chunkDuration / 16;
    const sixteenthsInSamples = Array.from({length: 16}, (_, i) => i * sixteenthDuration * sampleRate);

    // Generate drum part
    if (state.drumsEnabled && Object.keys(drumSamples).length > 0) {
        const drumPart = drumSequencer(state.barCount, sixteenthsInSamples);
        for(let i = 0; i < drumPart.length && i < chunkBuffer.length; i++) {
            chunkBuffer[i] += drumPart[i] * 0.8; // Mix drums at 80% volume
        }
    }

    // Generate synth parts (placeholder)
    // Here you would generate notes for solo, accompaniment, bass
    // based on some musical logic (scales, chords, etc.)

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: chunkBuffer,
            duration: chunkDuration,
        }
    }, [chunkBuffer.buffer]);
}


self.onmessage = function(e) {
    const { command, data } = e.data;

    switch (command) {
        case 'load_samples':
            for (const key in data) {
                if (Object.hasOwnProperty.call(data, key)) {
                    drumSamples[key] = data[key];
                }
            }
            break;
        case 'start':
            if (isRunning) return;
            sampleRate = data.sampleRate;
            state.instruments = data.instruments;
            state.drumsEnabled = data.drumsEnabled;
            isRunning = true;
            state.barCount = 0;

            self.postMessage({ type: 'generation_started' });
            
            // Start generating immediately, then set an interval
            generateChunk();
            const chunkDuration = (60.0 / tempo) * 4;
            generationIntervalId = setInterval(generateChunk, chunkDuration * 1000);
            break;

        case 'stop':
            if (!isRunning) return;
            isRunning = false;
            if (generationIntervalId) {
                clearInterval(generationIntervalId);
                generationIntervalId = null;
            }
            break;
        
        case 'set_instruments':
            state.instruments = data;
            break;
        
        case 'toggle_drums':
            state.drumsEnabled = data.enabled;
            break;
    }
};

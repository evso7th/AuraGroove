import { DrumMachine } from './drum-machine.js';
import { Instrument } from './instrument.js';

let context = null;
const instruments = {};
const drumMachine = new DrumMachine();

function mixFinalBuffer(buffers, chunkDurationSeconds) {
    if (!context || buffers.length === 0) {
        return new Float32Array(0);
    }
    const chunkSampleCount = Math.floor(chunkDurationSeconds * context.sampleRate);
    const finalMix = new Float32Array(chunkSampleCount).fill(0);

    let activeBuffers = 0;
    for (const buffer of buffers) {
        if (buffer && buffer.length > 0) {
            activeBuffers++;
            for (let i = 0; i < chunkSampleCount; i++) {
                if(buffer[i] !== undefined) {
                   finalMix[i] += buffer[i];
                }
            }
        }
    }

    if (activeBuffers > 0) {
        for (let i = 0; i < chunkSampleCount; i++) {
            finalMix[i] /= activeBuffers;
        }
    }

    return finalMix;
}


function generateMusicChunk(config, chunkDurationSeconds) {
    if (!context) return;

    const activeInstrumentKeys = Object.keys(config.instruments).filter(key => config.instruments[key] !== 'none');
    
    const buffersToMix = [];

    activeInstrumentKeys.forEach(key => {
        const instrumentType = config.instruments[key];
        if (instrumentType && instrumentType !== 'none') {
            if (!instruments[key] || instruments[key].instrumentType !== instrumentType) {
                instruments[key] = new Instrument(instrumentType, context.sampleRate);
            }
            const buffer = instruments[key].generate(chunkDurationSeconds);
            buffersToMix.push(buffer);
        }
    });

    if (config.drumsEnabled) {
        const drumBuffer = drumMachine.generate(chunkDurationSeconds);
        buffersToMix.push(drumBuffer);
    }

    const mixedBuffer = mixFinalBuffer(buffersToMix, chunkDurationSeconds);

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: mixedBuffer,
            duration: chunkDurationSeconds
        }
    }, [mixedBuffer.buffer]);
}

let generationInterval = null;

self.onmessage = (event) => {
    const { command, data } = event.data;

    if (command === 'load_samples') {
        context = { sampleRate: data.sampleRate };
        drumMachine.loadSamples(data.samples, data.sampleRate);
        self.postMessage({ type: 'samples_loaded' });
    } else if (command === 'start') {
        if (generationInterval) {
            clearInterval(generationInterval);
        }
        const chunkDurationSeconds = 2;
        generationInterval = setInterval(() => {
            generateMusicChunk(data, chunkDurationSeconds);
        }, chunkDurationSeconds * 1000 * 0.9); // Generate slightly faster to avoid gaps
    } else if (command === 'stop') {
        if (generationInterval) {
            clearInterval(generationInterval);
            generationInterval = null;
        }
    } else if (command === 'set_instruments') {
        // This command will be handled by the main generation loop
        // as it reads the config on each iteration.
    } else if (command === 'toggle_drums') {
         // This command will be handled by the main generation loop
    }
};

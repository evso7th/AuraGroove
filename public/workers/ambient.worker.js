
import { DrumMachine } from './drum-machine.js';
import { Instrument } from './instrument.js';

let drumMachine = null;
let instruments = {};
let isRunning = false;
let sampleRate = 44100;
let nextTickTime = 0;
const TICK_INTERVAL = 0.5; // seconds
const CHUNK_DURATION = TICK_INTERVAL;

function generateAudioChunk() {
    if (!isRunning) return;

    const chunkEndTime = nextTickTime + CHUNK_DURATION;
    let combinedChunk = new Float32Array(Math.floor(CHUNK_DURATION * sampleRate)).fill(0);

    // Generate drum chunk if enabled
    if (drumMachine && drumMachine.isEnabled) {
        const drumChunk = drumMachine.generate(nextTickTime, chunkEndTime, sampleRate);
        for (let i = 0; i < drumChunk.length; i++) {
            combinedChunk[i] += drumChunk[i];
        }
    }
    
    // Generate instrument chunks
    for (const key in instruments) {
        const instrument = instruments[key];
        if (instrument.type !== 'none') {
            const instrumentChunk = instrument.generate(nextTickTime, chunkEndTime, sampleRate);
            for (let i = 0; i < instrumentChunk.length; i++) {
                combinedChunk[i] += instrumentChunk[i];
            }
        }
    }

    self.postMessage({
        type: 'chunk',
        data: {
            chunk: combinedChunk,
            duration: CHUNK_DURATION,
        },
    }, [combinedChunk.buffer]);
    
    nextTickTime = chunkEndTime;
}

function start() {
    if (isRunning) return;
    isRunning = true;
    nextTickTime = 0; // Reset time on start
    
    // Use a more robust timer loop
    function loop() {
        if (!isRunning) return;
        generateAudioChunk();
        setTimeout(loop, TICK_INTERVAL * 1000);
    }
    loop();
}

function stop() {
    isRunning = false;
}

self.onmessage = (event) => {
    const { command, data } = event.data;

    switch (command) {
        case 'load_samples':
            drumMachine = new DrumMachine(data);
            self.postMessage({ type: 'samples_loaded' });
            break;
        case 'start':
            sampleRate = data.sampleRate;
            if (drumMachine) {
                drumMachine.setEnabled(data.drumsEnabled);
            }
            instruments['solo'] = new Instrument(data.instruments.solo);
            instruments['accompaniment'] = new Instrument(data.instruments.accompaniment);
            instruments['bass'] = new Instrument(data.instruments.bass);
            start();
            break;
        case 'stop':
            stop();
            break;
        case 'toggle_drums':
             if (drumMachine) {
                drumMachine.setEnabled(data.enabled);
            }
            break;
        case 'set_instruments':
            instruments['solo'] = new Instrument(data.solo);
            instruments['accompaniment'] = new Instrument(data.accompaniment);
            instruments['bass'] = new Instrument(data.bass);
            break;
    }
};

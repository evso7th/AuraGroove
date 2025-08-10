
import { AmbientMusicGenerator } from './generators/AmbientMusicGenerator.js';

let generator;
let audioChunkInterval;

self.onmessage = (event) => {
    const { command, data } = event.data;

    if (command === 'load_samples') {
        // In this architecture, samples are decoded and handled by the generator.
        // We just need to signal back that the worker is ready.
        // The actual sample data is used when creating the generator instance.
        if (!generator) {
            generator = new AmbientMusicGenerator(data, data.sampleRate);
        }
        self.postMessage({ type: 'samples_loaded' });

    } else if (command === 'start') {
        if (!generator) {
             // Fallback if start is called before load_samples, using provided sampleRate
            generator = new AmbientMusicGenerator({}, data.sampleRate || 44100);
        }
        
        generator.setInstruments(data.instruments);
        generator.setDrums(data.drumsEnabled);
        
        const chunkDuration = 1.0; // 1 second chunks
        
        const sendChunk = () => {
            if (generator) {
                const chunk = generator.generateAudioChunk(chunkDuration);
                self.postMessage({
                    type: 'chunk',
                    data: {
                        chunk: chunk,
                        duration: chunkDuration
                    }
                }, [chunk.buffer]);
            }
        };
        
        // Stop any existing interval
        if (audioChunkInterval) {
            clearInterval(audioChunkInterval);
        }
        
        // Start generating immediately and then on an interval
        sendChunk(); 
        audioChunkInterval = setInterval(sendChunk, chunkDuration * 1000);

    } else if (command === 'stop') {
        if (audioChunkInterval) {
            clearInterval(audioChunkInterval);
            audioChunkInterval = null;
        }
        if (generator) {
            generator.reset();
        }

    } else if (command === 'set_instruments') {
        if (generator) {
            generator.setInstruments(data);
        }
    } else if (command === 'toggle_drums') {
        if (generator) {
            generator.setDrums(data.enabled);
        }
    }
};

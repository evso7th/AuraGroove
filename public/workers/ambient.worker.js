
import { AmbientMusicGenerator } from './generators/AmbientMusicGenerator.js';

let generator;
let audioChunkInterval;
let isRunning = false;
let decodedSamples = {};

const commands = {
  load_samples: (data) => {
    decodedSamples = data;
    self.postMessage({ type: 'samples_loaded' });
  },
  
  start: (data) => {
    if (isRunning) return;
    
    const { instruments, drumsEnabled, sampleRate } = data;
    generator = new AmbientMusicGenerator(sampleRate, decodedSamples, instruments, drumsEnabled);
    isRunning = true;
    
    const sendChunk = () => {
      if (!isRunning || !generator) return;

      const soloPart = generator.generateSoloPart();
      const accompanimentPart = generator.generateAccompanimentPart();
      const bassPart = generator.generateBassPart();
      const drumPart = generator.generateDrumsPart();

      const allParts = [soloPart, accompanimentPart, bassPart, drumPart].filter(p => p);
      if (allParts.length === 0) {
        // If all instruments are 'none', we still need to send something to keep time
        const duration = 4.0; // Assume a default duration for an empty chunk
        const emptyChunk = new Float32Array(Math.floor(generator.sampleRate * duration));
         self.postMessage({
          type: 'chunk',
          data: {
            chunk: emptyChunk,
            duration: duration,
          },
        }, [emptyChunk.buffer]);
        return;
      }
      
      const firstPart = allParts[0];
      const chunkDuration = firstPart.length / generator.sampleRate;
      const finalChunk = new Float32Array(firstPart.length);

      // Mix all parts together
      for (const part of allParts) {
         if (part && part.length === finalChunk.length) {
          for (let i = 0; i < finalChunk.length; i++) {
            finalChunk[i] += part[i];
          }
        }
      }

      // Normalize audio to prevent clipping
      let max = 0;
      for (let i = 0; i < finalChunk.length; i++) {
        max = Math.max(max, Math.abs(finalChunk[i]));
      }
      if (max > 1) {
        for (let i = 0; i < finalChunk.length; i++) {
          finalChunk[i] /= max;
        }
      }
      
      self.postMessage({
        type: 'chunk',
        data: {
          chunk: finalChunk,
          duration: chunkDuration,
        },
      }, [finalChunk.buffer]);
    };

    sendChunk(); // Send the first chunk immediately
    audioChunkInterval = setInterval(sendChunk, 3800); // Subsequent chunks
  },

  stop: () => {
    if (!isRunning) return;
    isRunning = false;
    if (audioChunkInterval) {
      clearInterval(audioChunkInterval);
      audioChunkInterval = null;
    }
    generator = null;
  },

  set_instruments: (data) => {
    if (generator) {
      generator.setInstruments(data);
    }
  },

  toggle_drums: (data) => {
    if (generator) {
      generator.setDrums(data.enabled);
    }
  }
};

self.onmessage = (event) => {
  const { command, data } = event.data;
  if (commands[command]) {
    commands[command](data);
  } else {
    self.postMessage({ type: 'error', error: `Unknown command: ${command}` });
  }
};

// Minimal worker for debugging decodeAudioData
self.onmessage = async function(e) {
  const { command, data } = e.data;

  if (command === 'test_decode') {
    console.log('Worker received test_decode command.');
    if (!data || !data.arrayBuffer) {
        self.postMessage({ type: 'decode_error', message: 'No ArrayBuffer received.' });
        return;
    }
    
    if (typeof self.decodeAudioData !== 'function') {
        self.postMessage({ type: 'decode_error', message: 'self.decodeAudioData is not a function in this worker context.' });
        return;
    }

    try {
      const audioBuffer = await self.decodeAudioData(data.arrayBuffer);
      self.postMessage({ type: 'decode_success', message: `Audio decoded successfully! Duration: ${audioBuffer.duration}` });
    } catch (error) {
      self.postMessage({ type: 'decode_error', message: `Decode failed: ${error.message}` });
    }
  }
};

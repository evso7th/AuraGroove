// public/worklets/synth-processor.js

class SynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.frequency = 440;
    this.velocity = 0;
    this.isActive = false;
    
    // Envelope
    this.attack = 0.01;
    this.release = 0.1;
    this.gain = 0;
    this.targetGain = 0;

    // Filter
    this.filterCutoff = 20000;
    this.filterQ = 1;
    this.filterCoeff = 1;
    this.filterState = 0;

    this.oscType = 'sine';
    this.sampleRate = sampleRate;

    this.port.onmessage = (event) => {
      console.log('[Worklet] Received message:', event.data);
      const { type, when, ...params } = event.data;
      switch (type) {
        case 'noteOn':
          console.log('[Worklet] noteOn params:', params);
          this.frequency = params.frequency;
          this.attack = params.attack || 0.01;
          this.release = params.release || 0.1;
          this.filterCutoff = params.filterCutoff || 20000;
          this.oscType = params.oscType || 'sine';
          this.velocity = params.velocity || 0.8;
          this.targetGain = this.velocity;
          this.isActive = true;
          break;
        case 'noteOff':
          this.targetGain = 0;
          break;
      }
    };
  }

  // Simple one-pole low-pass filter
  applyFilter(input) {
    this.filterState += this.filterCoeff * (input - this.filterState);
    return this.filterState;
  }

  // Waveform generator
  generateOsc() {
    switch (this.oscType) {
      case 'sine':
        return Math.sin(this.phase);
      case 'triangle':
        return 1 - 4 * Math.abs((this.phase / (2 * Math.PI)) - 0.5);
      case 'square':
        return this.phase < Math.PI ? 1 : -1;
      case 'sawtooth':
        return 1 - (this.phase / Math.PI);
      default:
        return Math.sin(this.phase);
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];

    this.filterCoeff = 1 - Math.exp(-2 * Math.PI * this.filterCutoff / this.sampleRate);
    
    if (!this.isActive && this.gain <= 0.0001) {
        // Optimization: if not active and silent, do nothing.
        return true;
    }

    for (let channel = 0; channel < output.length; ++channel) {
      for (let i = 0; i < output[channel].length; ++i) {
        let sample = 0;

        if (this.isActive || this.gain > 0) {
          this.phase += (this.frequency / this.sampleRate) * 2 * Math.PI;
          if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;

          sample = this.generateOsc();
          sample = this.applyFilter(sample);

          // Envelope
          if (this.gain < this.targetGain) {
            this.gain += 1 / (this.attack * this.sampleRate);
            if (this.gain > this.targetGain) this.gain = this.targetGain;
          } else if (this.gain > this.targetGain) {
            this.gain -= 1 / (this.release * this.sampleRate);
            if (this.gain < this.targetGain) this.gain = this.targetGain;
          }

          sample *= this.gain * 0.7; // Apply gain
        }

        output[channel][i] = sample;
      }
    }
    
    // Log state periodically
    if (this.isActive && Math.random() < 0.001) { // Log roughly once per process block
        console.log(`[Worklet Process] isActive: ${this.isActive}, gain: ${this.gain.toFixed(3)}, targetGain: ${this.targetGain}, freq: ${this.frequency.toFixed(1)}`);
    }

    if (this.gain <= 0.0001 && this.targetGain === 0) {
      this.isActive = false;
    }

    return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);

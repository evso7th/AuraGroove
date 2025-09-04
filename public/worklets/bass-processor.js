
// public/worklets/bass-processor.js

/**
 * A simplified bass synthesizer processor.
 * It only handles noteOn, noteOff, and preset changes.
 * All timing and scheduling is handled by the main thread.
 */
class BassProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.frequency = 0;
    this.isActive = false;

    // Default ADSR
    this.attack = 0.01;
    this.release = 0.1;
    this.gain = 0;
    this.targetGain = 0;
    
    // Default Filter
    this.filterState = 0;
    this.filterCutoff = 20000; // wide open by default
    this.filterCoeff = 1; // calculated from cutoff

    this.port.onmessage = (e) => {
        const { type, ...data } = e.data;
        switch(type) {
            case 'noteOn':
                this.frequency = data.frequency;
                this.targetGain = data.velocity || 0.7;
                this.isActive = true;
                break;
            case 'noteOff':
                this.targetGain = 0; // Start release phase
                break;
            case 'setPreset':
                this.attack = data.attack1 || 0.01;
                this.release = data.release1 || 0.1;
                this.filterCutoff = data.cutoff || 20000;
                // Add other preset params here if needed
                break;
            case 'setMode':
                 // Future implementation for different techniques
                break;
        }
    };
  }

  static get parameterDescriptors() {
    return []; // No custom AudioParams needed for this version
  }

  applyFilter(input) {
    this.filterState += this.filterCoeff * (input - this.filterState);
    return this.filterState;
  }

  generateOsc() {
      // Simple sine wave for bass
      return Math.sin(this.phase);
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    this.filterCoeff = 1 - Math.exp(-2 * Math.PI * this.filterCutoff / sampleRate);

    for (let channel = 0; channel < output.length; ++channel) {
      for (let i = 0; i < output[channel].length; ++i) {
        let sample = 0;

        if (this.isActive && this.frequency > 0) {
          this.phase += (this.frequency / sampleRate) * 2 * Math.PI;
          if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;

          sample = this.generateOsc();
          sample = this.applyFilter(sample);

          // Simple linear envelope
          if (this.gain < this.targetGain) {
            this.gain = Math.min(this.targetGain, this.gain + 1 / (this.attack * sampleRate));
          } else if (this.gain > this.targetGain) {
            this.gain = Math.max(this.targetGain, this.gain - 1 / (this.release * sampleRate));
          }

          if (this.gain <= 0.0001 && this.targetGain === 0) {
              this.isActive = false;
              this.gain = 0;
          }

          sample *= this.gain;
        }

        output[channel][i] = sample;
      }
    }

    return true; // Keep processor alive
  }
}

registerProcessor('bass-processor', BassProcessor);

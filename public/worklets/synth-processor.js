
class SynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.frequency = 0;
    this.isActive = false;
    
    // Envelope
    this.attackTime = 0.1;
    this.releaseTime = 0.5;
    this.gain = 0;
    this.targetGain = 0;

    // Filter
    this.filterState = 0;
    this.filterCutoff = 2000;
    this.filterCoeff = 0;

    this.port.onmessage = (event) => {
      const { type, frequency, when, duration, velocity } = event.data;
      if (type === 'noteOn') {
        this.frequency = frequency;
        this.targetGain = velocity || 0.8;
        this.isActive = true;

        if (duration) {
          // Schedule note off
          setTimeout(() => {
            // Check if it's still the same note
            if (this.frequency === frequency) {
              this.targetGain = 0;
            }
          }, (duration * 1000));
        }
      } else if (type === 'noteOff') {
        this.targetGain = 0;
      }
    };
  }

  // One-pole low-pass filter
  applyFilter(input, coeff) {
    this.filterState += coeff * (input - this.filterState);
    return this.filterState;
  }

  generateOsc() {
    // Triangle wave to reduce aliasing
    const t = this.phase / (2 * Math.PI);
    return 2 * (2 * Math.abs(t - 0.5) - 1);
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    // Update filter coefficient (can be done less often)
    const filterCoeff = 1 - Math.exp(-2 * Math.PI * this.filterCutoff / sampleRate);

    for (let channel = 0; channel < output.length; ++channel) {
      for (let i = 0; i < output[channel].length; ++i) {
        let sample = 0;

        if (this.isActive && this.frequency > 0) {
          this.phase += (this.frequency / sampleRate) * 2 * Math.PI;
          if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;
          
          sample = this.generateOsc();
          sample = this.applyFilter(sample, filterCoeff);

          // Simple AD envelope
          if (this.gain < this.targetGain) {
            this.gain += 1 / (this.attackTime * sampleRate);
            if (this.gain > this.targetGain) this.gain = this.targetGain;
          } else if (this.gain > this.targetGain) {
            this.gain -= 1 / (this.releaseTime * sampleRate);
            if (this.gain < 0) this.gain = 0;
          }
          
          sample *= this.gain * 0.5; // reduce volume
        }

        output[channel][i] = sample;
      }
    }
    
    // Deactivate if silent
    if (this.gain <= 0 && this.targetGain === 0) {
        this.isActive = false;
        this.frequency = 0;
    }

    return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);

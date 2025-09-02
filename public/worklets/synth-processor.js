
class SynthProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.frequency = 0;
    this.gain = 0;
    this.targetGain = 0;
    this.isActive = false;
    
    this.attack = 0.01;
    this.release = 0.3;
    this.sampleRate = sampleRate;

    // Filter state
    this.filterState = 0;
    this.filterCoeff = 0.1; // Default coefficient

    this.port.onmessage = ({ data }) => {
      if (data.type === 'noteOn') {
        this.frequency = data.frequency;
        this.targetGain = data.velocity || 0.8;
        this.isActive = true;
        this.gain = 0; // Reset gain on new note
      } else if (data.type === 'noteOff') {
        this.targetGain = 0;
      }
    };
  }

  // One-pole low-pass filter
  applyFilter(input) {
    this.filterState += this.filterCoeff * (input - this.filterState);
    return this.filterState;
  }

  // Generate a triangle wave (less CPU intensive and less aliasing than sawtooth)
  generateOsc() {
    return 1 - 4 * Math.abs(0.5 - (this.phase / (2 * Math.PI)));
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    for (let channel = 0; channel < output.length; ++channel) {
      for (let i = 0; i < output[channel].length; ++i) {
        let sample = 0;

        if (this.isActive && this.frequency > 0) {
          this.phase += (this.frequency / this.sampleRate) * 2 * Math.PI;
          if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;

          sample = this.generateOsc();
          sample = this.applyFilter(sample);

          // Envelope logic
          if (this.gain < this.targetGain) {
            this.gain += 1 / (this.attack * this.sampleRate);
            if (this.gain > this.targetGain) this.gain = this.targetGain;
          } else if (this.gain > this.targetGain) {
            this.gain -= 1 / (this.release * this.sampleRate);
            if (this.gain < 0) this.gain = 0;
          }
          
          sample *= this.gain * 0.5; // Apply gain (and a master volume)
        }
        
        if (this.gain <= 0.0001 && this.targetGain === 0) {
            this.isActive = false;
            this.frequency = 0;
        }
        
        output[channel][i] = sample;
      }
    }
    return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);

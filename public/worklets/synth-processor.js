
class SynthProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.phase = 0;
        this.gain = 0;
        this.targetGain = 0;
        
        // --- Synth Parameters with Defaults ---
        this.attack = 0.01;
        this.release = 0.1;
        this.oscType = 'triangle';
        this.filterCutoff = 20000;
        this.filterState = 0;
        this.filterCoeff = 1.0;

        // Portamento
        this.portamentoRate = 0.0; // 0 = off
        this.currentFrequency = 0;
        this.targetFrequency = 0;

        // State
        this.isActive = false;

        this.port.onmessage = this.handleMessage.bind(this);
    }

    handleMessage({ data }) {
        if (data.type === 'noteOn') {
            this.targetFrequency = data.frequency || 440;
            if (!this.isActive) { // If not active, jump to frequency
                 this.currentFrequency = this.targetFrequency;
            }
            this.attack = data.attack || 0.01;
            this.release = data.release || 0.1;
            this.portamentoRate = data.portamento || 0;
            this.filterCutoff = data.filterCutoff || 20000;
            this.oscType = data.oscType || 'triangle';
            
            this.targetGain = data.velocity || 1.0;
            this.isActive = true;

             // Update filter coefficient
            this.filterCoeff = 1 - Math.exp(-2 * Math.PI * this.filterCutoff / sampleRate);
        } else if (data.type === 'noteOff') {
            this.targetGain = 0;
        }
    }
    
    // Simple one-pole low-pass filter
    applyFilter(input) {
        this.filterState += this.filterCoeff * (input - this.filterState);
        return this.filterState;
    }

    // Oscillator waveform generation
    generateOsc() {
        switch (this.oscType) {
            case 'sawtooth':
                return 1 - (this.phase / Math.PI);
            case 'square':
                 return this.phase < Math.PI ? 1 : -1;
            case 'triangle':
            default:
                return Math.sin(this.phase); // Simple sine for triangle as a safe default
        }
    }

    process(inputs, outputs) {
        const output = outputs[0];
        const channel = output[0];
        
        for (let i = 0; i < channel.length; i++) {
            let sample = 0;
            if (this.isActive) {
                // Glide to target frequency
                if(this.portamentoRate > 0) {
                     this.currentFrequency += (this.targetFrequency - this.currentFrequency) * this.portamentoRate;
                } else {
                    this.currentFrequency = this.targetFrequency;
                }

                this.phase += (this.currentFrequency / sampleRate) * 2 * Math.PI;
                if (this.phase >= 2 * Math.PI) {
                    this.phase -= 2 * Math.PI;
                }
                
                sample = this.generateOsc();
                
                // ADSR envelope for gain
                if (this.gain < this.targetGain) {
                    this.gain = Math.min(this.targetGain, this.gain + 1.0 / (this.attack * sampleRate));
                } else if (this.gain > this.targetGain) {
                    this.gain = Math.max(this.targetGain, this.gain - 1.0 / (this.release * sampleRate));
                }

                sample = this.applyFilter(sample);

                channel[i] = sample * this.gain * 0.3; // Apply gain and reduce overall volume

                if (this.gain <= 0.001 && this.targetGain === 0) {
                    this.isActive = false;
                    this.currentFrequency = 0; // Reset frequency when note is fully released
                }
            } else {
                 channel[i] = 0;
            }
        }
        return true;
    }
}

registerProcessor('synth-processor', SynthProcessor);

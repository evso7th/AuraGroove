
class SynthProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.phase = 0;
        this.gain = 0;
        this.targetGain = 0;
        this.frequency = 440;
        this.attack = 0.01;
        this.release = 0.1;
        this.isActive = false;
        
        // Filter state
        this.filterState = 0;
        this.filterCoeff = 0;
        this.filterCutoff = 20000;

        this.port.onmessage = this.handleMessage.bind(this);
    }

    handleMessage({ data }) {
        if (data.type === 'noteOn') {
            this.frequency = data.frequency;
            this.targetGain = data.velocity || 0.8;
            this.attack = data.attack || 0.02;
            this.release = data.release || 0.3;
            this.isActive = true;
        } else if (data.type === 'noteOff') {
            this.targetGain = 0;
        }
    }
    
    applyFilter(input) {
        this.filterState += this.filterCoeff * (input - this.filterState);
        return this.filterState;
    }
    
    generateTriangle() {
        return 1 - 4 * Math.abs(0.5 - (this.phase / (2 * Math.PI)));
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        
        this.filterCoeff = 1 - Math.exp(-2 * Math.PI * this.filterCutoff / sampleRate);

        for (let channel = 0; channel < output.length; ++channel) {
            const outChannel = output[channel];
            for (let i = 0; i < outChannel.length; ++i) {
                let sample = 0;

                if (this.isActive && this.frequency > 0) {
                    // Phase increment
                    this.phase += (this.frequency / sampleRate) * 2 * Math.PI;
                    if (this.phase >= 2 * Math.PI) {
                        this.phase -= 2 * Math.PI;
                    }

                    sample = this.generateTriangle();
                    sample = this.applyFilter(sample);

                    // AD Envelope
                    if (this.gain < this.targetGain) {
                        this.gain += 1 / (this.attack * sampleRate);
                        if (this.gain > this.targetGain) this.gain = this.targetGain;
                    } else if (this.gain > this.targetGain) {
                        this.gain -= 1 / (this.release * sampleRate);
                        if (this.gain < 0) this.gain = 0;
                    }

                    sample *= this.gain * 0.5; // Final gain stage
                }
                
                outChannel[i] = sample;
            }
        }
        
        if (this.gain <= 0.0001 && this.targetGain === 0) {
            this.isActive = false;
            this.phase = 0;
        }

        return true;
    }
}

registerProcessor('synth-processor', SynthProcessor);

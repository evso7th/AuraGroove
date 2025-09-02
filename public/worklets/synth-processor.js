
/**
 * A simple, performant subtractive synthesizer running in an AudioWorklet.
 * It uses a triangle oscillator and a one-pole low-pass filter to be CPU-friendly.
 */
class SynthProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.phase = 0;
        this.frequency = 440;
        this.isActive = false;
        this.gain = 0;
        this.targetGain = 0;

        // Envelope
        this.attack = 0.01;
        this.release = 0.3;

        // Filter
        this.filterState = 0;
        this.filterCoeff = 0.99; // Initial cutoff
        
        this.port.onmessage = this.handleMessage.bind(this);
    }

    handleMessage(event) {
        const { data } = event;
        if (data.type === 'noteOn') {
            this.frequency = data.frequency;
            this.targetGain = data.velocity || 0.8;
            this.isActive = true;
            this.attack = data.attack || 0.02;
            this.release = data.release || 0.3;
        } else if (data.type === 'noteOff') {
            this.targetGain = 0;
        }
    }

    // A simple, cheap one-pole low-pass filter
    applyFilter(input) {
        // A simple LPF: y[n] = y[n-1] + coeff * (x[n] - y[n-1])
        this.filterState += this.filterCoeff * (input - this.filterState);
        return this.filterState;
    }

    generateOsc() {
        // Triangle wave is cheaper than band-limited sawtooth/square
        return 1 - 4 * Math.abs((this.phase / (2 * Math.PI)) - 0.5);
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        
        // Use a fixed low-pass filter cutoff for performance
        // This could be made a parameter later if needed.
        const filterCutoff = 1200;
        this.filterCoeff = 1 - Math.exp(-2 * Math.PI * filterCutoff / sampleRate);

        for (let channel = 0; channel < output.length; ++channel) {
            const outputChannel = output[channel];
            for (let i = 0; i < outputChannel.length; ++i) {
                let sample = 0;

                if (this.isActive && this.frequency > 0) {
                    // Update phase
                    this.phase += (this.frequency / sampleRate) * 2 * Math.PI;
                    if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;
                    
                    sample = this.generateOsc();

                    sample = this.applyFilter(sample);

                    // AD Envelope
                    if (this.gain < this.targetGain) { // Attack phase
                        this.gain += 1 / (this.attack * sampleRate);
                        if (this.gain > this.targetGain) this.gain = this.targetGain;
                    } else if (this.gain > this.targetGain) { // Release phase
                        this.gain -= 1 / (this.release * sampleRate);
                        if (this.gain < 0) this.gain = 0;
                    }

                    sample *= this.gain * 0.5; // Apply gain and reduce overall volume
                } else {
                    this.gain = 0;
                }
                
                outputChannel[i] = sample;
            }
        }

        // If gain is effectively zero after release, mark as inactive
        if (this.gain < 0.001 && this.targetGain === 0) {
            this.isActive = false;
        }

        return true;
    }
}

registerProcessor('synth-processor', SynthProcessor);

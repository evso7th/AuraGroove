
/**
 * @file Subtractive Synth AudioWorkletProcessor
 * 
 * This processor implements a simple, high-performance subtractive synthesizer voice.
 * It's designed to run in a separate audio thread, ensuring the main UI thread remains responsive.
 * It features a single oscillator, a one-pole low-pass filter, and a simple AD envelope.
 * 
 * Optimized based on expert recommendations for mobile devices:
 * - Uses a triangle wave to avoid aliasing issues of sawtooth/square waves.
 * - Implements a computationally cheap one-pole low-pass filter.
 * - Avoids all non-essential operations like complex math or logging in the `process` loop.
 */
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

        // One-pole LPF state
        this.filterState = 0;
        this.filterCoeff = 0.99;

        this.port.onmessage = ({ data }) => {
            if (data.type === 'noteOn') {
                this.frequency = data.frequency;
                this.attack = data.attack || 0.02;
                this.release = data.release || 0.3;
                this.targetGain = data.velocity || 0.7; // Target gain is now velocity
                this.isActive = true;
            } else if (data.type === 'noteOff') {
                this.targetGain = 0; // Start the release phase
            }
        };
    }

    // A simple, computationally cheap one-pole low-pass filter.
    applyFilter(input) {
        this.filterState += this.filterCoeff * (input - this.filterState);
        return this.filterState;
    }

    // Generates a triangle wave. It's band-limited and safer for performance than sawtooth.
    generateTriangleWave() {
        return 1 - 4 * Math.abs((this.phase / (2 * Math.PI)) - 0.5);
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];
        
        // Hard-coded low-pass filter cutoff at a pleasant frequency.
        // This is more performant than calculating it on the fly.
        this.filterCoeff = 1 - Math.exp(-2 * Math.PI * 1200 / sampleRate);

        for (let i = 0; i < channel.length; ++i) {
            let sample = 0;

            if (this.isActive) {
                // Advance oscillator phase
                this.phase += (this.frequency / sampleRate) * 2 * Math.PI;
                if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;
                
                sample = this.generateTriangleWave();
                sample = this.applyFilter(sample);

                // AD Envelope logic
                if (this.gain < this.targetGain) {
                    this.gain += (1 / (this.attack * sampleRate));
                    if (this.gain > this.targetGain) this.gain = this.targetGain;
                } else if (this.gain > this.targetGain) {
                    this.gain -= (1 / (this.release * sampleRate));
                    if (this.gain < 0) this.gain = 0;
                }
                
                sample *= this.gain * 0.5; // Apply gain and a master volume reduction
            }

            channel[i] = sample;
        }

        // If the note has faded out, mark the voice as inactive
        if (this.gain <= 0.001 && this.targetGain === 0) {
            this.isActive = false;
        }

        return true;
    }
}

registerProcessor('synth-processor', SynthProcessor);

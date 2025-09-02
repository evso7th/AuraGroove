
class Voice {
    constructor(sampleRate) {
        this.isActive = false;
        this.frequency = 0;
        this.phase = 0;
        this.gain = 0;
        this.targetGain = 0;
        this.attack = 0.01;
        this.release = 0.3;
        this.velocity = 0;
        this.sampleRate = sampleRate;

        // One-pole LPF state
        this.filterState = 0;
        this.filterCutoff = 2000;
        this.filterCoeff = 1.0;
        this.updateFilter(this.filterCutoff);
    }

    updateFilter(cutoff) {
        this.filterCutoff = cutoff;
        this.filterCoeff = 1 - Math.exp(-2 * Math.PI * this.filterCutoff / this.sampleRate);
    }

    triggerAttack(freq, vel, attack, release) {
        this.isActive = true;
        this.frequency = freq;
        this.velocity = vel;
        this.attack = Math.max(0.001, attack); // prevent division by zero
        this.release = Math.max(0.001, release);
        this.targetGain = 1;
        this.phase = 0;
    }

    triggerRelease() {
        this.targetGain = 0;
    }

    process() {
        if (!this.isActive) return 0;

        // Envelope
        if (this.gain < this.targetGain) {
            this.gain += 1 / (this.attack * this.sampleRate);
            if (this.gain > this.targetGain) this.gain = this.targetGain;
        } else if (this.gain > this.targetGain) {
            this.gain -= 1 / (this.release * this.sampleRate);
            if (this.gain <= 0) {
                this.gain = 0;
                this.isActive = false;
            }
        }
        if (!this.isActive) return 0;

        this.phase += (this.frequency / this.sampleRate) * 2 * Math.PI;
        if (this.phase >= 2 * Math.PI) this.phase -= 2 * Math.PI;

        const oscSample = 1 - 4 * Math.abs((this.phase / (2 * Math.PI)) - 0.5); // Triangle wave
        
        // Apply one-pole LPF
        this.filterState += this.filterCoeff * (oscSample - this.filterState);

        return this.filterState * this.gain * this.velocity * 0.3; // Final volume adjustment
    }
}


class SynthProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.voices = [];
        this.nextVoiceIndex = 0;
        const numVoices = 4; // Hard-coded to 4 for mobile safety
        for (let i = 0; i < numVoices; i++) {
            this.voices.push(new Voice(sampleRate));
        }

        this.port.onmessage = ({ data }) => {
            if (data.type === 'noteOn') {
                const voice = this.voices[this.nextVoiceIndex];
                // Simple voice stealing: always use the next voice in the round-robin.
                voice.triggerAttack(data.frequency, data.velocity, 0.02, 0.5);
                this.nextVoiceIndex = (this.nextVoiceIndex + 1) % this.voices.length;

                // The noteOff is scheduled from the main thread
            } else if (data.type === 'noteOff') {
                const voiceToEnd = this.voices.find(v => v.frequency === data.frequency && v.isActive && v.targetGain > 0);
                 if (voiceToEnd) {
                    voiceToEnd.triggerRelease();
                }
            }
        };
    }

    process(inputs, outputs) {
        const output = outputs[0];
        for (let channel = 0; channel < output.length; ++channel) {
            const outputChannel = output[channel];
            for (let i = 0; i < outputChannel.length; ++i) {
                let sample = 0;
                for (const voice of this.voices) {
                    sample += voice.process();
                }
                outputChannel[i] = sample;
            }
        }
        return true;
    }
}

registerProcessor('synth-processor', SynthProcessor);


// public/worklets/bass-processor.js

class Voice {
    constructor() {
        this.isActive = false;
        this.midi = 0;
        this.frequency = 0;
        this.currentFrequency = 0;
        this.targetGain = 0;
        this.gain = 0;
        this.phase = Math.random() * 2 * Math.PI;
        this.filterState = 0;
        this.portamentoRate = 0.05;
        this.attack = 0.01;
        this.release = 0.5;
    }
}


class BassProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.voices = [new Voice(), new Voice()]; // Two layers for bass
        this.wave = ['sine', 'sine'];
        this.cutoff = 800;
        this.filterQ = 0.7;
        this.distortion = 0;
        this.stagger = 0.01; // 10ms default stagger
        
        this.sampleRate = sampleRate;

        this.port.onmessage = (e) => {
            const { type, notes, when, ...params } = e.data;
            if (type === 'setPreset') {
                this.wave = [params.wave1, params.wave2 || params.wave1];
                this.cutoff = params.cutoff;
                this.filterQ = params.filterQ || 0.7;
                this.distortion = params.distortion || 0;
                this.stagger = params.stagger || 0.01;

                this.voices[0].attack = params.attack1;
                this.voices[0].release = params.release1;
                this.voices[0].portamentoRate = params.portamento1 || 0.05;
                
                this.voices[1].attack = params.attack2 || params.attack1;
                this.voices[1].release = params.release2 || params.release1;
                this.voices[1].portamentoRate = params.portamento2 || params.portamento1 || 0.05;

            } else if (type === 'playNotes') {
                const note = notes[0]; // Bass is monophonic
                if (!note) return;

                const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
                
                // Layer 1
                this.voices[0].frequency = freq;
                this.voices[0].targetGain = 1.0;
                this.voices[0].isActive = true;

                // Layer 2 with stagger
                setTimeout(() => {
                    this.voices[1].frequency = freq;
                    this.voices[1].targetGain = 1.0;
                    this.voices[1].isActive = true;
                }, this.stagger * 1000);


            } else if (type === 'noteOff') {
                this.voices.forEach(v => v.targetGain = 0);
            }
        };
    }

    generateOsc(phase, waveType) {
        switch (waveType) {
            case 'sine': return Math.sin(phase);
            case 'triangle': return 1 - 4 * Math.abs((phase / (2 * Math.PI)) - 0.5);
            case 'sawtooth': return 1 - (phase / Math.PI);
            default: return Math.sin(phase);
        }
    }

    process(inputs, outputs) {
        const output = outputs[0];
        const coeff = 1 - Math.exp(-2 * Math.PI * this.cutoff / this.sampleRate);

        for (let channel = 0; channel < output.length; channel++) {
            for (let i = 0; i < output[channel].length; i++) {
                let mixed = 0;

                for (let v = 0; v < this.voices.length; v++) {
                    const voice = this.voices[v];
                    if (!voice.isActive || voice.frequency <= 0) continue;

                     if (Math.abs(voice.currentFrequency - voice.frequency) > 1) {
                        voice.currentFrequency += (voice.frequency - voice.currentFrequency) * voice.portamentoRate;
                    } else {
                        voice.currentFrequency = voice.frequency;
                    }

                    voice.phase += (voice.currentFrequency / this.sampleRate) * 2 * Math.PI;
                    if (voice.phase >= 2 * Math.PI) voice.phase -= 2 * Math.PI;

                    let sample = this.generateOsc(voice.phase, this.wave[v]);
                    
                    if(this.distortion > 0) {
                        sample = Math.tanh(sample * (1 + this.distortion * 5));
                    }

                    voice.filterState += coeff * (sample - voice.filterState);
                    sample = voice.filterState;

                    if (voice.gain < voice.targetGain) {
                        voice.gain += 1 / (voice.attack * this.sampleRate);
                        if (voice.gain > voice.targetGain) voice.gain = voice.targetGain;
                    } else if (voice.gain > 0) {
                        voice.gain -= 1 / (voice.release * this.sampleRate);
                        if (voice.gain < 0) voice.gain = 0;
                    }
                    
                    if(voice.gain <= 0 && voice.targetGain === 0) {
                        voice.isActive = false;
                    }

                    mixed += sample * voice.gain;
                }

                output[channel][i] = mixed * 0.25; // Normalize to prevent clipping
            }
        }
        return true;
    }
}

registerProcessor('bass-processor', BassProcessor);

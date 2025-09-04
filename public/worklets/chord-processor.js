
// A polyphonic AudioWorklet processor for playing chords.
// It manages a pool of voices internally to play multiple notes at once.

class ChordProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.voices = [];
        this.MAX_VOICES = 4; // Can play up to 4 notes simultaneously
        this.delayQueue = [];
        this.waveType = 'triangle';
        this.cutoff = 1200;
        this.attack = 0.05;
        this.release = 0.5;
        this.portamento = 0; // 0 = off
        this.sampleRate = sampleRate;

        for (let i = 0; i < this.MAX_VOICES; i++) {
            this.voices.push(this.createVoice());
        }

        this.port.onmessage = this.handleMessage.bind(this);
    }

    createVoice() {
        return {
            midi: 0,
            frequency: 0,
            currentFrequency: 0,
            velocity: 0,
            gain: 0,
            targetGain: 0,
            phase: 0,
            isActive: false,
            filterState: 0,
            portamentoRate: 0.05,
            attack: this.attack,
            release: this.release
        };
    }

    handleMessage(event) {
        const { type, ...data } = event.data;

        if (type === 'playChord') {
            this.releaseAllVoices(); // Stop previous chord before starting a new one

            let sortedNotes = [...data.notes].sort((a, b) => a.midi - b.midi);
            if (data.direction === 'down') sortedNotes.reverse();
            if (data.direction === 'random') sortedNotes.sort(() => Math.random() - 0.5);

            sortedNotes.forEach((note, index) => {
                const voice = this.getAvailableVoice();
                if (voice) {
                    const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
                    voice.midi = note.midi;
                    voice.frequency = freq;
                    if(voice.currentFrequency === 0) voice.currentFrequency = freq;
                    voice.velocity = data.velocity || 0.7;
                    voice.targetGain = voice.velocity;
                    
                    const staggerDelay = (data.stagger || 0) * index * this.sampleRate;
                    if (staggerDelay > 0) {
                         voice.isActive = false;
                         this.delayQueue.push({ voice: voice, delay: staggerDelay });
                    } else {
                         voice.isActive = true;
                    }
                }
            });
        } else if (type === 'noteOff') {
            this.releaseAllVoices();
        } else if (type === 'setPreset') {
            this.waveType = data.wave || this.waveType;
            this.cutoff = data.cutoff || this.cutoff;
            this.attack = data.attack || this.attack;
            this.release = data.release || this.release;
            this.portamento = data.portamento || 0;
            this.voices.forEach(v => {
                v.attack = this.attack;
                v.release = this.release;
            });
        }
    }

    getAvailableVoice() {
        let voice = this.voices.find(v => !v.isActive && v.gain <= 0);
        if (!voice) {
            // If no voice is fully inactive, steal the one with the lowest gain.
            voice = this.voices.sort((a, b) => a.gain - b.gain)[0];
        }
        return voice;
    }
    
    releaseAllVoices() {
         this.voices.forEach(voice => {
            voice.targetGain = 0; // Start release phase
        });
        this.delayQueue = []; // Clear any pending notes
    }


    generateOsc(phase, type) {
        switch (type) {
            case 'sine':
                return Math.sin(phase);
            case 'square':
                return phase < Math.PI ? 1.0 : -1.0;
            case 'sawtooth':
                return 2.0 * (phase / (2 * Math.PI)) - 1.0;
            case 'triangle':
                return 1.0 - 4.0 * Math.abs(Math.round(phase / (2 * Math.PI)) - (phase / (2 * Math.PI)));
            default:
                return Math.sin(phase);
        }
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];

        // Handle delayed (arpeggiated) notes
        if (this.delayQueue) {
            for (let i = this.delayQueue.length - 1; i >= 0; i--) {
                const item = this.delayQueue[i];
                if (item.delay <= 0) {
                    item.voice.isActive = true;
                    this.delayQueue.splice(i, 1);
                } else {
                    item.delay--;
                }
            }
        }

        // Main generation loop
        for (let channel = 0; channel < output.length; channel++) {
            for (let i = 0; i < output[channel].length; i++) {
                let mixed = 0;

                for (const voice of this.voices) {
                    if (!voice.isActive || voice.frequency <= 0) {
                        if(voice.gain > 0){ // still in release phase
                           voice.gain -= 1 / (voice.release * this.sampleRate);
                           if (voice.gain < 0) voice.gain = 0;
                        } else {
                           continue;
                        }
                    }

                    // Portamento
                    if (this.portamento > 0 && Math.abs(voice.currentFrequency - voice.frequency) > 1) {
                         voice.currentFrequency += (voice.frequency - voice.currentFrequency) * this.portamento;
                    } else {
                        voice.currentFrequency = voice.frequency;
                    }

                    // Phase
                    voice.phase += (voice.currentFrequency / this.sampleRate) * 2 * Math.PI;
                    if (voice.phase >= 2 * Math.PI) voice.phase -= 2 * Math.PI;

                    let sample = this.generateOsc(voice.phase, this.waveType);

                    // Simple LPF
                    const coeff = 1 - Math.exp(-2 * Math.PI * this.cutoff / this.sampleRate);
                    voice.filterState += coeff * (sample - voice.filterState);
                    sample = voice.filterState;

                    // Envelope
                    if (voice.targetGain > 0 && voice.gain < voice.targetGain) {
                        voice.gain += 1 / (voice.attack * this.sampleRate);
                        if (voice.gain > voice.targetGain) voice.gain = voice.targetGain;
                    } else if (voice.targetGain === 0 && voice.gain > 0) {
                        voice.gain -= 1 / (voice.release * this.sampleRate);
                        if (voice.gain < 0) {
                            voice.gain = 0;
                            voice.isActive = false; // Voice is now free
                        }
                    }
                    
                    if (voice.gain > 0) {
                       mixed += sample * voice.gain;
                    }
                }

                output[channel][i] = mixed * 0.25; // Normalization for 4 voices
            }
        }
        return true;
    }
}

registerProcessor('chord-processor', ChordProcessor);

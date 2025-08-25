
// synth.worklet.ts
console.log("[WORKLET_TRACE] synth.worklet.ts script loading.");

// --- ADSR Envelope ---
class ADSREnvelope {
    constructor(options, sampleRate) {
        this.attackTime = options.attack || 0.01;
        this.decayTime = options.decay || 0.1;
        this.sustainLevel = options.sustain || 0.5;
        this.releaseTime = options.release || 0.2;
        this.sampleRate = sampleRate;

        this.attackSamples = this.attackTime * this.sampleRate;
        this.decaySamples = this.decayTime * this.sampleRate;
        this.releaseSamples = this.releaseTime * this.sampleRate;
        
        this.state = 'idle';
        this.value = 0.0;
        this.samplesProcessed = 0;
    }

    triggerAttack() {
        this.state = 'attack';
        this.samplesProcessed = 0;
    }

    triggerRelease() {
        this.state = 'release';
        this.samplesProcessed = 0;
    }

    process() {
        switch (this.state) {
            case 'attack':
                this.value = this.samplesProcessed / this.attackSamples;
                if (this.samplesProcessed >= this.attackSamples) {
                    this.state = 'decay';
                    this.samplesProcessed = 0;
                }
                break;
            case 'decay':
                this.value = 1.0 - (1.0 - this.sustainLevel) * (this.samplesProcessed / this.decaySamples);
                if (this.samplesProcessed >= this.decaySamples) {
                    this.state = 'sustain';
                }
                break;
            case 'sustain':
                this.value = this.sustainLevel;
                break;
            case 'release':
                this.value = this.sustainLevel * (1.0 - this.samplesProcessed / this.releaseSamples);
                if (this.samplesProcessed >= this.releaseSamples) {
                    this.state = 'idle';
                    this.value = 0.0;
                }
                break;
            case 'idle':
                this.value = 0.0;
                break;
        }
        
        this.samplesProcessed++;
        return Math.max(0, this.value); // Ensure value is not negative
    }
}

// --- Oscillator ---
class Oscillator {
    constructor(type, sampleRate) {
        this.type = type;
        this.sampleRate = sampleRate;
        this.phase = 0;
        this.phaseIncrement = 0;
    }

    setFrequency(freq) {
        this.phaseIncrement = (2 * Math.PI * freq) / this.sampleRate;
    }

    process() {
        let value = 0;
        switch (this.type) {
            case 'sine':
                value = Math.sin(this.phase);
                break;
            case 'sawtooth':
                value = (this.phase / Math.PI) - 1;
                break;
            case 'square':
                value = Math.sign(Math.sin(this.phase));
                break;
            // Simplified "fat" oscillators for performance
            case 'fatsine':
                value = (Math.sin(this.phase) + Math.sin(this.phase * 1.01) + Math.sin(this.phase * 0.99)) / 3;
                break;
            case 'fatsawtooth':
                value = (((this.phase / Math.PI) - 1) + (((this.phase * 1.01) / Math.PI) - 1) + (((this.phase * 0.99) / Math.PI) - 1)) / 3;
                break;
            // Simple FM for metallic sounds
            case 'fmsquare': {
                const modulatorFreq = this.phaseIncrement * 5; // Modulator is 5x carrier
                const modulator = Math.sin(modulatorFreq) * 2.0; // Modulation depth
                value = Math.sign(Math.sin(this.phase + modulator));
                break;
            }
            default:
                value = Math.sin(this.phase);
        }
        this.phase += this.phaseIncrement;
        if (this.phase > 2 * Math.PI) {
            this.phase -= 2 * Math.PI;
        }
        return value;
    }
}

// --- Voice (Synth) ---
let voiceIdCounter = 0; // To give each voice a unique ID for logging

class Voice {
    constructor(sampleRate) {
        this.id = voiceIdCounter++;
        this.oscillator = new Oscillator('sine', sampleRate);
        this.envelope = new ADSREnvelope({}, sampleRate);
        this.isActive = false;
        this.note = null;
        this.sampleRate = sampleRate;
        this.processCount = 0; // For logging frequency
    }

    play(note, currentTime) {
        this.note = note;
        this.oscillator.type = note.oscType || 'sine';
        this.oscillator.setFrequency(note.freq);
        this.envelope = new ADSREnvelope({
            attack: note.attack,
            decay: note.decay,
            sustain: note.sustain,
            release: note.release
        }, this.sampleRate);
        this.envelope.triggerAttack();
        this.isActive = true;
        this.startTime = currentTime;
        this.endTime = currentTime + note.duration;
        this.processCount = 0; // Reset for new note
    }

    process(currentTime) {
        if (!this.isActive) return 0.0;

        // Log the phase periodically
        if (this.processCount % 50000 === 0) {
            console.log(`[WORKLET_PHASE_TRACE] Voice ${this.id} (${this.note.part}): phase = ${this.oscillator.phase.toFixed(3)}`);
        }
        this.processCount++;


        if (currentTime >= this.endTime && this.envelope.state !== 'release') {
            this.envelope.triggerRelease();
        }

        const envValue = this.envelope.process();
        if (this.envelope.state === 'idle') {
            this.isActive = false;
            return 0.0;
        }
        
        const oscValue = this.oscillator.process();
        return oscValue * envValue * this.note.velocity;
    }
}

class SynthProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.voices = [];
        this.noteQueue = [];
        this.bpm = 120;
        this.scoreStartTime = 0;
        this.isPlaying = false;
        this.lastRequestTime = -Infinity;
        this.scoreBufferTime = 10; // seconds

        console.log("[WORKLET_TRACE] SynthProcessor constructor called.");

        this.port.onmessage = (event) => {
            const { type, score, bpm } = event.data;
            if (type === 'schedule') {
                console.log("[WORKLET_TRACE] Received 'schedule' command with score.", { score, bpm });
                this.bpm = bpm;
                
                // If the queue is empty, reset the start time.
                if (this.noteQueue.length === 0) {
                    this.scoreStartTime = currentTime; // currentTime is a global from AudioWorkletProcessor
                    this.lastRequestTime = currentTime;
                    console.log(`[WORKLET_TRACE] Note queue was empty. Resetting scoreStartTime to ${this.scoreStartTime}`);
                }
                
                const processNotes = (partNotes) => {
                    if (partNotes) {
                       partNotes.forEach(note => this.noteQueue.push(note));
                    }
                };

                processNotes(score.solo);
                processNotes(score.accompaniment);
                processNotes(score.bass);
                processNotes(score.effects);

                this.noteQueue.sort((a, b) => a.startTime - b.startTime);
                this.isPlaying = true;

            } else if (type === 'clear') {
                console.log("[WORKLET_TRACE] Received 'clear' command. Clearing voices and queue.");
                this.voices = [];
                this.noteQueue = [];
                this.isPlaying = false;
            }
        };
    }

    process(inputs, outputs, parameters) {
        const output = outputs[0];
        const channel = output[0];

        if (!this.isPlaying) {
             for (let i = 0; i < channel.length; i++) {
                channel[i] = 0;
            }
            return true;
        }

        const timeToScheduleUntil = currentTime + channel.length / sampleRate;

        // Activate notes from the queue
        while (this.noteQueue.length > 0 && this.scoreStartTime + this.noteQueue[0].startTime < timeToScheduleUntil) {
            const note = this.noteQueue.shift();
            let voice = this.voices.find(v => !v.isActive);
            if (!voice) {
                voice = new Voice(sampleRate);
                this.voices.push(voice);
            }
            voice.play(note, this.scoreStartTime + note.startTime);
        }

        // Process all active voices
        for (let i = 0; i < channel.length; i++) {
            const time = currentTime + i / sampleRate;
            let sample = 0;
            for (const voice of this.voices) {
                if (voice.isActive) {
                    sample += voice.process(time);
                }
            }
            channel[i] = sample * 0.2; // Master volume
        }

        // Clean up idle voices
        this.voices = this.voices.filter(v => v.isActive);

        // Request new score if buffer is running low
        const remainingBuffer = (this.scoreStartTime + (this.noteQueue.length > 0 ? this.noteQueue[this.noteQueue.length - 1].startTime : 0)) - currentTime;
        if (remainingBuffer < this.scoreBufferTime && currentTime > this.lastRequestTime + 1) {
            console.log(`[WORKLET_TRACE] Buffer low (${remainingBuffer.toFixed(2)}s). Requesting new score.`);
            this.port.postMessage({ type: 'request_new_score' });
            this.lastRequestTime = currentTime;
        }


        return true;
    }
}

registerProcessor('synth-processor', SynthProcessor);
console.log("[WORKLET_TRACE] synth-processor registered.");

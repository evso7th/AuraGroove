
import * as Tone from 'tone';

// --- Type Definitions ---
type DrumSettings = {
    enabled: boolean;
    pattern: 'basic' | 'breakbeat' | 'slow' | 'heavy';
    volume: number; // 0-1 range
};

type Instruments = {
    solo: 'synthesizer' | 'piano' | 'organ' | 'none';
    accompaniment: 'synthesizer' | 'piano' | 'organ' | 'none';
    bass: 'bass guitar' | 'none';
};

// --- Musician: Bassist ---
class BassGenerator {
    synth: Tone.PolySynth;
    
    constructor() {
        this.synth = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'fatsawtooth' },
            envelope: {
                attack: 0.01,
                decay: 0.4,
                sustain: 0.1,
                release: 0.8,
            },
        });
        this.setVolume(0.7); // Default volume
    }

    createPart(time: Tone.Unit.Time) {
        // Simple bassline, plays root and fifth on C2/G2. Occasionally drops to C1.
        const score = [
            { time: "0:0", note: Math.random() < 0.2 ? 'C1' : 'C2', duration: '4n' },
            { time: "0:1", note: 'G2', duration: '8n' },
            { time: "0:2", note: 'C2', duration: '4n' },
            { time: "0:3", note: 'G2', duration: '8n' },
            { time: "0:3:2", note: 'A#1', duration: '8n' }
        ];

        score.forEach(note => {
            this.synth.triggerAttackRelease(note.note, note.duration, time + Tone.Time(note.time).toSeconds());
        });
    }
    
    connect(destination: Tone.OutputNode) {
        this.synth.connect(destination);
    }

    setVolume(gain: number, time: Tone.Unit.Time) {
        this.synth.volume.linearRampToValueAtTime(Tone.gainToDb(gain), time);
    }
}

// --- Musician: Drummer ---
class DrumGenerator {
    sampler: Tone.Sampler;
    currentPattern: keyof typeof this.patterns = 'basic';
    
    private patterns = {
       basic: [
            { time: "0:0", note: "C1", velocity: 0.8 }, { time: "0:2", note: "C1", velocity: 0.8 },
            { time: "0:1", note: "D1" }, { time: "0:3", note: "D1" }, 
            { time: "0:0:2", note: "E1" }, { time: "0:1:2", note: "E1" }, { time: "0:2:2", note: "E1" }, { time: "0:3:2", note: "E1" }
        ],
        breakbeat: [
            { time: "0:0", note: "C1", velocity: 0.8 }, { time: "0:0:3", note: "C1", velocity: 0.7 }, { time: "0:2", note: "C1", velocity: 0.8 },
            { time: "0:1", note: "D1" }, { time: "0:2:2", note: "D1" }, { time: "0:3:1", note: "D1" },
            { time: "0:0", note: "E1" }, { time: "0:1", note: "E1" }, { time: "0:2", note: "E1" }, { time: "0:3", note: "E1" },
        ],
        slow: [
            { time: "0:0", note: "C1", velocity: 0.8 }, { time: "0:2", note: "D1" },
            { time: "0:0", note: "F1", velocity: 0.5 }, { time: "0:1", note: "F1", velocity: 0.5 }, { time: "0:2", note: "F1", velocity: 0.5 }, { time: "0:3", note: "F1", velocity: 0.5 }
        ],
        heavy: [
            { time: "0:0", note: "C1", velocity: 0.9 }, { time: "0:2", note: "C1", velocity: 0.9 },
            { time: "0:1", note: "D1" }, { time: "0:3", note: "D1" },
            { time: "0:0", note: "F1", velocity: 0.6 }, { time: "0:1", note: "F1", velocity: 0.6 }, { time: "0:2", note: "F1", velocity: 0.6 }, { time: "0:3", note: "F1", velocity: 0.6 },
        ],
    };

    private fills = [
        [ { time: "0:3:0", note: "G1" }, { time: "0:3:1", note: "G1" }, { time: "0:3:2", note: "H1" }, { time: "0:3:3", note: "I1" }],
        [ { time: "0:3:0", note: "D1" }, { time: "0:3:1", note: "G1" }, { time: "0:3:2", note: "H1" }, { time: "0:3:3", note: "I1" }],
    ];
    
    constructor(sampleUrls: Record<string, string>, onLoad: () => void) {
        this.sampler = new Tone.Sampler({
            urls: {
                C1: sampleUrls.kick, D1: sampleUrls.snare, E1: sampleUrls.hat,
                F1: sampleUrls.ride, A1: sampleUrls.crash,
                G1: sampleUrls.tom1, H1: sampleUrls.tom2, I1: sampleUrls.tom3,
            },
            onload: onLoad
        });
    }

    createPart(patternName: keyof typeof this.patterns, bar: number, time: Tone.Unit.Time) {
        let basePattern = this.patterns[patternName] || this.patterns.basic;
        let partData = [...basePattern];
        
        // Every 4th bar, add fill and crash
        if (bar > 0 && bar % 4 === 0) {
            const fill = this.fills[Math.floor(bar / 4) % this.fills.length];
            // Filter out notes from base pattern in the last beat to make room for fill
            const patternWithoutLastBeat = basePattern.filter(note => !note.time.startsWith('0:3'));
            partData = [{ time: "0:0", note: "A1", velocity: 0.8 }, ...patternWithoutLastBeat, ...fill];
        }
        
        partData.forEach(note => {
            this.sampler.triggerAttackRelease(note.note, "8n", time + Tone.Time(note.time).toSeconds(), note.velocity || 0.7);
        });
    }

    connect(destination: Tone.OutputNode) {
        this.sampler.connect(destination);
    }
    
    setVolume(gain: number, time: Tone.Unit.Time) {
        this.sampler.volume.linearRampToValueAtTime(Tone.gainToDb(gain), time);
    }
}


// --- Conductor (Offline Renderer) ---
const Conductor = {
    drummer: null as DrumGenerator | null,
    bassist: null as BassGenerator | null,
    
    drumSettings: {} as DrumSettings,
    instruments: {} as Instruments,
    
    isInitialized: false,
    isRunning: false,
    barCount: 0,
    
    bpm: 100,
    measureDuration: 0,

    init(sampleUrls: Record<string, string>) {
        let loaded = { drums: false };
        const onPartLoad = () => {
           loaded.drums = true;
           this.isInitialized = true;
           self.postMessage({ type: 'initialized' });
        }
        this.drummer = new DrumGenerator(sampleUrls, onPartLoad);
        this.bassist = new BassGenerator();
    },

    start(drumSettings: DrumSettings, instruments: Instruments) {
        if (!this.isInitialized || this.isRunning) return;

        this.isRunning = true;
        this.barCount = 0;
        this.updateSettings(drumSettings, instruments);

        this.measureDuration = Tone.Time('1m').toSeconds();
        
        this.renderNextChunk(); 
        self.postMessage({ type: 'started' });
    },

    async renderNextChunk() {
        if (!this.isRunning) return;

        // The render function that will be executed offline
        const renderFn = (transport: Tone.Transport) => {
            const masterBus = new Tone.Gain().toDestination();
            this.drummer?.connect(masterBus);
            this.bassist?.connect(masterBus);

            const now = transport.now();

            // Update volumes based on settings
            this.drummer?.setVolume(this.drumSettings.enabled ? this.drumSettings.volume : 0, now);
            this.bassist?.setVolume(this.instruments.bass === 'bass guitar' ? 0.7 : 0, now);


            // Schedule parts
            if (this.drumSettings.enabled) {
                this.drummer?.createPart(this.drumSettings.pattern, this.barCount, now);
            }
            if (this.instruments.bass === 'bass guitar') {
                this.bassist?.createPart(now);
            }
        };

        try {
            // Render the audio for one measure
            const buffer = await Tone.Offline(renderFn, this.measureDuration);
            
            // Post the rendered chunk back to main thread
            const chunk = buffer.getChannelData(0);
            self.postMessage({
                type: 'chunk',
                data: {
                    chunk: chunk,
                    sampleRate: buffer.sampleRate,
                    duration: this.measureDuration,
                }
            }, [chunk.buffer]);

            this.barCount++;
            
            // Immediately schedule the next render
            if (this.isRunning) {
               this.renderNextChunk();
            }

        } catch (e) {
            self.postMessage({ type: 'error', error: `Rendering failed: ${e instanceof Error ? e.message : String(e)}` });
            this.stop();
        }
    },

    stop() {
        this.isRunning = false;
    },

    updateSettings(drumSettings: DrumSettings, instruments: Instruments) {
        if (drumSettings) this.drumSettings = drumSettings;
        if (instruments) this.instruments = instruments;
        Tone.Transport.bpm.value = this.bpm;
    },
};

// --- MessageBus ---
self.onmessage = async (event: MessageEvent) => {
    const { command, data } = event.data;
    
    try {
        switch (command) {
            case 'init':
                Conductor.init(data.sampleUrls);
                break;
            
            case 'start':
                 if (!Conductor.isInitialized) {
                   throw new Error("Worker is not initialized with samples yet. Call 'init' first.");
                }
                Conductor.start(data.drumSettings, data.instruments);
                break;

            case 'stop':
                Conductor.stop();
                break;
            
            case 'set_instruments':
                if (Conductor.isInitialized) Conductor.updateSettings(Conductor.drumSettings, data);
                break;

            case 'set_drums':
                if (Conductor.isInitialized) Conductor.updateSettings(data, Conductor.instruments);
                break;
        }
    } catch (e) {
        self.postMessage({ type: 'error', error: e instanceof Error ? e.message : String(e)} );
    }
};

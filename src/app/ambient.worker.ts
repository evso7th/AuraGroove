
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
    }

    createPart(time: Tone.Unit.Time) {
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

    setVolume(gain: number) {
        this.synth.volume.value = Tone.gainToDb(gain);
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
        
        if (bar > 0 && bar % 4 === 0) {
            const fill = this.fills[Math.floor(bar / 4) % this.fills.length];
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
    
    setVolume(gain: number) {
       this.sampler.volume.value = Tone.gainToDb(gain);
    }
}


// --- Conductor (Offline Renderer) ---
const Conductor = {
    drummer: null as DrumGenerator | null,
    bassist: null as BassGenerator | null,
    masterBus: null as Tone.Gain | null,
    
    drumSettings: {} as DrumSettings,
    instruments: {} as Instruments,
    
    isInitialized: false,
    barCount: 0,
    
    bpm: 100,
    measureDuration: 0,

    init(sampleUrls: Record<string, string>) {
        if (this.isInitialized) return;

        this.bassist = new BassGenerator();
        this.masterBus = new Tone.Gain(1);

        this.drummer = new DrumGenerator(sampleUrls, () => {
           this.isInitialized = true;
           self.postMessage({ type: 'initialized' });
        });
        
        // Connect instruments to the master bus immediately after creation
        this.drummer.connect(this.masterBus);
        this.bassist.connect(this.masterBus);
    },
    
    updateSettings(drumSettings?: DrumSettings, instruments?: Instruments) {
        if (!this.isInitialized) return;
        if (drumSettings) this.drumSettings = drumSettings;
        if (instruments) this.instruments = instruments;
        
        if(this.drumSettings.enabled) this.drummer?.setVolume(this.drumSettings.volume);
        else this.drummer?.setVolume(0);

        if(this.instruments.bass === 'bass guitar') this.bassist?.setVolume(0.7);
        else this.bassist?.setVolume(0);
    },

    async renderNextChunk() {
        if (!this.isInitialized || !this.masterBus) return;
        
        this.measureDuration = Tone.Time('1m').toSeconds();
        Tone.Transport.bpm.value = this.bpm;

        try {
            const buffer = await Tone.Offline((transport: Tone.Transport) => {
                const now = transport.now();
                this.masterBus!.connect(transport.destination);
                
                if (this.drumSettings.enabled) {
                    this.drummer?.createPart(this.drumSettings.pattern, this.barCount, now);
                }
                if (this.instruments.bass === 'bass guitar') {
                    this.bassist?.createPart(now);
                }
            }, this.measureDuration);
            
            const chunk = buffer.getChannelData(0);
            self.postMessage({
                type: 'chunk',
                data: {
                    chunk: chunk,
                    sampleRate: buffer.sampleRate,
                }
            }, [chunk.buffer]);

            this.barCount++;

        } catch (e) {
            self.postMessage({ type: 'error', error: `Rendering failed: ${e instanceof Error ? e.message : String(e)}` });
        }
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
            
            case 'update_settings':
                 if (Conductor.isInitialized) {
                    Conductor.updateSettings(data.drumSettings, data.instruments);
                 }
                break;

            case 'render_chunk':
                if (Conductor.isInitialized) {
                    await Conductor.renderNextChunk();
                }
                break;
        }
    } catch (e) {
        self.postMessage({ type: 'error', error: e instanceof Error ? e.message : String(e)} );
    }
};

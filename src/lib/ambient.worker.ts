
/**
 * @file AuraGroove Music Worker (Architecture: "Composer-Conductor")
 *
 * This worker is the "Master of Time" and the "Composer".
 * It is responsible for all musical composition. It uses its own internal,
 * high-precision loop and sends scores (arrays of notes) to the main thread.
 */

// --- 1. Composer ---
class Composer {
    private chordProgression: { root: string; notes: string[] }[];
    private lastMelodyNote: string;
    
    constructor() {
        this.chordProgression = [
            { root: 'C2', notes: ['C3', 'E3', 'G3'] },
            { root: 'A1', notes: ['A2', 'C3', 'E3'] },
            { root: 'F1', notes: ['F2', 'A2', 'C3'] },
            { root: 'G1', notes: ['G2', 'B2', 'D3'] },
        ];
        this.lastMelodyNote = 'C4';
    }
    
    createScoreForNextBar(barNumber: number, settings: any) {
        const { drumSettings, instrumentSettings, score: scoreName } = settings;
        const beatsPerBar = 4;
        const subdivisions = 4; // 16th notes
        
        const currentChord = this.chordProgression[Math.floor(barNumber / 2) % this.chordProgression.length];

        const bassScore = [];
        if (instrumentSettings.bass.name !== 'none' && barNumber % 2 === 0) {
             bassScore.push({
                note: currentChord.root,
                duration: '2m',
                time: 0,
                velocity: instrumentSettings.bass.volume ?? 0.7
            });
        }
        
        const drumScore = [];
        if (drumSettings.enabled && drumSettings.pattern === 'ambient_beat') {
            drumScore.push({ sample: 'kick', time: 0, velocity: 0.9 * drumSettings.volume });
            drumScore.push({ sample: 'hat', time: 1.5, velocity: 0.3 * drumSettings.volume });
            drumScore.push({ sample: 'snare', time: 2.0, velocity: 0.7 * drumSettings.volume });
            drumScore.push({ sample: 'hat', time: 3.5, velocity: 0.3 * drumSettings.volume });
        } else if (drumSettings.enabled && drumSettings.pattern === 'composer') {
             if (barNumber % 4 === 0) {
                 drumScore.push({ sample: 'kick', time: 0, velocity: 1.0 * drumSettings.volume });
                 drumScore.push({ sample: 'crash', time: 0, velocity: 0.6 * drumSettings.volume });
             } else {
                drumScore.push({ sample: 'kick', time: 0, velocity: 0.9 * drumSettings.volume });
             }
            drumScore.push({ sample: 'snare', time: 2, velocity: 0.8 * drumSettings.volume });
            for(let i=0; i<4; i++) {
                if(i*1 !== 2) {
                    drumScore.push({ sample: 'hat', time: i*1, velocity: 0.2 * drumSettings.volume });
                }
                drumScore.push({ sample: 'hat', time: i*1 + 0.5, velocity: 0.4 * drumSettings.volume });
            }
        }

        const melodyScore = [];
        if(instrumentSettings.melody.name !== 'none'){
            // Simple evolving melody
            if(barNumber % 1 === 0){
                const prevNote = this.lastMelodyNote;
                // very simple logic to move one step up or down the C major scale from the last note
                const scale = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
                const octave = parseInt(prevNote.slice(-1));
                const noteName = prevNote.slice(0,-1);
                let noteIndex = scale.indexOf(noteName);

                if(Math.random() > 0.5){
                    noteIndex = (noteIndex + 1) % scale.length;
                } else {
                    noteIndex = (noteIndex - 1 + scale.length) % scale.length;
                }
                
                const newNoteName = scale[noteIndex];
                // basic logic to stay in a reasonable octave range
                let newOctave = octave;
                if(noteIndex === 0 && Math.random() > 0.5) newOctave++;
                if(noteIndex === 6 && Math.random() < 0.5) newOctave--;
                newOctave = Math.max(3, Math.min(5, newOctave));

                this.lastMelodyNote = `${newNoteName}${newOctave}`;
                melodyScore.push({
                    note: this.lastMelodyNote,
                    duration: '1m',
                    time: 0,
                    velocity: instrumentSettings.melody.volume ?? 0.5
                })
            }
        }


        return { bassScore, drumScore, melodyScore };
    }
}


// --- 2. Scheduler (The Conductor) ---

const Scheduler = {
    loopId: null as any,
    isRunning: false,
    barCount: 0,
    composer: new Composer(),
    
    settings: {
        bpm: 75,
        score: 'evolve',
        drumSettings: { pattern: 'ambient_beat', volume: 0.5, enabled: true },
        instrumentSettings: { 
            bass: { name: "portamento", volume: 0.45 },
            melody: { name: "synth", volume: 0.45, technique: 'arpeggio' },
        },
    } as any,

    get barDuration() { 
        return (60 / this.settings.bpm) * 4; // 4 beats per bar
    },

    start() {
        if (this.isRunning) return;
        self.postMessage({ type: 'log', message: '[WORKER] Scheduler starting...' });
        this.isRunning = true;
        this.barCount = 0;
        
        const loop = () => {
            if (!this.isRunning) return;
            this.tick();
            this.loopId = setTimeout(loop, this.barDuration * 1000);
        };
        
        loop();
    },

    stop() {
        if (!this.isRunning) return;
        self.postMessage({ type: 'log', message: '[WORKER] Scheduler stopping...' });
        this.isRunning = false;
        if (this.loopId) {
            clearTimeout(this.loopId);
            this.loopId = null;
        }
    },
    
    updateSettings(settings: any) {
        if (settings.bpm) this.settings.bpm = settings.bpm;
        if (settings.drumSettings) this.settings.drumSettings = {...this.settings.drumSettings, ...settings.drumSettings};
        if (settings.instrumentSettings) this.settings.instrumentSettings = {...this.settings.instrumentSettings, ...settings.instrumentSettings};
        if (settings.score) this.settings.score = settings.score;
    },

    tick() {
        if (!this.isRunning) return;
        
        const score = this.composer.createScoreForNextBar(this.barCount, this.settings);
        
        self.postMessage({
            type: 'score',
            data: {
                bar: this.barCount,
                score: score
            }
        });

        this.barCount++;
    }
};

// --- MessageBus (The entry point) ---
self.onmessage = async (event: MessageEvent) => {
    if (!event.data || !event.data.command) return;
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'start':
                Scheduler.start();
                break;
                
            case 'stop':
                Scheduler.stop();
                break;

            case 'update_settings':
                Scheduler.updateSettings(data);
                break;
        }
    } catch (e) {
        self.postMessage({ type: 'error', error: e instanceof Error ? e.message : String(e) });
    }
};

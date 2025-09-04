
/**
 * @file AuraGroove Music Worker (Architecture: "Hybrid Engine Composer")
 *
 * This worker's only responsibility is to compose music for all parts.
 * It generates arrays of notes (scores) for synths (bass, melody, accompaniment)
 * and samplers (drums, effects) and sends them to the main thread for execution.
 * It is completely passive and only works when commanded.
 */
import type { WorkerSettings, Score, Note, DrumsScore, EffectsScore, BassInstrument, MelodyInstrument, AccompanimentInstrument, DrumSettings, InstrumentPart } from '@/types/music';

type Phrase = Note[];

class EvolutionEngine {
    private anchors: Phrase[];
    private currentPhrase: Phrase;
    private barSinceAnchor: number;
    private bassNotes = [36, 38, 40, 41, 43, 45, 47]; // C2-B2
    private chordProgression = [0, 4, 5, 3]; // I-V-vi-IV in C Major scale degrees

    constructor() {
        this.anchors = [
            [
                { midi: 48, duration: 0.5, time: 0 }, // C3
                { midi: 52, duration: 0.5, time: 0.5 }, // E3
                { midi: 55, duration: 0.5, time: 1.0 }, // G3
                { midi: 60, duration: 0.5, time: 1.5 }, // C4
            ]
        ];
        this.currentPhrase = this.anchors[0];
        this.barSinceAnchor = 0;
    }

    private mutate(phrase: Phrase): Phrase {
        return phrase.map(note => {
            const newNote = { ...note };
            const mutationType = Math.random();
            const MIN_MIDI = 48; // C3
            const MAX_MIDI = 71; // B4

            if (mutationType < 0.4) {
                const direction = Math.random() < 0.5 ? 1 : -1;
                const potentialMidi = newNote.midi + direction;
                
                // Restrict melody to 3rd and 4th octaves (48-71)
                if (potentialMidi >= MIN_MIDI && potentialMidi <= MAX_MIDI) {
                    newNote.midi = potentialMidi;
                }
            } else if (mutationType < 0.7) {
                newNote.duration *= (0.5 + Math.random());
            }
            return newNote;
        });
    }

    private getChordTones(rootDegree: number): number[] {
        const scale = [0, 2, 4, 5, 7, 9, 11]; // C Major scale intervals
        const tones: number[] = [];
        // Get root, third, and fifth
        for(let i=0; i<3; i++) {
            const degreeIndex = (rootDegree + i * 2) % scale.length;
            const octaveOffset = Math.floor((rootDegree + i * 2) / scale.length);
            // Accompaniment in 3rd octave
            const baseNote = 48; // C3
            tones.push(baseNote + (octaveOffset * 12) + scale[degreeIndex]);
        }
        return tones;
    }

    generateNextBar(barDuration: number, density: number, drumSettings: Omit<DrumSettings, 'volume'> & { enabled: boolean }): { melody: Phrase, bass: Phrase, accompaniment: Phrase, drums: DrumsScore } {
        this.barSinceAnchor++;

        if (this.barSinceAnchor >= 8) {
            this.currentPhrase = this.anchors[0];
            this.barSinceAnchor = 0;
        } else {
            this.currentPhrase = this.mutate(this.currentPhrase);
        }
        
        const currentChordRootDegree = this.chordProgression[Math.floor(this.barCount / 2) % this.chordProgression.length];

        const bassMidi = this.bassNotes[currentChordRootDegree % this.bassNotes.length];
        const bass: Phrase = [{ midi: bassMidi, time: 0, duration: barDuration, velocity: 0.6 }];

        const melody = this.currentPhrase.map((note, index) => ({
            ...note,
            time: (index / this.currentPhrase.length) * barDuration,
            velocity: 0.5 + Math.random() * 0.3
        })).filter(() => Math.random() < density);

        const chordTones = this.getChordTones(currentChordRootDegree);
        const accompaniment: Phrase = chordTones.map(midi => ({
            midi,
            time: 0, // Worklet handles timing
            duration: barDuration,
            velocity: 0.6
        }));

        const drums: DrumsScore = [];
        if (drumSettings.enabled) {
             const notesInBar = 16;
             const step = barDuration / notesInBar;
             if (drumSettings.pattern === 'ambient_beat' || drumSettings.pattern === 'composer') {
                for (let i = 0; i < notesInBar; i++) {
                     if (i % 8 === 0) drums.push({ note: 'C4', time: i * step, velocity: 1.0 });
                     if (i % 8 === 4) drums.push({ note: 'D4', time: i * step, velocity: 0.7 });
                     if (i % 4 === 2) drums.push({ note: 'E4', time: i * step, velocity: 0.4 });
                }
             }
        }
        
        this.barCount = (this.barCount || 0) + 1;

        return { melody, bass, accompaniment, drums };
    }
     private barCount = 0;
}


// --- Scheduler (The Conductor) ---
const Scheduler = {
    loopId: null as any,
    isRunning: false,
    barCount: 0,
    evolutionEngine: new EvolutionEngine(),

    // --- State Machine for Composition ---
    state: 'stopped' as 'stopped' | 'intro' | 'looping',
    introBarCount: 0,
    INTRO_DURATION_BARS: 8,
    // Randomize instrument introduction order
    introOrder: [] as InstrumentPart[],
    
    settings: {
        bpm: 75,
        score: 'dreamtales',
        drumSettings: { pattern: 'none', enabled: false },
        instrumentSettings: { 
            bass: { name: "glideBass" as BassInstrument, volume: 0.5 },
            melody: { name: "synth" as MelodyInstrument, volume: 0.5 },
            accompaniment: { name: "poly_synth" as AccompanimentInstrument, volume: 0.5 },
        },
        density: 0.5,
    } as WorkerSettings,

    get barDuration() { 
        return (60 / this.settings.bpm) * 4; // 4 beats per bar
    },

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.state = 'intro';
        this.barCount = 0;
        this.introBarCount = 0;

        // Shuffle the intro order for variety each time
        const parts: InstrumentPart[] = ['drums', 'bass', 'accompaniment', 'melody'];
        this.introOrder = parts.sort(() => Math.random() - 0.5);
        
        const loop = () => {
            if (!this.isRunning) return;
            this.tick();
            this.loopId = setTimeout(loop, this.barDuration * 1000);
        };
        
        loop();
    },

    stop() {
        this.isRunning = false;
        this.state = 'stopped';
        if (this.loopId) {
            clearTimeout(this.loopId);
            this.loopId = null;
        }
    },
    
    updateSettings(newSettings: Partial<WorkerSettings>) {
       this.settings = { ...this.settings, ...newSettings };
    },

    createIntroScore(): Score {
        const score: Score = { bass: [], melody: [], accompaniment: [], drums: [], effects: [] };
        const step = this.barDuration / 16;
        
        // Determine which instruments play in this bar of the intro
        const playDrums = this.settings.drumSettings.enabled && this.introOrder.indexOf('drums') * 2 <= this.introBarCount;
        const playBass = this.settings.instrumentSettings.bass.name !== 'none' && this.introOrder.indexOf('bass') * 2 <= this.introBarCount;
        const playAccompaniment = this.settings.instrumentSettings.accompaniment.name !== 'none' && this.introOrder.indexOf('accompaniment') * 2 <= this.introBarCount;
        const playMelody = this.settings.instrumentSettings.melody.name !== 'none' && this.introOrder.indexOf('melody') * 2 <= this.introBarCount;

        if (playDrums) {
            if (this.introBarCount % 2 === 0) { // Play only on every other bar during intro
                 for (let i = 0; i < 16; i+=4) {
                    score.drums?.push({ note: 'E4', time: i * step, velocity: 0.3 }); // Gentle hi-hat
                 }
            }
        }
        if (playBass) {
            const bassNotes = [36, 40, 43, 38];
            const note = bassNotes[this.introBarCount % bassNotes.length];
            score.bass?.push({ midi: note, time: 0, duration: this.barDuration, velocity: 0.5 });
        }
        if (playAccompaniment) {
             const chordTones = [48, 52, 55]; // Simple C Major triad
             score.accompaniment?.push({ midi: chordTones[this.introBarCount % 3], time: 0, duration: this.barDuration, velocity: 0.4 });
        }
        if (playMelody) {
            if (Math.random() < this.settings.density * 0.5) { // Melody is sparse in intro
                const melodyNotes = [60, 64, 67, 72];
                const note = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
                score.melody?.push({ midi: note, time: step * Math.floor(Math.random() * 8), duration: step * 4, velocity: 0.6 });
            }
        }

        this.introBarCount++;
        if (this.introBarCount >= this.INTRO_DURATION_BARS) {
            this.state = 'looping';
        }
        return score;
    },

    createLoopingScore(): Score {
        if (this.settings.score === 'dreamtales') {
            return this.evolutionEngine.generateNextBar(this.barDuration, this.settings.density, this.settings.drumSettings);
        }

        // Fallback generator for other styles
        const score: Score = { bass: [], melody: [], accompaniment: [], drums: [], effects: [] };
        const notesInBar = 16;
        const step = this.barDuration / notesInBar;
        const bassNotes = [36, 38, 40, 41, 43, 45, 47];
        const melodyNotes = [48, 50, 52, 53, 55, 57, 59, 60];
        const rootDegree = Math.floor(this.barCount / 2) % bassNotes.length;

        if (this.settings.instrumentSettings.bass.name !== 'none') {
             score.bass?.push({ midi: bassNotes[rootDegree], time: 0, duration: this.barDuration / 2, velocity: 0.6 });
        }
        if (this.settings.instrumentSettings.accompaniment.name !== 'none') {
            const chordTones = [rootDegree, rootDegree + 2, rootDegree + 4].map(d => bassNotes[d % bassNotes.length] + 12);
            score.accompaniment?.push(...chordTones.map(midi => ({ midi, time: 0, duration: this.barDuration, velocity: 0.5})));
        }
        if (this.settings.instrumentSettings.melody.name !== 'none') {
            for (let i = 0; i < notesInBar; i++) {
                 if (Math.random() < this.settings.density / 2) {
                    const midi = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
                    score.melody?.push({ midi, time: i * step, duration: step * 2, velocity: 0.5 + Math.random() * 0.3 });
                }
            }
        }
        if (this.settings.drumSettings.enabled) {
            for (let i = 0; i < notesInBar; i++) {
                if (i % 8 === 0) score.drums?.push({ note: 'C4', time: i * step, velocity: 1.0 });
                if (i % 8 === 4) score.drums?.push({ note: 'D4', time: i * step, velocity: 0.7 });
                if (i % 2 === 0) score.drums?.push({ note: 'E4', time: i * step, velocity: 0.4 });
            }
        }
        return score;
    },

    tick() {
        if (!this.isRunning) return;
        
        let score: Score;
        switch(this.state) {
            case 'intro':
                score = this.createIntroScore();
                break;
            case 'looping':
                score = this.createLoopingScore();
                break;
            case 'stopped':
            default:
                score = {};
                break;
        }
        
        self.postMessage({
            type: 'score',
            score: score
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

    
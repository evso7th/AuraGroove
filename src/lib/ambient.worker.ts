
/**
 * @file AuraGroove Music Worker (Architecture: "Hybrid Engine Composer")
 *
 * This worker's only responsibility is to compose music for all parts.
 * It generates arrays of notes (scores) for synths (bass, melody)
 * and samplers (drums, effects) and sends them to the main thread for execution.
 * It is completely passive and only works when commanded.
 */
import type { WorkerSettings, Score, Note, DrumsScore, EffectsScore, BassInstrument, DrumSettings } from '@/types/music';

type Phrase = Note[];

class EvolutionEngine {
    private anchors: Phrase[];
    private currentPhrase: Phrase;
    private barSinceAnchor: number;
    // Bass notes restricted to the 2nd octave (C2 to B2)
    private bassNotes = [36, 38, 40, 41, 43, 45, 47]; // C-Major scale in 2nd octave

    constructor() {
        // Anchor Phrase lowered by one octave to be primarily in the 3rd, touching the 4th.
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
                // Transpose note by one semitone
                const direction = Math.random() < 0.5 ? 1 : -1;
                const potentialMidi = newNote.midi + direction;
                // Clamp the melody to stay within the 3rd and 4th octaves.
                if (potentialMidi >= MIN_MIDI && potentialMidi <= MAX_MIDI) {
                    newNote.midi = potentialMidi;
                }
            } else if (mutationType < 0.7) {
                // Change duration
                newNote.duration *= (0.5 + Math.random());
            }
            // 30% chance to keep the note as is
            return newNote;
        });
    }

    generateNextBar(barDuration: number, density: number, drumSettings: Omit<DrumSettings, 'volume'> & { enabled: boolean }): { melody: Phrase, bass: Phrase, drums: DrumsScore } {
        this.barSinceAnchor++;

        // Every 8 bars, return to an anchor
        if (this.barSinceAnchor >= 8) {
            this.currentPhrase = this.anchors[0];
            this.barSinceAnchor = 0;
        } else {
            // Otherwise, mutate the current phrase
            this.currentPhrase = this.mutate(this.currentPhrase);
        }
        
        // Generate bass note for the bar
        const bassMidi = this.bassNotes[Math.floor(Math.random() * this.bassNotes.length)];
        const bass: Phrase = [{ midi: bassMidi, time: 0, duration: barDuration, velocity: 0.6 }];

        // Assign timings to the melody phrase within the bar
        const melody = this.currentPhrase.map((note, index) => {
            return {
                ...note,
                time: (index / this.currentPhrase.length) * barDuration,
                velocity: 0.5 + Math.random() * 0.3
            };
        }).filter(() => Math.random() < density); // Apply density

        // Generate drums
        const drums: DrumsScore = [];
        if (drumSettings.enabled) {
             const notesInBar = 16;
             const step = barDuration / notesInBar;
             if (drumSettings.pattern === 'ambient_beat' || drumSettings.pattern === 'composer') {
                for (let i = 0; i < notesInBar; i++) {
                     if (i % 8 === 0) drums.push({ note: 'C4', time: i * step, velocity: 1.0 }); // Kick
                     if (i % 8 === 4) drums.push({ note: 'D4', time: i * step, velocity: 0.7 }); // Snare
                     if (i % 4 === 2) drums.push({ note: 'E4', time: i * step, velocity: 0.4 }); // Hi-hat
                }
             }
        }

        return { melody, bass, drums };
    }
}


// --- Scheduler (The Conductor) ---
const Scheduler = {
    loopId: null as any,
    isRunning: false,
    barCount: 0,
    evolutionEngine: new EvolutionEngine(),
    
    settings: {
        bpm: 75,
        score: 'dreamtales',
        drumSettings: { pattern: 'none', enabled: false },
        instrumentSettings: { 
            bass: { name: "portamento" as BassInstrument, volume: 0.5 },
            melody: { name: "synth" as MelodyInstrument, volume: 0.5 },
        },
        density: 0.5,
    } as WorkerSettings,

    get barDuration() { 
        return (60 / this.settings.bpm) * 4; // 4 beats per bar
    },

    start() {
        if (this.isRunning) return;
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
        this.isRunning = false;
        if (this.loopId) {
            clearTimeout(this.loopId);
            this.loopId = null;
        }
    },
    
    updateSettings(newSettings: Partial<WorkerSettings>) {
       this.settings = { ...this.settings, ...newSettings };
    },

    createScoreForNextBar(): Score {
        if (this.settings.score === 'dreamtales') {
            const { melody, bass, drums } = this.evolutionEngine.generateNextBar(this.barDuration, this.settings.density, this.settings.drumSettings);
            return { melody, bass, drums };
        }

        // --- Fallback to simple generator for other styles ---
        const bass: Note[] = [];
        const melody: Note[] = [];
        const drums: DrumsScore = [];
        const effects: EffectsScore = [];

        const maxVoices = 4;
        const notesInBar = 16; // 16th notes
        const step = this.barDuration / notesInBar;
        const bassNotes = [36, 38, 40, 41, 43, 45, 47]; // C2 Major
        const melodyNotes = [48, 50, 52, 53, 55, 57, 59, 60]; // C3-C4 Major

        let activeSynthNotes = 0;

        for (let i = 0; i < notesInBar; i++) {
             const time = i * step;

            // Bass on the downbeat
            if (i % 8 === 0) {
                 if (activeSynthNotes < maxVoices) {
                    const midi = bassNotes[Math.floor(this.barCount / 2) % bassNotes.length];
                    bass.push({ midi, time, duration: this.barDuration / 2, velocity: 0.6 });
                    activeSynthNotes++;
                 }
            }

            // Melody with density
            if (Math.random() < this.settings.density / 4) {
                 if (activeSynthNotes < maxVoices) {
                    const midi = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
                    melody.push({ midi, time, duration: step * (Math.floor(Math.random() * 3) + 2), velocity: 0.5 + Math.random() * 0.3 });
                    activeSynthNotes++;
                }
            }

            // Drums
            if (this.settings.drumSettings.enabled) {
                if (i % 8 === 0) drums.push({ note: 'C4', time, velocity: 1.0 }); // Kick
                if (i % 8 === 4) drums.push({ note: 'D4', time, velocity: 0.7 }); // Snare
                if (i % 2 === 0) drums.push({ note: 'E4', time, velocity: 0.4 }); // Hi-hat
            }

             // Effects
            if (i === 0 && this.barCount % 8 === 0 && Math.random() < 0.5) {
                effects.push({ note: 'A4', time: time + step * 0.5, velocity: 0.3 + Math.random() * 0.3 });
            }
        }
        return { bass, melody, drums, effects };
    },

    tick() {
        if (!this.isRunning) return;
        
        const score = this.createScoreForNextBar();
        
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

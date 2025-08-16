
/// <reference lib="webworker" />

import { promenadeScore } from '@/lib/scores/promenade';
import type { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote, DrumSettings, EffectsSettings, ScoreName, MixProfile, InstrumentSettings } from '@/types/music';

// --- NEW INTELLIGENT COMPOSITION ENGINE ---

/**
 * Generates and holds the unique musical identity for a session.
 * This is the "DNA" of the composition.
 */
class MusicalGenome {
    public readonly harmony: { root: string; scale: string[] }[];
    public readonly soloAnchor: string[]; // The melodic "axiom"
    public readonly bassAnchorRiff: { time: number; duration: string }[]; // The rhythmic anchor

    constructor() {
        // For now, we'll use a predefined harmony and anchors.
        // Later, this can be replaced with procedural generation (e.g., Markov chains).
        this.harmony = [
            { root: 'E', scale: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'] }, // E minor
            { root: 'C', scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] }, // C major
            { root: 'G', scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'] }, // G major
            { root: 'D', scale: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'] }  // D major
        ];
        this.soloAnchor = ['B4', 'A4', 'G4'];
        this.bassAnchorRiff = [
            { time: 0, duration: '4n' },
            { time: 1.5, duration: '8n' },
            { time: 2.5, duration: '8n' },
        ];
    }
}

/**
 * The "brain" of the composer. Uses the genome to generate evolving music.
 */
class EvolutionEngine {
    private genome: MusicalGenome;
    private soloState: {
        lastPhrase: string[];
        iterations: number;
    };

    constructor(genome: MusicalGenome) {
        this.genome = genome;
        this.soloState = {
            lastPhrase: [...this.genome.soloAnchor],
            iterations: 0,
        };
    }

    public getHarmony(bar: number) {
        const chordIndex = Math.floor(bar / 2) % this.genome.harmony.length;
        return this.genome.harmony[chordIndex];
    }

    public generateSoloScore(bar: number): SoloNote[] {
        const evolutionCycle = 8; // Return to anchor every 8 bars
        if (bar % evolutionCycle === 0) {
            this.soloState.lastPhrase = [...this.genome.soloAnchor];
            this.soloState.iterations = 0;
            return this.soloState.lastPhrase.map((note, i) => ({
                notes: note,
                time: i * 0.5,
                duration: '8n'
            }));
        }

        // Simple mutation rule: slightly alter pitch and timing
        const newPhrase = this.soloState.lastPhrase.map(note => {
            const currentHarmony = this.getHarmony(bar);
            const scaleWithOctave = currentHarmony.scale.map(n => `${n}4`);
            const currentIndex = scaleWithOctave.indexOf(note);
            if (currentIndex === -1) return note; // Should not happen if logic is correct
            
            const nextIndex = (currentIndex + (Math.random() > 0.5 ? 1 : -1) + scaleWithOctave.length) % scaleWithOctave.length;
            return scaleWithOctave[nextIndex];
        });

        this.soloState.lastPhrase = newPhrase;
        this.soloState.iterations++;

        return newPhrase.map((note, i) => ({
            notes: note,
            time: i * (0.5 + (Math.random() - 0.5) * 0.2), // Evolve rhythm slightly
            duration: '8n'
        }));
    }

    public generateAccompanimentScore(bar: number): AccompanimentNote[] {
        if (bar % 2 !== 0) return []; // Play only every 2 bars
        const { root, scale } = this.getHarmony(bar);
        const triad = [`${root}3`, `${scale[2]}3`, `${scale[4]}3`];
        return triad.map((note, index) => ({
            notes: note,
            time: index * 0.1,
            duration: '1m'
        }));
    }
    
    public generateBassScore(bar: number): BassNote[] {
         if (bar % 2 !== 0) return []; // Play only every 2 bars
         const { root } = this.getHarmony(bar);
         return this.genome.bassAnchorRiff.map(riffPart => ({
             note: `${root}2`,
             time: riffPart.time,
             duration: riffPart.duration,
             velocity: 0.9
         }));
    }
}


// --- PatternProvider (Remains the same for now) ---
const PatternProvider = {
    drumPatterns: {
        'dreamtales-beat-desktop': [
            { sample: 'ride', time: 0, velocity: 0.7 },
            { sample: 'ride', time: 1, velocity: 0.6 },
            { sample: 'ride', time: 2, velocity: 0.7 },
            { sample: 'ride', time: 3, velocity: 0.6 },
            { sample: 'kick', time: 2, velocity: 0.8 },
            { sample: 'snare', time: 3.5, velocity: 0.4 },
        ],
        'dreamtales-beat-mobile': [ // Cymbals (ride) are quieter
            { sample: 'ride', time: 0, velocity: 0.05 },
            { sample: 'ride', time: 1, velocity: 0.04 },
            { sample: 'ride', time: 2, velocity: 0.05 },
            { sample: 'ride', time: 3, velocity: 0.04 },
            { sample: 'kick', time: 2, velocity: 0.8 },
            { sample: 'snare', time: 3.5, velocity: 0.4 },
        ],
        'dreamtales-fill': [ // Fills can be the same for now
            { sample: 'ride', time: 0, velocity: 0.7 },
            { sample: 'ride', time: 1, velocity: 0.6 },
            { sample: 'snare', time: 2.0, velocity: 0.6 },
            { sample: 'snare', time: 2.5, velocity: 0.7 },
            { sample: 'hat', time: 3.0, velocity: 0.5 },
            { sample: 'hat', time: 3.5, velocity: 0.6 },
        ],
        basic: [ { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 }, { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 }, { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 }, ],
        breakbeat: [ { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'kick', time: 0.75 }, { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 }, { sample: 'kick', time: 2 }, { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 }, { sample: 'snare', time: 3.25 }, { sample: 'hat', time: 3.5 }, ],
        slow: [ { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 }, { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 }, ],
        heavy: [ { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 }, { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 }, { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 }, { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 }, ],
        none: [],
    },
    getDrumPattern(name: string) {
        return this.drumPatterns[name as keyof typeof this.drumPatterns] || [];
    },
};

// --- Drum and Effects Generators (Can remain simple for now) ---

class DrumGenerator {
    static createScore(pattern: string, barNumber: number, mixProfile: MixProfile): DrumNote[] {
        const isFillBar = (barNumber + 1) % 8 === 0;
        let score;
        if (isFillBar) {
            score = PatternProvider.getDrumPattern('dreamtales-fill');
        } else if (pattern === 'dreamtales-beat') {
            const patternName = mixProfile === 'mobile' ? 'dreamtales-beat-mobile' : 'dreamtales-beat-desktop';
            score = PatternProvider.getDrumPattern(patternName);
        } else {
            score = PatternProvider.getDrumPattern(pattern);
        }
        return score;
    }
}

class EffectsGenerator {
    static createScore(mode: EffectsSettings['mode'], bar: number, beatsPerBar = 4): EffectNote[] {
        if (mode === 'none') return [];
        const score: EffectNote[] = [];
        let effectType: 'piu' | 'bell' | null = Math.random() > 0.5 ? 'bell' : 'piu';
        if (mode !== 'mixed') effectType = mode;

        if (effectType === 'bell' && Math.random() < 0.4) {
            const windChimeNotes = ['C5', 'Eb5', 'F5', 'G5', 'Bb5'];
            const numberOfChimes = Math.random() > 0.5 ? 5 : 4;
            let currentTime = Math.random() * (beatsPerBar / 2);
            for (let i = 0; i < numberOfChimes; i++) {
                score.push({ type: 'bell', time: currentTime, note: windChimeNotes[Math.floor(Math.random() * windChimeNotes.length)], duration: '4n', isFirst: i === 0 });
                currentTime += 1;
            }
        } else if (effectType === 'piu' && Math.random() < 0.25) {
            score.push({ type: 'piu', time: 2.5, note: 'G5' });
        }
        return score;
    }
}


// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    timeoutId: null as any,
    isRunning: false,
    barCount: 0,
    evolutionEngine: null as EvolutionEngine | null,
    
    // Settings from main thread
    bpm: 75,
    instrumentSettings: {
        solo: { name: 'none', volume: 0.8 },
        accompaniment: { name: 'none', volume: 0.8 },
        bass: { name: 'none', volume: 0.9 },
    } as InstrumentSettings,
    drumSettings: { pattern: 'dreamtales-beat', volume: 0.7 } as DrumSettings,
    effectsSettings: { mode: 'none', volume: 0.7 } as EffectsSettings,
    score: 'dreamtales' as ScoreName,
    mixProfile: 'desktop' as MixProfile,


    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },
    
    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;
        this.evolutionEngine = new EvolutionEngine(new MusicalGenome());
        
        // Start the recursive tick loop
        this.tick();
        
        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        this.isRunning = false;
        this.evolutionEngine = null;
        self.postMessage({ type: 'stopped' });
    },

    reset() {
        this.barCount = 0;
    },
    
    updateSettings(settings: any) {
        if (settings.instrumentSettings) this.instrumentSettings = settings.instrumentSettings;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.effectsSettings) this.effectsSettings = settings.effectsSettings;
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
        if (settings.mixProfile) this.mixProfile = settings.mixProfile;
    },

    tick() {
        if (!this.isRunning) return;

        if (this.score === 'dreamtales' && this.evolutionEngine) {
            // Use the new EvolutionEngine
            if (this.drumSettings.pattern !== 'none') {
                 const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount, this.mixProfile)
                    .map(note => ({ ...note, time: note.time * this.secondsPerBeat }));
                if (drumScore.length > 0) {
                    self.postMessage({ type: 'drum_score', data: { score: drumScore } });
                }
            }
            if (this.instrumentSettings.bass.name !== 'none') {
                const bassScore = this.evolutionEngine.generateBassScore(this.barCount)
                    .map(note => ({...note, time: note.time * this.secondsPerBeat }));
                if (bassScore.length > 0) self.postMessage({ type: 'bass_score', data: { score: bassScore } });
            }
            if (this.instrumentSettings.solo.name !== 'none') {
                const soloScore = this.evolutionEngine.generateSoloScore(this.barCount)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                if (soloScore.length > 0) self.postMessage({ type: 'solo_score', data: { score: soloScore } });
            }
            if (this.instrumentSettings.accompaniment.name !== 'none') {
                const accompanimentScore = this.evolutionEngine.generateAccompanimentScore(this.barCount)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                if(accompanimentScore.length > 0) self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
            }
            const effectsScore = EffectsGenerator.createScore(this.effectsSettings.mode, this.barCount, this.beatsPerBar)
                .map(note => ({ ...note, time: note.time * this.secondsPerBeat }));
            if (effectsScore.length > 0) {
                self.postMessage({ type: 'effects_score', data: { score: effectsScore } });
            }

        } else if (this.score === 'promenade') {
            // Keep promenade as is
            const getNotesForBar = <T extends { time: number | string }>(notes: T[]): T[] => {
                const barStartBeats = this.barCount * this.beatsPerBar;
                const barEndBeats = (this.barCount + 1) * this.beatsPerBar;
                return notes
                    .filter(note => {
                        const noteTimeInBeats = typeof note.time === 'string' ? 0 : note.time;
                        return noteTimeInBeats >= barStartBeats && noteTimeInBeats < barEndBeats;
                    })
                    .map(note => ({ ...note, time: (typeof note.time === 'number' ? note.time - barStartBeats : 0) * this.secondsPerBeat }));
            };
            if (this.drumSettings.pattern !== 'none') {
                const barDrumNotes = getNotesForBar(promenadeScore.drums);
                if (barDrumNotes.length > 0) self.postMessage({ type: 'drum_score', data: { score: barDrumNotes } });
            }
            if (this.instrumentSettings.bass.name !== 'none') {
                const barBassNotes = getNotesForBar(promenadeScore.bass);
                if (barBassNotes.length > 0) self.postMessage({ type: 'bass_score', data: { score: barBassNotes } });
            }
            if (this.instrumentSettings.solo.name !== 'none') {
                 const barSoloNotes = getNotesForBar(promenadeScore.solo as any[]);
                 if (barSoloNotes.length > 0) self.postMessage({ type: 'solo_score', data: { score: barSoloNotes } });
            }
            if (this.instrumentSettings.accompaniment.name !== 'none') {
                 const barAccompanimentNotes = getNotesForBar(promenadeScore.accompaniment as any[]);
                 if (barAccompanimentNotes.length > 0) self.postMessage({ type: 'accompaniment_score', data: { score: barAccompanimentNotes } });
            }
        }
        
        this.barCount++;
        
        // Schedule the next tick
        this.timeoutId = setTimeout(() => this.tick(), this.barDuration * 1000);
    }
};


// --- MessageBus (The "Kafka" entry point) ---
self.onmessage = async (event: MessageEvent) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                self.postMessage({ type: 'initialized' });
                break;
            
            case 'start':
                Scheduler.updateSettings(data);
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

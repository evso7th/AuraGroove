
/// <reference lib="webworker" />

import { promenadeScore } from '@/lib/scores/promenade';
import type { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote, DrumSettings, EffectsSettings, ScoreName, MixProfile, InstrumentSettings } from '@/types/music';


// --- NEW INTELLIGENT COMPOSITION ENGINE ---

/**
 * Generates and holds the unique musical identity for a session.
 * This is the "DNA" of the composition, created once per session.
 */
class MusicalGenome {
    public readonly harmony: { root: string; scale: string[] }[];
    public readonly soloAnchor: string[];
    public readonly accompanimentAnchor: string[][];
    public readonly bassAnchorRiff: { time: number; duration: string }[];

    constructor() {
        this.harmony = [
            { root: 'E', scale: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'] }, // E minor
            { root: 'C', scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] }, // C major
            { root: 'G', scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'] }, // G major
            { root: 'D', scale: ['D', 'F#', 'G', 'A', 'B', 'C#'] }  // D major, adjusted scale
        ];
        
        // --- Procedural Generation of the Anchor ---
        this.soloAnchor = this.generateAnchorMelody();
        this.accompanimentAnchor = this.generateAnchorAccompaniment();

        this.bassAnchorRiff = [
            { time: 0, duration: '2n' },
            { time: 2, duration: '2n' },
        ];
    }
    
    /**
     * Generates a unique, melodious 12-note anchor melody for the session.
     * Uses a constrained random walk to ensure it's playable and pleasant.
     */
    private generateAnchorMelody(): string[] {
        const baseScale = this.harmony[0].scale;
        const melody: string[] = [];
        let lastNoteIndex = Math.floor(baseScale.length / 2); // Start near the middle
        const octave = '4';

        for (let i = 0; i < 12; i++) {
            melody.push(`${baseScale[lastNoteIndex]}${octave}`);
            
            // Bias towards smaller steps
            const step = Math.random() > 0.8 ? (Math.random() > 0.5 ? 2 : -2) : (Math.random() > 0.5 ? 1 : -1);
            lastNoteIndex = (lastNoteIndex + step + baseScale.length) % baseScale.length;
        }
        return melody;
    }

    private generateAnchorAccompaniment(): string[][] {
       const { root, scale } = this.harmony[0];
       const triad1 = [`${root}3`, `${scale[2]}3`, `${scale[4]}3`];
       const { root: root2, scale: scale2 } = this.harmony[1];
       const triad2 = [`${root2}3`, `${scale2[2]}3`, `${scale2[4]}3`];
       return [triad1, triad2];
    }
}


/**
 * The "brain" of the composer. Uses the genome to generate evolving music.
 * Implements the "Rondo" structure (A-B-A-C...)
 */
class EvolutionEngine {
    private genome: MusicalGenome;
    private soloState: { lastPhrase: string[]; };
    private accompanimentState: { lastPhrase: string[][]; };
    private evolutionLengthInBars: number;
    private anchorLengthInBars: number;
    private isAnchorPhase: boolean;
    private barsIntoPhase: number;

    constructor(genome: MusicalGenome) {
        this.genome = genome;
        this.soloState = { lastPhrase: [...this.genome.soloAnchor] };
        this.accompanimentState = { lastPhrase: [...this.genome.accompanimentAnchor] };
        
        // A (Anchor) - B (Evolution) - A (Anchor) - C (Evolution) ...
        this.anchorLengthInBars = 8; // Anchor is 2 bars * 4 reps = 8 bars
        this.evolutionLengthInBars = this.calculateNextEvolutionLength();
        this.isAnchorPhase = true;
        this.barsIntoPhase = 0;
    }

    private calculateNextEvolutionLength(): number {
        // Random duration between 2 and 3 minutes (approx. 40-60 bars at 75bpm)
        return 40 + Math.floor(Math.random() * 21);
    }
    
    private advancePhase() {
        this.barsIntoPhase++;
        const currentPhaseLength = this.isAnchorPhase ? this.anchorLengthInBars : this.evolutionLengthInBars;
        if(this.barsIntoPhase >= currentPhaseLength) {
            this.isAnchorPhase = !this.isAnchorPhase;
            this.barsIntoPhase = 0;
            if(!this.isAnchorPhase) {
                 this.evolutionLengthInBars = this.calculateNextEvolutionLength();
            }
        }
    }

    public getHarmony(bar: number) {
        const chordIndex = Math.floor(bar / 4) % this.genome.harmony.length;
        return this.genome.harmony[chordIndex];
    }

    /**
     * Applies a set of mutation rules to a melody to create the next evolution.
     * This is where the music "develops".
     */
    private evolvePhrase(phrase: string[], harmony: { root: string; scale: string[] }): string[] {
        const scaleWithOctave = harmony.scale.map(n => `${n}4`);

        return phrase.map(note => {
             // Rule 1: Change pitch (most common)
            if (Math.random() < 0.7) {
                const currentIndex = scaleWithOctave.indexOf(note);
                if (currentIndex !== -1) {
                    const step = Math.random() > 0.5 ? 1 : -1;
                    const nextIndex = (currentIndex + step + scaleWithOctave.length) % scaleWithOctave.length;
                    return scaleWithOctave[nextIndex];
                }
            }
            // Rule 2: Keep note the same (less common)
            return note;
        });
    }

    public generateSoloScore(bar: number): SoloNote[] {
        let phrase: string[];
        
        if (this.isAnchorPhase) {
            // Play the unchanging anchor
            phrase = this.genome.soloAnchor;
            // On the last bar of the anchor phase, set up the next evolution
            if (this.barsIntoPhase === this.anchorLengthInBars - 1) {
                this.soloState.lastPhrase = this.evolvePhrase(this.genome.soloAnchor, this.getHarmony(bar));
            }
        } else {
            // Evolve the last phrase
            phrase = this.evolvePhrase(this.soloState.lastPhrase, this.getHarmony(bar));
            this.soloState.lastPhrase = phrase;
        }

        // Convert phrase to score
        return phrase.map((note, i) => ({
            notes: note,
            time: i, // Play as quarter notes
            duration: '4n'
        }));
    }

    public generateAccompanimentScore(bar: number): AccompanimentNote[] {
        if (this.isAnchorPhase) {
            // Play a simple, repetitive chord pattern for the anchor
             const chord = this.genome.accompanimentAnchor[bar % this.genome.accompanimentAnchor.length];
             return [{ notes: chord, time: 0, duration: '1m'}];
        } else {
            // During evolution, make it more sparse and atmospheric
             if (bar % 4 !== 0) return []; // Play only once every 4 bars
             const { root, scale } = this.getHarmony(bar);
             const chord = [`${root}2`, `${scale[2]}3`, `${scale[4]}4`, `${scale[6]}5`]; // Arpeggiated, wide chord
             return [{ notes: chord, time: 0, duration: '1m' }];
        }
    }
    
    // Bass remains stable and foundational, as requested.
    public generateBassScore(bar: number): BassNote[] {
         const { root } = this.getHarmony(bar);
         return this.genome.bassAnchorRiff.map(riffPart => ({
             note: `${root}2`,
             time: riffPart.time,
             duration: riffPart.duration,
             velocity: 0.8
         }));
    }
    
    // Call this at the end of every tick
    public onBarComplete() {
        this.advancePhase();
    }
}


// --- PatternProvider (Remains the same) ---
const PatternProvider = {
    drumPatterns: {
        'dreamtales-beat-desktop': [
            { sample: 'ride', time: 0, velocity: 0.7 },
            { sample: 'ride', time: 1, velocity: 0.6 },
            { sample: 'ride', time: 2, velocity: 0.7 },
            { sample: 'ride', time: 3, velocity: 0.6 },
            { sample: 'kick', time: 0, velocity: 0.8 },
            { sample: 'kick', time: 2, velocity: 0.7 },
        ],
        'dreamtales-beat-mobile': [ 
            { sample: 'ride', time: 0, velocity: 0.05 },
            { sample: 'ride', time: 1, velocity: 0.04 },
            { sample: 'ride', time: 2, velocity: 0.05 },
            { sample: 'ride', time: 3, velocity: 0.04 },
            { sample: 'kick', time: 0, velocity: 0.8 },
            { sample: 'kick', time: 2, velocity: 0.7 },
        ],
        'dreamtales-fill': [
            { sample: 'hat', time: 2.0, velocity: 0.5 },
            { sample: 'hat', time: 2.5, velocity: 0.6 },
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

// --- Drum and Effects Generators (Modified for new logic) ---

class DrumGenerator {
    static createScore(pattern: string, barNumber: number, mixProfile: MixProfile, isAnchorPhase: boolean): DrumNote[] {
        const isFillBar = (barNumber + 1) % 4 === 0 && !isAnchorPhase; // Fills only during evolution
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
    static createScore(mode: EffectsSettings['mode'], bar: number, beatsPerBar = 4, isAnchorPhase: boolean): EffectNote[] {
        if (mode === 'none' || isAnchorPhase) return []; // Effects only during evolution
        const score: EffectNote[] = [];
        let effectType: 'piu' | 'bell' | null = Math.random() > 0.5 ? 'bell' : 'piu';
        if (mode !== 'mixed') effectType = mode;

        if (effectType === 'bell' && Math.random() < 0.2) { // Less frequent
            const windChimeNotes = ['C5', 'Eb5', 'F5', 'G5', 'Bb5'];
            const numberOfChimes = Math.floor(3 + Math.random() * 3);
            let currentTime = Math.random() * (beatsPerBar / 2);
            for (let i = 0; i < numberOfChimes; i++) {
                score.push({ type: 'bell', time: currentTime, note: windChimeNotes[Math.floor(Math.random() * windChimeNotes.length)], duration: '2n', isFirst: i === 0 });
                currentTime += Math.random() * 2;
            }
        } else if (effectType === 'piu' && Math.random() < 0.15) { // Less frequent
            score.push({ type: 'piu', time: Math.random() * beatsPerBar, note: 'G5' });
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
        if (!this.isRunning || !this.evolutionEngine) return;

        if (this.score === 'dreamtales') {
            const engine = this.evolutionEngine;

            if (this.drumSettings.pattern !== 'none') {
                 const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount, this.mixProfile, (engine as any).isAnchorPhase)
                    .map(note => ({ ...note, time: note.time * this.secondsPerBeat }));
                if (drumScore.length > 0) {
                    self.postMessage({ type: 'drum_score', data: { score: drumScore } });
                }
            }
            if (this.instrumentSettings.bass.name !== 'none') {
                const bassScore = engine.generateBassScore(this.barCount)
                    .map(note => ({...note, time: note.time * this.secondsPerBeat }));
                if (bassScore.length > 0) self.postMessage({ type: 'bass_score', data: { score: bassScore } });
            }
            if (this.instrumentSettings.solo.name !== 'none') {
                const soloScore = engine.generateSoloScore(this.barCount)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                if (soloScore.length > 0) self.postMessage({ type: 'solo_score', data: { score: soloScore } });
            }
            if (this.instrumentSettings.accompaniment.name !== 'none') {
                const accompanimentScore = engine.generateAccompanimentScore(this.barCount)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                if(accompanimentScore.length > 0) self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
            }
            if(this.effectsSettings.mode !== 'none') {
                const effectsScore = EffectsGenerator.createScore(this.effectsSettings.mode, this.barCount, this.beatsPerBar, (engine as any).isAnchorPhase)
                    .map(note => ({ ...note, time: note.time * this.secondsPerBeat }));
                if (effectsScore.length > 0) {
                    self.postMessage({ type: 'effects_score', data: { score: effectsScore } });
                }
            }
            
            engine.onBarComplete();

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

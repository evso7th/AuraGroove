
/// <reference lib="webworker" />

import { promenadeScore } from '@/lib/scores/promenade';
import type { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote, DrumSettings, EffectsSettings, InstrumentSettings, ScoreName } from '@/types/music';


// --- NEW INTELLIGENT COMPOSITION ENGINES ---

/**
 * Generates and holds the unique musical identity for a session.
 * This is the "DNA" of the composition, created once per session.
 * Now based on the harmony of "Gammapolis" by Omega.
 */
class MusicalGenome {
    public readonly harmony: { root: string; scale: string[] }[];
    public readonly soloAnchor: string[];
    public readonly accompanimentAnchor: string[][];
    public readonly bassAnchorRiff: { time: number; duration: string }[];

    constructor() {
        // Harmony derived from "Gammapolis" (Dm - C - G - Am ...)
        this.harmony = [
            { root: 'D', scale: ['D', 'E', 'F', 'G', 'A', 'Bb', 'C'] },    // D minor
            { root: 'C', scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] },    // C major
            { root: 'G', scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'] },   // G major
            { root: 'A', scale: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] },     // A minor
        ];
        
        this.soloAnchor = this.generateAnchorMelody();
        this.accompanimentAnchor = this.generateAnchorAccompaniment();

        this.bassAnchorRiff = [
            { time: 0, duration: '1m' },
        ];
    }
    
    private generateAnchorMelody(): string[] {
        // A simple melodic fragment inspired by the main synth theme of Gammapolis
        const baseScale = this.harmony[0].scale; // D minor
        return [
            `${baseScale[4]}4`, `${baseScale[5]}4`, `${baseScale[3]}4`, `${baseScale[4]}4`,
            `${baseScale[2]}4`, `${baseScale[1]}4`, `${baseScale[0]}4`, `${baseScale[6]}3`,
        ];
    }

    private generateAnchorAccompaniment(): string[][] {
       // Based on the core chords of "Gammapolis"
       const chord1 = ['D2', 'F3', 'A3']; // Dm
       const chord2 = ['C3', 'E3', 'G3']; // C
       const chord3 = ['G2', 'B2', 'D3']; // G
       const chord4 = ['A2', 'C3', 'E3']; // Am
       return [chord1, chord2, chord3, chord4];
    }
}

// --- ENGINE 1: L-System Based Evolution ---

class EvolveEngine {
    private genome: MusicalGenome;
    private soloState: { lastNote: string | null; lastPhrase: string[] };
    private evolutionLengthInBars: number;
    public readonly anchorLengthInBars: number;
    public isAnchorPhase: boolean;
    public barsIntoPhase: number;

    constructor(genome: MusicalGenome) {
        this.genome = genome;
        this.soloState = { lastNote: null, lastPhrase: [...this.genome.soloAnchor] };
        
        this.anchorLengthInBars = 8;
        this.evolutionLengthInBars = this.calculateNextEvolutionLength();
        this.isAnchorPhase = true;
        this.barsIntoPhase = 0;
    }

    private calculateNextEvolutionLength(): number {
        // Each evolution phase will last between 40 and 60 bars
        return 40 + Math.floor(Math.random() * 21);
    }
    
    private advancePhase() {
        this.barsIntoPhase++;
        const currentPhaseLength = this.isAnchorPhase ? this.anchorLengthInBars : this.evolutionLengthInBars;
        if(this.barsIntoPhase >= currentPhaseLength) {
            this.isAnchorPhase = !this.isAnchorPhase; // Flip the phase
            this.barsIntoPhase = 0;
            if(!this.isAnchorPhase) {
                 // Calculate a new length for the next evolution phase
                 this.evolutionLengthInBars = this.calculateNextEvolutionLength();
            }
        }
    }
    
    public getHarmony(bar: number) {
        const chordIndex = Math.floor(bar / 4) % this.genome.harmony.length;
        return this.genome.harmony[chordIndex];
    }

    private getChordTones(root: string, scale: string[]): string[] {
        const rootIndex = scale.indexOf(root);
        if (rootIndex === -1) return [root];
        return [
            scale[rootIndex],
            scale[(rootIndex + 2) % scale.length],
            scale[(rootIndex + 4) % scale.length]
        ];
    }
    
    public generateSoloScore(bar: number): SoloNote[] {
        if (this.isAnchorPhase) {
            // During the anchor phase, play a part of the anchor melody
            const anchorNoteIndex = bar % this.genome.soloAnchor.length;
            const note = this.genome.soloAnchor[anchorNoteIndex];
            this.soloState.lastNote = note; // Keep state consistent
            return [{ notes: [note, note], duration: '4n', time: 0 }];
        }

        // Evolution Phase: Generate a new, mutated phrase
        const harmony = this.getHarmony(bar);
        const chordTones = this.getChordTones(harmony.root, harmony.scale);

        const phraseLength = Math.floor(Math.random() * 3) + 2; // 2 to 4 notes
        const score: SoloNote[] = [];
        let currentNote = this.soloState.lastNote || `${chordTones[Math.floor(Math.random() * chordTones.length)]}4`;

        for (let i = 0; i < phraseLength; i++) {
            let nextNote: string;
            const currentOctave = parseInt(currentNote.slice(-1), 10);
            const currentNoteName = currentNote.slice(0, -1);
            let currentNoteIndex = harmony.scale.indexOf(currentNoteName);

            if (currentNoteIndex !== -1 && Math.random() < 0.8) { // 80% stepwise motion
                const direction = Math.random() < 0.5 ? 1 : -1;
                let nextNoteIndex = (currentNoteIndex + direction + harmony.scale.length) % harmony.scale.length;
                let nextOctave = currentOctave;
                if (direction === 1 && nextNoteIndex < currentNoteIndex) nextOctave++;
                if (direction === -1 && nextNoteIndex > currentNoteIndex) nextOctave--;
                nextOctave = Math.max(3, Math.min(5, nextOctave));
                nextNote = `${harmony.scale[nextNoteIndex]}${nextOctave}`;
            } else { // 20% jump to a chord tone
                nextNote = `${chordTones[Math.floor(Math.random() * chordTones.length)]}${currentOctave}`;
            }
            
            score.push({ notes: [nextNote, nextNote], duration: '8n', time: i * 0.5 });
            currentNote = nextNote;
        }

        this.soloState.lastNote = currentNote;
        return score;
    }

    public generateAccompanimentScore(bar: number): AccompanimentNote[] {
        const harmony = this.getHarmony(bar);
        const octave = 3;

        if (this.isAnchorPhase) {
            // Play the anchor chords
            const chordIndex = Math.floor(bar / 2) % this.genome.accompanimentAnchor.length;
            const chord = this.genome.accompanimentAnchor[chordIndex];
            return [{ notes: chord, time: 0, duration: '2n'}];
        }

        // Evolution Phase: Play arpeggios
        const chordTones = this.getChordTones(harmony.root, harmony.scale);
        const chord = chordTones.map(n => `${n}${octave}`);
        
        const arpeggio: AccompanimentNote[] = [];
        const pattern = [0, 1, 2, 1];

        for (let i = 0; i < 4; i++) {
            arpeggio.push({
                notes: [chord[pattern[i % pattern.length]]],
                time: i * 1.0, 
                duration: '4n'
            });
        }
        return arpeggio;
    }
    
    public generateBassScore(bar: number): BassNote[] {
         const { root } = this.getHarmony(bar);
         return this.genome.bassAnchorRiff.map(riffPart => ({
             note: `${root}1`,
             time: riffPart.time,
             duration: riffPart.duration,
             velocity: 0.8
         }));
    }
    
    public onBarComplete() {
        this.advancePhase();
    }
}

// --- ENGINE 2: Mandelbrot Fractal Based Generation ---
class MandelbrotEngine {
    private genome: MusicalGenome;
    private x: number;
    private y: number;
    private zoom: number;
    private maxIterations = 15;

    private startX: number;
    private startY: number;
    private startZoom: number;

    private targetX: number;
    private targetY: number;
    private targetZoom: number;

    private cycleLength = 64; // Bars per "journey"
    private cycleProgress = 0;
    private soloState: { lastNote: string | null; phraseCooldown: number } = { lastNote: null, phraseCooldown: 0 };


    // SAFETY: Reduced some of the extreme zoom levels to prevent mathematical instability
    private readonly INTERESTING_POINTS = [
        { x: -0.745, y: 0.186, zoom: 200 },       // "Seahorse Valley"
        { x: -1.749, y: 0.0003, zoom: 500 },      // A mini-Mandelbrot (Zoom reduced from 1500)
        { x: 0.274, y: 0.008, zoom: 250 },        // "Elephant Valley"
        { x: -0.16, y: 1.04, zoom: 400 },         // A spiral region
        { x: -0.745429, y: 0.113009, zoom: 800 },  // A detailed spiral
        { x: -0.8, y: 0.156, zoom: 450 },         // Another detailed region (Zoom reduced from 1200)
        { x: 0.282, y: 0.01, zoom: 900 }          // Spiral near a cardioid
    ];

    constructor(genome: MusicalGenome) {
        this.genome = genome;
        
        const startPoint = this.INTERESTING_POINTS[Math.floor(Math.random() * this.INTERESTING_POINTS.length)];
        this.x = startPoint.x;
        this.y = startPoint.y;
        
        // SAFETY: Ensure zoom is always a positive, non-zero number.
        this.zoom = Math.max(1, Math.abs(startPoint.zoom));
        
        this.startX = this.x;
        this.startY = this.y;
        this.startZoom = this.zoom;
        
        this.targetX = this.x;
        this.targetY = this.y;
        this.targetZoom = this.zoom;
        this.cycleProgress = 0;
    }

    private setNewTarget() {
        this.startX = this.targetX;
        this.startY = this.targetY;
        this.startZoom = this.targetZoom;
        
        const nextPoint = this.INTERESTING_POINTS[Math.floor(Math.random() * this.INTERESTING_POINTS.length)];
        this.targetX = nextPoint.x;
        this.targetY = nextPoint.y;
        // SAFETY: Ensure new target zoom is also safe.
        this.targetZoom = Math.max(1, Math.abs(nextPoint.zoom));
    }

    private updatePosition() {
        const progressRatio = this.cycleProgress / this.cycleLength;
        const easeRatio = progressRatio < 0.5 ? 2 * progressRatio * progressRatio : 1 - Math.pow(-2 * progressRatio + 2, 2) / 2;

        this.x = this.startX + (this.targetX - this.startX) * easeRatio;
        this.y = this.startY + (this.targetY - this.startY) * easeRatio;
        this.zoom = this.startZoom + (this.targetZoom - this.startZoom) * easeRatio;
    }

    private getMandelbrotValue(cx: number, cy: number): number {
        let zx = 0;
        let zy = 0;
        let i = 0;
        while (zx * zx + zy * zy < 4 && i < this.maxIterations) {
            const tmp = zx * zx - zy * zy + cx;
            zy = 2 * zx * zy + cy;
            zx = tmp;
            i++;
            // SAFETY: Prevent infinite loops from NaN or Infinity values
            if (!Number.isFinite(zx) || !Number.isFinite(zy)) {
                return this.maxIterations;
            }
        }
        return i;
    }

    private getChordTones(root: string, scale: string[]): string[] {
        const rootIndex = scale.indexOf(root);
        if (rootIndex === -1) return [root];
        return [
            scale[rootIndex],
            scale[(rootIndex + 2) % scale.length],
            scale[(rootIndex + 4) % scale.length]
        ];
    }
    
    public getHarmony(bar: number) {
        const chordIndex = Math.floor(bar / 4) % this.genome.harmony.length;
        return this.genome.harmony[chordIndex];
    }
    
    public generateSoloScore(bar: number): SoloNote[] {
        const harmony = this.getHarmony(bar);
        const score: SoloNote[] = [];
        
        if (this.soloState.phraseCooldown > 0) {
            this.soloState.phraseCooldown--;
            return [];
        }

        const phraseLength = 3 + Math.floor(this.getMandelbrotValue(this.x, this.y) / this.maxIterations * 3); // 3-6 notes
        let currentNote = this.soloState.lastNote;

        if (!currentNote || typeof currentNote !== 'string') {
            const chordTones = this.getChordTones(harmony.root, harmony.scale);
            currentNote = `${chordTones[0]}4`;
        }


        for (let i = 0; i < phraseLength; i++) {
            const cx = this.x + (i - 4) / (256 * this.zoom);
            const cy = this.y + (Math.sin(bar + i) * 2) / (256 * this.zoom);
            const value = this.getMandelbrotValue(cx, cy);

            let nextNote: string;
            const currentOctave = parseInt(currentNote.slice(-1), 10);
            const currentNoteName = currentNote.slice(0, -1);
            const currentNoteIndex = harmony.scale.indexOf(currentNoteName);
            
            if (value < this.maxIterations * 0.8 && currentNoteIndex !== -1) { // Use stepwise for stable regions
                const direction = value % 2 === 0 ? 1 : -1;
                let nextOctave = currentOctave;
                const nextNoteIndex = (currentNoteIndex + direction + harmony.scale.length) % harmony.scale.length;
                if (direction === 1 && nextNoteIndex < currentNoteIndex) nextOctave++;
                if (direction === -1 && nextNoteIndex > currentNoteIndex) nextOctave--;
                nextOctave = Math.max(3, Math.min(5, nextOctave));
                nextNote = `${harmony.scale[nextNoteIndex]}${nextOctave}`;
            } else { // Jump to chord tone in chaotic regions
                const chordTones = this.getChordTones(harmony.root, harmony.scale);
                nextNote = `${chordTones[value % chordTones.length]}4`;
            }
            score.push({ notes: [nextNote, nextNote], time: i * 0.5, duration: '8n' });
            currentNote = nextNote;
        }

        this.soloState.lastNote = currentNote;
        this.soloState.phraseCooldown = 2; // Short pause
        return score;
    }

    public generateAccompanimentScore(bar: number): AccompanimentNote[] {
        const harmony = this.getHarmony(bar);
        const value = this.getMandelbrotValue(this.x, this.y);
        const density = value / this.maxIterations;

        const chordTones = this.getChordTones(harmony.root, harmony.scale);
        const chord = chordTones.map(n => `${n}3`);

        if (density < 0.3) { // Stable region -> long chord
            return [{ notes: chord, time: 0, duration: '1m' }];
        } else { // Active region -> arpeggio
            const arpeggio: AccompanimentNote[] = [];
            const pattern = [0, 1, 2, 1];
            for (let i = 0; i < pattern.length; i++) {
                arpeggio.push({ notes: [chord[pattern[i]]], time: i * 1.0, duration: '4n' });
            }
            return arpeggio;
        }
    }
    
    public generateBassScore(bar: number): BassNote[] {
        const harmony = this.getHarmony(bar);
        const value = this.getMandelbrotValue(this.x, this.y);
        const activity = value / this.maxIterations;

        const noteName = Math.random() < 0.2 ? harmony.scale[4] : harmony.root;

        if (activity < 0.3) { // Calm region
             return [{ note: `${noteName}1`, time: 0, duration: '1m', velocity: 0.7 }];
        } else { // Active region
            return [
                { note: `${noteName}1`, time: 0, duration: '2n', velocity: 0.8 },
                { note: `${noteName}1`, time: 2.5, duration: '4n', velocity: 0.75 },
            ];
        }
    }
    
    public onBarComplete() {
        if (this.cycleProgress >= this.cycleLength) {
            this.setNewTarget();
            this.cycleProgress = 0;
        }
        this.updatePosition();
        this.cycleProgress++;
    }
}


// --- PatternProvider (Updated) ---
const PatternProvider = {
    drumPatterns: {
        'ambient-beat': [ 
            { sample: 'kick', time: 0, velocity: 0.8 },
            { sample: 'ride', time: 0, velocity: 0.05 },
            { sample: 'ride', time: 1, velocity: 0.04 },
            { sample: 'kick', time: 2, velocity: 0.7 },
            { sample: 'ride', time: 2, velocity: 0.05 },
            { sample: 'ride', time: 3, velocity: 0.04 },
        ],
        'ambient-fill-1': [
            { sample: 'hat', time: 3.0, velocity: 0.5 },
            { sample: 'hat', time: 3.25, velocity: 0.6 },
            { sample: 'hat', time: 3.5, velocity: 0.5 },
            { sample: 'crash', time: 3.5, velocity: 0.35 },
        ],
        'ambient-fill-2': [
            { sample: 'snare', time: 2.5, velocity: 0.4 },
            { sample: 'hat', time: 3.0, velocity: 0.5 },
            { sample: 'hat', time: 3.25, velocity: 0.6 },
            { sample: 'crash', time: 3.5, velocity: 0.3 },
            { sample: 'crash', time: 3.75, velocity: 0.25 },
        ],
        'ambient-fill-3': [
            { sample: 'snare', time: 3.0, velocity: 0.2 },
            { sample: 'snare', time: 3.25, velocity: 0.3 },
            { sample: 'snare', time: 3.5, velocity: 0.4 },
            { sample: 'snare', time: 3.75, velocity: 0.5 },
        ],
        'ambient-fill-4': [
            { sample: 'kick', time: 3.0, velocity: 0.6 },
            { sample: 'kick', time: 3.5, velocity: 0.7 },
            { sample: 'crash', time: 3.5, velocity: 0.4 },
        ],
        'ambient-fill-5': [
            { sample: 'ride', time: 3.0, velocity: 0.3 },
            { sample: 'ride', time: 3.25, velocity: 0.35 },
            { sample: 'ride', time: 3.5, velocity: 0.4 },
            { sample: 'ride', time: 3.75, velocity: 0.45 },
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
    private static fillPatterns = ['ambient-fill-1', 'ambient-fill-2', 'ambient-fill-3', 'ambient-fill-4', 'ambient-fill-5'];

    static createScore(
        pattern: string, 
        engine: EvolveEngine | MandelbrotEngine | null
    ): DrumNote[] {
        if (!engine) return []; // Should not happen for generative scores

        let score: DrumNote[] = [];
        const playFill = () => {
            const randomFill = this.fillPatterns[Math.floor(Math.random() * this.fillPatterns.length)];
            score = PatternProvider.getDrumPattern(randomFill);
        };
        
        const isEvolveEngine = engine instanceof EvolveEngine;
        const { barsIntoPhase, isAnchorPhase } = isEvolveEngine ? engine : { barsIntoPhase: 0, isAnchorPhase: false };
        const anchorLength = isEvolveEngine ? engine.anchorLengthInBars : 0;


        if (isEvolveEngine && isAnchorPhase) {
            const isFirstBar = barsIntoPhase === 0;
            const isLastBar = barsIntoPhase === anchorLength - 1;

            if ((isFirstBar || isLastBar) && Math.random() < 0.7) {
                playFill();
            } else {
                score = PatternProvider.getDrumPattern(pattern);
            }
        } else { // Evolution Phase or Mandelbrot
            const isFillBar = (engine.barsIntoPhase + 1) % 2 === 0 && Math.random() < 0.6;
            if (isFillBar) {
                playFill();
            } else {
                score = PatternProvider.getDrumPattern(pattern);
            }
        }
        return score;
    }
}

class EffectsGenerator {
    static createScore(mode: EffectsSettings['mode'], engine: EvolveEngine | MandelbrotEngine | null, beatsPerBar = 4): EffectNote[] {
        if (mode === 'none' || !engine || (engine instanceof EvolveEngine && engine.isAnchorPhase)) return [];
        
        const score: EffectNote[] = [];
        let effectType: 'piu' | 'bell' | null = Math.random() > 0.5 ? 'bell' : 'piu';
        if (mode !== 'mixed') effectType = mode;

        if (effectType === 'bell' && Math.random() < 0.2) {
            const windChimeNotes = ['C5', 'Eb5', 'F5', 'G5', 'Bb5'];
            const numberOfChimes = Math.floor(3 + Math.random() * 3);
            let currentTime = Math.random() * (beatsPerBar / 2);
            for (let i = 0; i < numberOfChimes; i++) {
                score.push({ type: 'bell', time: currentTime, note: windChimeNotes[Math.floor(Math.random() * windChimeNotes.length)], duration: '2n', isFirst: i === 0 });
                currentTime += Math.random() * 2;
            }
        } else if (effectType === 'piu' && Math.random() < 0.15) {
            score.push({ type: 'piu', time: Math.random() * beatsPerBar, note: 'G5' });
        }
        return score;
    }
}


// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    isRunning: false,
    barCount: 0,
    compositionEngine: null as EvolveEngine | MandelbrotEngine | null,
    
    // Settings from main thread
    bpm: 75,
    instrumentSettings: {
        solo: { name: 'none', volume: 0.8 },
        accompaniment: { name: 'none', volume: 0.7 },
        bass: { name: 'none', volume: 0.9 },
    } as InstrumentSettings,
    drumSettings: { pattern: 'ambient-beat', volume: 0.7 } as DrumSettings,
    effectsSettings: { mode: 'none', volume: 0.7 } as EffectsSettings,
    score: 'promenade' as ScoreName,


    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    
    setCompositionEngine(score: ScoreName) {
        console.log(`[WORKER_TRACE] Setting composition engine to: ${score}`);
        const genome = new MusicalGenome();
        if (score === 'evolve') {
            this.compositionEngine = new EvolveEngine(genome);
        } else if (score === 'omega') {
            this.compositionEngine = new MandelbrotEngine(genome);
        } else {
            this.compositionEngine = null; // For 'promenade'
        }
    },
    
    start() {
        console.log("[WORKER_TRACE] Scheduler start called.");
        if (this.isRunning) return;
        
        this.reset();
        this.isRunning = true;
        this.setCompositionEngine(this.score);
        
        self.postMessage({ type: 'started' });
    },

    stop() {
        console.log("[WORKER_TRACE] Scheduler stop called.");
        if (!this.isRunning) return;
        this.isRunning = false;
        this.compositionEngine = null;
        self.postMessage({ type: 'stopped' });
    },

    reset() {
        console.log("[WORKER_TRACE] Scheduler reset.");
        this.barCount = 0;
    },
    
    updateSettings(settings: any) {
        console.log("[WORKER_TRACE] Scheduler updateSettings called with: ", settings);
        if (settings.instrumentSettings) this.instrumentSettings = settings.instrumentSettings;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.effectsSettings) this.effectsSettings = settings.effectsSettings;
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score && this.score !== settings.score) {
            this.score = settings.score;
            this.setCompositionEngine(this.score);
        }
    },

    tick(time: number, barCount: number) {
        console.log(`[WORKER_TRACE] Scheduler tick for bar ${barCount} at time ${time}`);
        if (!this.isRunning) return;
        
        this.barCount = barCount;

        if (this.compositionEngine) {
            const engine = this.compositionEngine;
            
            if (this.drumSettings.pattern !== 'none') {
                const drumScore = DrumGenerator.createScore(
                    this.drumSettings.pattern, 
                    engine
                ).map(note => ({ ...note, time: note.time * this.secondsPerBeat }));

                if (drumScore.length > 0) {
                    console.log(`[WORKER_TRACE] Posting drum_score for bar ${this.barCount}`);
                    self.postMessage({ type: 'drum_score', bar: this.barCount, data: drumScore });
                }
            }
            if (this.instrumentSettings.bass.name !== 'none') {
                const bassScore = engine.generateBassScore(this.barCount)
                    .map(note => ({...note, time: note.time * this.secondsPerBeat }));
                if (bassScore.length > 0) {
                     console.log(`[WORKER_TRACE] Posting bass_score for bar ${this.barCount}`);
                    self.postMessage({ type: 'bass_score', bar: this.barCount, data: bassScore });
                }
            }
            if (this.instrumentSettings.solo.name !== 'none') {
                const soloScore = engine.generateSoloScore(this.barCount)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                if (soloScore.length > 0) {
                    console.log(`[WORKER_TRACE] Posting solo_score for bar ${this.barCount}`);
                    self.postMessage({ type: 'solo_score', bar: this.barCount, data: soloScore });
                }
            }
            if (this.instrumentSettings.accompaniment.name !== 'none') {
                const accompanimentScore = engine.generateAccompanimentScore(this.barCount)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                if(accompanimentScore.length > 0) {
                    console.log(`[WORKER_TRACE] Posting accompaniment_score for bar ${this.barCount}`);
                    self.postMessage({ type: 'accompaniment_score', bar: this.barCount, data: accompanimentScore });
                }
            }
            if(this.effectsSettings.mode !== 'none') {
                const effectsScore = EffectsGenerator.createScore(this.effectsSettings.mode, engine, this.beatsPerBar)
                    .map(note => ({ ...note, time: note.time * this.secondsPerBeat }));
                if (effectsScore.length > 0) {
                     console.log(`[WORKER_TRACE] Posting effects_score for bar ${this.barCount}`);
                    self.postMessage({ type: 'effects_score', bar: this.barCount, data: effectsScore });
                }
            }
            
            engine.onBarComplete();

        } else if (this.score === 'promenade') {
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
                const drumScore = getNotesForBar(promenadeScore.drums);
                if (drumScore.length > 0) {
                    console.log(`[WORKER_TRACE] Posting drum_score for bar ${this.barCount}`);
                    self.postMessage({ type: 'drum_score', bar: this.barCount, data: drumScore });
                }
            }
            if(this.instrumentSettings.bass.name !== 'none') {
                const bassScore = getNotesForBar(promenadeScore.bass);
                if (bassScore.length > 0) {
                    console.log(`[WORKER_TRACE] Posting bass_score for bar ${this.barCount}`);
                    self.postMessage({ type: 'bass_score', bar: this.barCount, data: bassScore });
                }
            }
            if (this.instrumentSettings.solo.name !== 'none') {
                const soloScore = getNotesForBar(promenadeScore.solo as any[]);
                if (soloScore.length > 0) {
                    console.log(`[WORKER_TRACE] Posting solo_score for bar ${this.barCount}`);
                    self.postMessage({ type: 'solo_score', bar: this.barCount, data: soloScore });
                }
            }
            if (this.instrumentSettings.accompaniment.name !== 'none') {
                const accompanimentScore = getNotesForBar(promenadeScore.accompaniment as any[]);
                if (accompanimentScore.length > 0) {
                    console.log(`[WORKER_TRACE] Posting accompaniment_score for bar ${this.barCount}`);
                    self.postMessage({ type: 'accompaniment_score', bar: this.barCount, data: accompanimentScore });
                }
            }
        }
    }
};


// --- MessageBus (The "Kafka" entry point) ---
self.onmessage = async (event: MessageEvent) => {
    const { command, data, time, barCount } = event.data;
    console.log(`[WORKER_TRACE] Received command: ${command}`, event.data);

    try {
        switch (command) {
            case 'init':
                console.log("[WORKER_TRACE] Case: init");
                self.postMessage({ type: 'initialized' });
                break;
            
            case 'start':
                console.log("[WORKER_TRACE] Case: start");
                Scheduler.updateSettings(data);
                Scheduler.start();
                break;

            case 'stop':
                 console.log("[WORKER_TRACE] Case: stop");
                Scheduler.stop();
                break;
            
            case 'update_settings':
                console.log("[WORKER_TRACE] Case: update_settings");
                Scheduler.updateSettings(data);
                break;
            
            case 'tick':
                 console.log("[WORKER_TRACE] Case: tick");
                Scheduler.tick(time, barCount);
                break;
        }
    } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        console.error("[WORKER_TRACE] Error in worker:", error);
        self.postMessage({ type: 'error', error });
    }
};

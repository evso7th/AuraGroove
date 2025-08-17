
/// <reference lib="webworker" />

import { promenadeScore } from '@/lib/scores/promenade';
import type { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote, DrumSettings, EffectsSettings, ScoreName, InstrumentSettings } from '@/types/music';


// --- NEW INTELLIGENT COMPOSITION ENGINES ---

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
            { root: 'D', scale: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'] }  // D major, adjusted scale
        ];
        
        this.soloAnchor = this.generateAnchorMelody();
        this.accompanimentAnchor = this.generateAnchorAccompaniment();

        this.bassAnchorRiff = [
            { time: 0, duration: '2n' },
            { time: 2, duration: '2n' },
        ];
    }
    
    private generateAnchorMelody(): string[] {
        const baseScale = this.harmony[0].scale;
        const melody: string[] = [];
        let lastNoteIndex = Math.floor(baseScale.length / 2);
        
        for (let i = 0; i < 12; i++) {
            const octave = Math.random() < 0.7 ? '3' : '4';
            melody.push(`${baseScale[lastNoteIndex]}${octave}`);
            const step = Math.random() > 0.8 ? (Math.random() > 0.5 ? 2 : -2) : (Math.random() > 0.5 ? 1 : -1);
            lastNoteIndex = (lastNoteIndex + step + baseScale.length) % baseScale.length;
        }
        return melody;
    }

    private generateAnchorAccompaniment(): string[][] {
       const { root, scale } = this.harmony[0];
       const octave3 = Math.random() < 0.8 ? '3' : '4';
       const octave4 = Math.random() < 0.2 ? '3' : '4';
       const triad1 = [`${root}3`, `${scale[2]}${octave3}`, `${scale[4]}${octave4}`];
       const { root: root2, scale: scale2 } = this.harmony[1];
       const triad2 = [`${root2}3`, `${scale2[2]}3`, `${scale2[4]}3`];
       return [triad1, triad2];
    }
}

// --- ENGINE 1: L-System Based Evolution ---

class EvolveEngine {
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
        
        this.anchorLengthInBars = 8;
        this.evolutionLengthInBars = this.calculateNextEvolutionLength();
        this.isAnchorPhase = true;
        this.barsIntoPhase = 0;
    }

    private calculateNextEvolutionLength(): number {
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
    
    private isTransitionBar(): boolean {
        const currentPhaseLength = this.isAnchorPhase ? this.anchorLengthInBars : this.evolutionLengthInBars;
        return this.barsIntoPhase === currentPhaseLength - 1;
    }

    public getHarmony(bar: number) {
        const chordIndex = Math.floor(bar / 4) % this.genome.harmony.length;
        return this.genome.harmony[chordIndex];
    }

    private evolvePhrase(phrase: string[], harmony: { root: string; scale: string[] }): string[] {
        const newPhrase = [...phrase];
        const scale = harmony.scale;
        
        for (let i = 0; i < newPhrase.length; i++) {
             if (Math.random() < 0.4) { 
                const note = newPhrase[i];
                const noteName = note.slice(0, -1);
                const octave = parseInt(note.slice(-1), 10);
                const currentNoteIndexInScale = scale.indexOf(noteName);

                if (Math.random() < 0.7 && currentNoteIndexInScale !== -1) {
                     const step = Math.random() < 0.5 ? 1 : -1;
                     const nextNoteName = scale[(currentNoteIndexInScale + step + scale.length) % scale.length];
                     newPhrase[i] = `${nextNoteName}${octave}`;
                } 
                else if (Math.random() < 0.2) {
                     const chordTones = [scale[0], scale[2], scale[4]];
                     const targetTone = chordTones[Math.floor(Math.random() * chordTones.length)];
                     const targetOctave = Math.random() < 0.7 ? 3 : 4; 
                     newPhrase[i] = `${targetTone}${targetOctave}`;
                }
                else if (i > 0 && Math.random() < 0.1) {
                    newPhrase[i] = newPhrase[i-1];
                }
                else if (Math.random() < 0.05) {
                    const newOctave = octave === 3 ? 4 : 3;
                    newPhrase[i] = `${noteName}${newOctave}`;
                }
            }
        }
        return newPhrase;
    }

    public generateSoloScore(bar: number): SoloNote[] {
        let phrase: string[];
        
        if (this.isAnchorPhase) {
            phrase = this.genome.soloAnchor;
            if (this.isTransitionBar()) {
                this.soloState.lastPhrase = this.evolvePhrase(this.genome.soloAnchor, this.getHarmony(bar));
            }
        } else {
            if (this.isTransitionBar()) {
                const { scale } = this.getHarmony(bar);
                phrase = [scale[0], scale[2], scale[1], scale[0]].map(n => `${n}3`); 
            } else {
                phrase = this.evolvePhrase(this.soloState.lastPhrase, this.getHarmony(bar));
                this.soloState.lastPhrase = phrase;
            }
        }

        return phrase.map((note, i) => ({
            notes: note,
            time: i,
            duration: '4n.'
        }));
    }

    public generateAccompanimentScore(bar: number): AccompanimentNote[] {
        if (this.isAnchorPhase) {
             if (this.isTransitionBar()) {
                 const chord = this.genome.accompanimentAnchor[bar % this.genome.accompanimentAnchor.length];
                 return [{ notes: [chord[0], chord[2]], time: 0, duration: '2n' }]; 
             }
             const chord = this.genome.accompanimentAnchor[bar % this.genome.accompanimentAnchor.length];
             return [{ notes: chord, time: 0, duration: '1m'}];
        } else {
             const { scale } = this.getHarmony(bar);
             const octave3 = Math.random() < 0.8 ? '3' : '4';
             const octave4 = Math.random() < 0.2 ? '3' : '4';
             const chord = [`${scale[0]}${octave3}`, `${scale[2]}${octave3}`, `${scale[4]}${octave4}`];
             const arpeggio: AccompanimentNote[] = [];

             if (this.isTransitionBar()) {
                 arpeggio.push({ notes: [chord[0]], time: 0, duration: '2n' });
                 arpeggio.push({ notes: [chord[1]], time: 2, duration: '2n' });
                 return arpeggio;
             }
             
             const pattern = [chord[0], chord[1], chord[2], chord[1]]; 
             for (let i = 0; i < 4; i++) { 
                arpeggio.push({
                    notes: [pattern[i]],
                    time: i, 
                    duration: '8n'
                });
             }
             return arpeggio;
        }
    }
    
    public generateBassScore(bar: number): BassNote[] {
         const { root } = this.getHarmony(bar);
         return this.genome.bassAnchorRiff.map(riffPart => ({
             note: `${root}2`,
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
    private maxIterations = 50;

    private startX: number;
    private startY: number;
    private startZoom: number;

    private targetX: number;
    private targetY: number;
    private targetZoom: number;

    private cycleLength = 64; // Bars per "journey"
    private cycleProgress = 0;

    private readonly INTERESTING_POINTS = [
        { x: -0.745, y: 0.186, zoom: 200 },       // "Seahorse Valley"
        { x: -1.749, y: 0.0003, zoom: 1500 },      // A mini-Mandelbrot
        { x: 0.274, y: 0.008, zoom: 250 },        // "Elephant Valley"
        { x: -0.16, y: 1.04, zoom: 400 },         // A spiral region
        { x: -0.745429, y: 0.113009, zoom: 800 },  // A detailed spiral
        { x: -0.8, y: 0.156, zoom: 1200 },         // Another detailed region
        { x: 0.282, y: 0.01, zoom: 900 }          // Spiral near a cardioid
    ];

    constructor(genome: MusicalGenome) {
        this.genome = genome;
        
        // Start at a random beautiful location
        const startPoint = this.INTERESTING_POINTS[Math.floor(Math.random() * this.INTERESTING_POINTS.length)];
        this.x = startPoint.x;
        this.y = startPoint.y;
        this.zoom = startPoint.zoom;
        
        this.startX = this.x;
        this.startY = this.y;
        this.startZoom = this.zoom;
        
        // Set the first target
        this.targetX = this.x;
        this.targetY = this.y;
        this.targetZoom = this.zoom;
        this.cycleProgress = this.cycleLength; // Force a new target on the first run
    }

    private setNewTarget() {
        this.startX = this.targetX;
        this.startY = this.targetY;
        this.startZoom = this.targetZoom;
        
        const nextPoint = this.INTERESTING_POINTS[Math.floor(Math.random() * this.INTERESTING_POINTS.length)];
        this.targetX = nextPoint.x;
        this.targetY = nextPoint.y;
        this.targetZoom = nextPoint.zoom;
    }

    private updatePosition() {
        const progressRatio = this.cycleProgress / this.cycleLength;
        // Ease-in-out curve for smoother transition
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
        }
        return i;
    }

    public getHarmony(bar: number) {
        const chordIndex = Math.floor(bar / 4) % this.genome.harmony.length;
        return this.genome.harmony[chordIndex];
    }
    
    public generateSoloScore(bar: number): SoloNote[] {
        const harmony = this.getHarmony(bar);
        const score: SoloNote[] = [];
        for (let i = 0; i < 8; i++) { // 8 notes per bar
            const cx = this.x + (i - 4) / (256 * this.zoom);
            const cy = this.y + (Math.sin(bar + i) * 2) / (256 * this.zoom);

            const value = this.getMandelbrotValue(cx, cy);

            if (value < this.maxIterations) {
                const noteIndex = value % harmony.scale.length;
                const octave = (Math.floor(value / harmony.scale.length) % 2) + 3; // Octaves 3 or 4
                const note = `${harmony.scale[noteIndex]}${octave}`;
                const durationValue = (this.maxIterations - value) / this.maxIterations;
                const duration = durationValue > 0.5 ? '4n' : '8n';
                score.push({
                    notes: note,
                    time: i * 0.5,
                    duration: duration,
                });
            }
        }
        return score;
    }

    public generateAccompanimentScore(bar: number): AccompanimentNote[] {
        const harmony = this.getHarmony(bar);
        const value = this.getMandelbrotValue(this.x, this.y);
        const density = value / this.maxIterations;
        const isTransitionBar = this.cycleProgress === this.cycleLength - 1;

        if (isTransitionBar) {
            return [{ notes: [`${harmony.scale[0]}3`], time: 0, duration: '1m' }];
        }

        if (density < 0.2) { // Stable region -> long chord
            return [{ notes: [`${harmony.scale[0]}3`, `${harmony.scale[2]}3`, `${harmony.scale[4]}3`], time: 0, duration: '1m' }];
        } else { // Active region -> arpeggio
            const chord = [`${harmony.scale[0]}3`, `${harmony.scale[2]}3`, `${harmony.scale[4]}3`];
            const arpeggio: AccompanimentNote[] = [];
            for (let i = 0; i < 4; i++) {
                arpeggio.push({ notes: [chord[i % 3]], time: i, duration: '8n' });
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
                { note: `${noteName}1`, time: 2, duration: '2n', velocity: 0.75 },
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
    private static fillPatterns = ['ambient-fill-1', 'ambient-fill-2', 'ambient-fill-3'];

    static createScore(pattern: string, barNumber: number, isAnchorPhase: boolean): DrumNote[] {
        const isFillBar = (barNumber + 1) % 4 === 0 && !isAnchorPhase;
        let score;
        if (isFillBar) {
            const randomFill = this.fillPatterns[Math.floor(Math.random() * this.fillPatterns.length)];
            score = PatternProvider.getDrumPattern(randomFill);
        } else {
            score = PatternProvider.getDrumPattern(pattern);
        }
        return score;
    }
}

class EffectsGenerator {
    static createScore(mode: EffectsSettings['mode'], bar: number, beatsPerBar = 4, isAnchorPhase: boolean): EffectNote[] {
        if (mode === 'none' || isAnchorPhase) return [];
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
    timeoutId: null as any,
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
    score: 'evolve' as ScoreName,


    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },
    
    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;
        
        const genome = new MusicalGenome();
        if (this.score === 'evolve') {
            this.compositionEngine = new EvolveEngine(genome);
        } else if (this.score === 'fractal') {
            this.compositionEngine = new MandelbrotEngine(genome);
        } else {
            this.compositionEngine = null; // for promenade
        }
        
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
        this.compositionEngine = null;
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
    },

    tick() {
        if (!this.isRunning) return;

        if (this.compositionEngine) {
            const engine = this.compositionEngine;
            const isAnchorPhase = (engine instanceof EvolveEngine) && (engine as any).isAnchorPhase;

            if (this.drumSettings.pattern !== 'none') {
                 const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount, isAnchorPhase)
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
                const effectsScore = EffectsGenerator.createScore(this.effectsSettings.mode, this.barCount, this.beatsPerBar, isAnchorPhase)
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

    

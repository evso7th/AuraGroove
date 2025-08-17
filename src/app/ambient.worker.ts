
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
            { root: 'D', scale: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'] }  // D major, adjusted scale
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
        
        for (let i = 0; i < 12; i++) {
            const octave = Math.random() < 0.7 ? '3' : '4'; // Prefer 3rd octave
            melody.push(`${baseScale[lastNoteIndex]}${octave}`);
            
            // Bias towards smaller steps
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


/**
 * The "brain" of the composer. Uses the genome to generate evolving music.
 * Implements the "Rondo" structure (A-B-A-C...) with smooth transitions.
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
            // Pre-evolve the next phrase on the last bar of the anchor phase
            if (this.isTransitionBar()) {
                this.soloState.lastPhrase = this.evolvePhrase(this.genome.soloAnchor, this.getHarmony(bar));
            }
        } else {
            // On the last bar of evolution, generate a simpler, resolving phrase
            if (this.isTransitionBar()) {
                const { scale } = this.getHarmony(bar);
                phrase = [scale[0], scale[2], scale[1], scale[0]].map(n => `${n}3`); // Simple resolving melody
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
             // On the transition bar, play a sparser chord to lead into the arpeggio
             if (this.isTransitionBar()) {
                 const chord = this.genome.accompanimentAnchor[bar % this.genome.accompanimentAnchor.length];
                 return [{ notes: [chord[0], chord[2]], time: 0, duration: '2n' }]; // Play only root and fifth
             }
             const chord = this.genome.accompanimentAnchor[bar % this.genome.accompanimentAnchor.length];
             return [{ notes: chord, time: 0, duration: '1m'}];
        } else {
             const { scale } = this.getHarmony(bar);
             const octave3 = Math.random() < 0.8 ? '3' : '4';
             const octave4 = Math.random() < 0.2 ? '3' : '4';
             const chord = [`${scale[0]}${octave3}`, `${scale[2]}${octave3}`, `${scale[4]}${octave4}`];
             const arpeggio: AccompanimentNote[] = [];

             // On the transition bar, slow down the arpeggio to resolve into the anchor chord
             if (this.isTransitionBar()) {
                 arpeggio.push({ notes: [chord[0]], time: 0, duration: '2n' });
                 arpeggio.push({ notes: [chord[1]], time: 2, duration: '2n' });
                 return arpeggio;
             }
             
             // Slower, more sparse 8th note arpeggio
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


// --- PatternProvider (Remains the same) ---
const PatternProvider = {
    drumPatterns: {
        'dreamtales-beat-desktop': [
            // Core beat
            { sample: 'kick', time: 0, velocity: 0.8 },
            { sample: 'ride', time: 0, velocity: 0.7 },
            { sample: 'ride', time: 1, velocity: 0.6 },
            { sample: 'kick', time: 2, velocity: 0.7 },
            { sample: 'ride', time: 2, velocity: 0.7 },
            { sample: 'ride', time: 3, velocity: 0.6 },
            // Ghost notes and hats
            { sample: 'snare', time: 1.75, velocity: 0.08 }, // Ghost note
            { sample: 'hat', time: 2.5, velocity: 0.2 },     // Infrequent hat
            { sample: 'snare', time: 3.5, velocity: 0.1 },   // Ghost note
        ],
        'dreamtales-beat-mobile': [ 
            // Simplified for mobile clarity
            { sample: 'kick', time: 0, velocity: 0.8 },
            { sample: 'ride', time: 0, velocity: 0.05 },
            { sample: 'ride', time: 1, velocity: 0.04 },
            { sample: 'kick', time: 2, velocity: 0.7 },
            { sample: 'ride', time: 2, velocity: 0.05 },
            { sample: 'ride', time: 3, velocity: 0.04 },
        ],
        'dreamtales-fill-1': [ // Simple fill with soft single crash
            { sample: 'hat', time: 3.0, velocity: 0.5 },
            { sample: 'hat', time: 3.25, velocity: 0.6 },
            { sample: 'hat', time: 3.5, velocity: 0.5 },
            { sample: 'crash', time: 3.5, velocity: 0.35 }, // Soft crash
        ],
        'dreamtales-fill-2': [ // More complex fill with double crash
            { sample: 'snare', time: 2.5, velocity: 0.4 },
            { sample: 'hat', time: 3.0, velocity: 0.5 },
            { sample: 'hat', time: 3.25, velocity: 0.6 },
            { sample: 'crash', time: 3.5, velocity: 0.3 }, // Soft
            { sample: 'crash', time: 3.75, velocity: 0.25 },// Softer
        ],
        'dreamtales-fill-3': [ // A rolling snare fill
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
    private static fillPatterns = ['dreamtales-fill-1', 'dreamtales-fill-2', 'dreamtales-fill-3'];

    static createScore(pattern: string, barNumber: number, mixProfile: MixProfile, isAnchorPhase: boolean): DrumNote[] {
        const isFillBar = (barNumber + 1) % 4 === 0 && !isAnchorPhase; // Fills only during evolution
        let score;
        if (isFillBar) {
            const randomFill = this.fillPatterns[Math.floor(Math.random() * this.fillPatterns.length)];
            score = PatternProvider.getDrumPattern(randomFill);
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

    

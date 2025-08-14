
/// <reference lib="webworker" />

import { promenadeScore } from '@/lib/scores/promenade';
import type { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote } from '@/types/music';

// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 0.5 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 },
            { sample: 'hat', time: 2.5 },
            { sample: 'snare', time: 3 },
            { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 0.5 },
            { sample: 'kick', time: 0.75 },
            { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 },
            { sample: 'snare', time: 2.5 },
            { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 },
            { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0 },
            { sample: 'hat', time: 1 },
            { sample: 'snare', time: 2 },
            { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 },
            { sample: 'ride', time: 0.5 },
            { sample: 'snare', time: 1, velocity: 1.0 },
            { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 },
            { sample: 'ride', time: 2.5 },
            { sample: 'snare', time: 3, velocity: 1.0 },
            { sample: 'ride', time: 3.5 },
        ],
    },
    getDrumPattern(name: string) {
        return this.drumPatterns[name as keyof typeof this.drumPatterns] || this.drumPatterns.basic;
    },
};

// --- "Smoke on the Water" Riff Definition ---
const smokeOnTheWaterRiff = [
    // Bar 1
    { time: 0, duration: '4n', notes: { bass: 'G2', solo: 'G3', accompaniment: ['G2', 'D3', 'G3'] }},
    { time: 1, duration: '4n', notes: { bass: 'A#2', solo: 'A#3', accompaniment: ['A#2', 'F3', 'A#3'] }},
    { time: 2, duration: '2n', notes: { bass: 'C3', solo: 'C4', accompaniment: ['C3', 'G3', 'C4'] }},
    // Bar 2
    { time: 4, duration: '4n', notes: { bass: 'G2', solo: 'G3', accompaniment: ['G2', 'D3', 'G3'] }},
    { time: 5, duration: '4n', notes: { bass: 'A#2', solo: 'A#3', accompaniment: ['A#2', 'F3', 'A#3'] }},
    { time: 6, duration: '4n', notes: { bass: 'C#3', solo: 'C#4', accompaniment: ['C#3', 'G#3', 'C#4'] }},
    { time: 7, duration: '4n', notes: { bass: 'C3', solo: 'C4', accompaniment: ['C3', 'G3', 'C4'] }},
    // Bar 3
    { time: 8, duration: '4n', notes: { bass: 'G2', solo: 'G3', accompaniment: ['G2', 'D3', 'G3'] }},
    { time: 9, duration: '4n', notes: { bass: 'A#2', solo: 'A#3', accompaniment: ['A#2', 'F3', 'A#3'] }},
    { time: 10, duration: '2n', notes: { bass: 'C3', solo: 'C4', accompaniment: ['C3', 'G3', 'C4'] }},
    // Bar 4
    { time: 12, duration: '4n', notes: { bass: 'A#2', solo: 'A#3', accompaniment: ['A#2', 'F3', 'A#3'] }},
    { time: 13, duration: '2n', notes: { bass: 'G2', solo: 'G3', accompaniment: ['G2', 'D3', 'G3'] }},
];


// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName: string, barNumber: number, totalBars: number, beatsPerBar = 4): DrumNote[] {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score: DrumNote[] = [...pattern];

        if (barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        
        return score;
    }
}

class BassGenerator {
     static createScore(bar: number, beatsPerBar = 4): BassNote[] {
        const barStartBeat = (bar % 4) * beatsPerBar;
        const barEndBeat = barStartBeat + beatsPerBar;

        return smokeOnTheWaterRiff
            .filter(note => note.time >= barStartBeat && note.time < barEndBeat)
            .map(note => ({
                note: note.notes.bass,
                time: note.time - barStartBeat,
                duration: note.duration,
                velocity: 0.9
            }));
    }
}

class SoloGenerator {
     static createScore(bar: number, beatsPerBar = 4): SoloNote[] {
        const barStartBeat = (bar % 4) * beatsPerBar;
        const barEndBeat = barStartBeat + beatsPerBar;
       
        return smokeOnTheWaterRiff
            .filter(note => note.time >= barStartBeat && note.time < barEndBeat)
            .map(note => ({
                notes: note.notes.solo,
                time: note.time - barStartBeat,
                duration: note.duration,
            }));
    }
}
class AccompanimentGenerator {
   static createScore(bar: number, beatsPerBar = 4): AccompanimentNote[] {
        const barStartBeat = (bar % 4) * beatsPerBar;
        const barEndBeat = barStartBeat + beatsPerBar;
       
        return smokeOnTheWaterRiff
            .filter(note => note.time >= barStartBeat && note.time < barEndBeat)
            .map(note => ({
                notes: note.notes.accompaniment,
                time: note.time - barStartBeat,
                duration: note.duration,
            }));
    }
}

class EffectsGenerator {
    static createScore(bar: number, beatsPerBar = 4): EffectNote[] {
        const score: EffectNote[] = [];
        // Add a bell sound on the first beat of every 4th bar
        if (bar % 4 === 0) {
            score.push({ type: 'bell', time: 0, note: 'C5' });
        }
        // Add a "piu" sound on the 3rd beat of every bar
        score.push({ type: 'piu', time: 2.5, note: 'G5' });
        return score;
    }
}


// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null as any,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    bpm: 100,
    instruments: { solo: 'none', accompaniment: 'none', bass: 'none' } as any,
    drumSettings: { enabled: false, pattern: 'basic' } as any,
    score: 'generative' as 'generative' | 'promenade',


    // Calculated properties
    get beatsPerBar() { return 4; },
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },
    get lookahead() { return 0.1; }, // seconds


    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;
        
        // Generate the first chunk immediately
        this.tick();

        // Then set up the interval for subsequent chunks
        this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.isRunning = false;
        self.postMessage({ type: 'stopped' });
    },

    reset() {
        this.barCount = 0;
    },
    
    updateSettings(settings: any) {
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
    },

    tick() {
        if (!this.isRunning) return;
        
        const currentBarStartTime = this.barCount * this.barDuration;

        if (this.score === 'promenade') {
            const getNotesForBar = <T extends { time: number | string }>(notes: T[]): T[] => {
                const barStartBeats = this.barCount * this.beatsPerBar;
                const barEndBeats = (this.barCount + 1) * this.beatsPerBar;

                return notes
                    .filter(note => {
                        const noteTimeInBeats = typeof note.time === 'string' 
                            ? 0 // This logic is simplified; Tone.Time would be needed for full conversion
                            : note.time;
                        return noteTimeInBeats >= barStartBeats && noteTimeInBeats < barEndBeats;
                    })
                    .map(note => ({
                        ...note,
                        time: (typeof note.time === 'number' ? note.time - barStartBeats : 0) * this.secondsPerBeat
                    }));
            };
            
            if (this.drumSettings.enabled) {
                const barDrumNotes = getNotesForBar(promenadeScore.drums);
                if (barDrumNotes.length > 0) self.postMessage({ type: 'drum_score', data: { score: barDrumNotes } });
            }
            if (this.instruments.bass !== 'none') {
                const barBassNotes = getNotesForBar(promenadeScore.bass);
                if (barBassNotes.length > 0) self.postMessage({ type: 'bass_score', data: { score: barBassNotes } });
            }
            if (this.instruments.solo !== 'none') {
                 const barSoloNotes = getNotesForBar(promenadeScore.solo as any[]); // Cast to any to handle time format
                 if (barSoloNotes.length > 0) self.postMessage({ type: 'solo_score', data: { score: barSoloNotes } });
            }
            if (this.instruments.accompaniment !== 'none') {
                 const barAccompanimentNotes = getNotesForBar(promenadeScore.accompaniment as any[]); // Cast to any
                 if (barAccompanimentNotes.length > 0) self.postMessage({ type: 'accompaniment_score', data: { score: barAccompanimentNotes } });
            }

        } else { // Generative logic
            if (this.drumSettings.enabled) {
                const drumScore = DrumGenerator.createScore(
                    this.drumSettings.pattern, 
                    this.barCount, -1
                ).map(note => ({ ...note, time: note.time * this.secondsPerBeat }));
                self.postMessage({ type: 'drum_score', data: { score: drumScore } });
            }

            if (this.instruments.bass !== 'none') {
                const bassScore = BassGenerator.createScore(this.barCount, this.beatsPerBar)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat, duration: note.duration as Tone.Unit.Time, velocity: 0.9 }));
                if (bassScore.length > 0) self.postMessage({ type: 'bass_score', data: { score: bassScore } });
            }
            if (this.instruments.solo !== 'none') {
                 const soloScore = SoloGenerator.createScore(this.barCount, this.beatsPerBar)
                     .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                 if (soloScore.length > 0) self.postMessage({ type: 'solo_score', data: { score: soloScore } });
            }
            if (this.instruments.accompaniment !== 'none') {
                const accompanimentScore = AccompanimentGenerator.createScore(this.barCount, this.beatsPerBar)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                if(accompanimentScore.length > 0) self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
            }
            // Generate and send effects score
            const effectsScore = EffectsGenerator.createScore(this.barCount, this.beatsPerBar)
                .map(note => ({ ...note, time: note.time * this.secondsPerBeat }));
            if (effectsScore.length > 0) {
                self.postMessage({ type: 'effects_score', data: { score: effectsScore } });
            }
        }
        
        this.barCount++;
    }
};


// --- MessageBus (The "Kafka" entry point) ---
self.onmessage = async (event: MessageEvent) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                // For now, just confirm initialization
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

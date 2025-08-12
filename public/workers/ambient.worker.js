
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 * Each musical component is an isolated entity responsible for a single task.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication between the main thread and the worker.
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals (beats)
 *     and directs the generators to create musical parts for that moment.
 * 3.  Instrument Generators: The "composers". They create scores (arrays of notes).
 * 4.  PatternProvider: A "music sheet library" holding rhythmic and melodic patterns.
 * 5.  ScoreProvider: Provides pre-composed full scores.
 */
import * as Tone from 'tone';
import { promenadeScore } from '../src/lib/scores/promenade';
import type { DrumNote, BassNote, SoloNote, AccompanimentNote } from '../src/types/music';


// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        basic: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 },
            { sample: 'kick', time: 2 }, { sample: 'hat', time: 2.5 }, { sample: 'snare', time: 3 }, { sample: 'hat', time: 3.5 },
        ],
        breakbeat: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'kick', time: 0.75 }, { sample: 'snare', time: 1 },
            { sample: 'hat', time: 1.5 }, { sample: 'kick', time: 2 }, { sample: 'snare', time: 2.5 }, { sample: 'hat', time: 3 },
            { sample: 'snare', time: 3.25 }, { sample: 'hat', time: 3.5 },
        ],
        slow: [
            { sample: 'kick', time: 0 }, { sample: 'hat', time: 1 }, { sample: 'snare', time: 2 }, { sample: 'hat', time: 3 },
        ],
        heavy: [
            { sample: 'kick', time: 0, velocity: 1.0 }, { sample: 'ride', time: 0.5 }, { sample: 'snare', time: 1, velocity: 1.0 }, { sample: 'ride', time: 1.5 },
            { sample: 'kick', time: 2, velocity: 1.0 }, { sample: 'ride', time: 2.5 }, { sample: 'snare', time: 3, velocity: 1.0 }, { sample: 'ride', time: 3.5 },
        ],
    },
    bassPatterns: {
        roots: (rootNote: string, duration: number) => [{ note: `${rootNote}1`, time: 0, duration: duration, velocity: 0.9 }],
        arpeggio: (rootNote: string) => {
             const triad = new Tone.Frequency(rootNote + '2').toMidi();
             const notes = [triad, triad + 4, triad + 7];
             return [
                { note: Tone.Frequency(notes[0], 'midi').toNote(), time: 0, duration: 0.5, velocity: 0.9 },
                { note: Tone.Frequency(notes[1], 'midi').toNote(), time: 0.5, duration: 0.5, velocity: 0.8 },
                { note: Tone.Frequency(notes[2], 'midi').toNote(), time: 1, duration: 0.5, velocity: 0.85 },
                { note: Tone.Frequency(notes[0], 'midi').toNote(), time: 1.5, duration: 0.5, velocity: 0.75 },
             ];
        }
    },
    soloPatterns: {
        scale: (rootNote: string, barNumber: number) => {
             const scale = Tone.Frequency(rootNote + '3').toMidi();
             // Simple pentatonic scale melody fragments
             const notes = [scale, scale + 2, scale + 4, scale + 7, scale + 9];
             const pattern: SoloNote[] = [];
             const randomNote = () => notes[Math.floor(Math.random() * notes.length)];
             
             pattern.push({ notes: Tone.Frequency(randomNote(), 'midi').toNote(), duration: '8n', time: 0.5 + Math.random() * 0.2 });
             if (barNumber % 2 === 0) {
                 pattern.push({ notes: Tone.Frequency(randomNote(), 'midi').toNote(), duration: '8n', time: 1.5 + Math.random() * 0.2 });
             }
             pattern.push({ notes: Tone.Frequency(randomNote(), 'midi').toNote(), duration: '4n', time: 2.5 + Math.random() * 0.2 });
             
             return pattern;
        }
    },
     accompanimentPatterns: {
        chords: (rootNote: string) => {
            const rootMidi = new Tone.Frequency(rootNote + '2').toMidi();
            const chord = [rootMidi, rootMidi + 4, rootMidi + 7].map(m => Tone.Frequency(m, 'midi').toNote());
            return [{ notes: chord, duration: '2n', time: 0 }];
        },
        arpeggio: (rootNote: string) => {
            const rootMidi = new Tone.Frequency(rootNote + '2').toMidi();
            const chord = [rootMidi, rootMidi + 4, rootMidi + 7].map(m => Tone.Frequency(m, 'midi').toNote());
            return [
                { notes: chord[0], duration: '8n', time: 0},
                { notes: chord[1], duration: '8n', time: 0.5},
                { notes: chord[2], duration: '8n', time: 1},
                { notes: chord[1], duration: '8n', time: 1.5},
                { notes: chord[0], duration: '8n', time: 2},
                { notes: chord[1], duration: '8n', time: 2.5},
                { notes: chord[2], duration: '8n', time: 3},
                { notes: chord[1], duration: '8n', time: 3.5},
            ]
        }
    },

    getDrumPattern(name: string) {
        return this.drumPatterns[name as keyof typeof this.drumPatterns] || this.drumPatterns.basic;
    },
};

// --- 2. Instrument Generators (The Composers) ---
class DrumGenerator {
    static createScore(patternName: string, barNumber: number) {
        const pattern = PatternProvider.getDrumPattern(patternName);
        let score: DrumNote[] = [...pattern].map(n => ({...n}));

        // Add a crash cymbal on the first beat of every 4th bar
        if (barNumber % 4 === 0) {
            score = score.filter(note => note.time !== 0);
            score.push({ sample: 'crash', time: 0, velocity: 0.8 });
        }
        
        return score;
    }
}

class BassGenerator {
     static createScore(rootNote: string, barNumber: number, scoreName: string): BassNote[] {
        if (scoreName === 'promenade') return []; // handled by ScoreProvider
        // Alternate between root notes and simple arpeggio
         if (barNumber % 4 < 2) {
             return PatternProvider.bassPatterns.roots(rootNote, 4);
         } else {
             return PatternProvider.bassPatterns.arpeggio(rootNote);
         }
    }
}

class SoloGenerator {
    static createScore(rootNote: string, barNumber: number, scoreName: string): SoloNote[] {
        if (scoreName === 'promenade') return []; // handled by ScoreProvider
        return PatternProvider.soloPatterns.scale(rootNote, barNumber);
    }
}

class AccompanimentGenerator {
     static createScore(rootNote: string, barNumber: number, scoreName: string): AccompanimentNote[] {
        if (scoreName === 'promenade') return []; // handled by ScoreProvider
        if (barNumber % 2 === 0) {
            return PatternProvider.accompanimentPatterns.chords(rootNote);
        } else {
            return PatternProvider.accompanimentPatterns.arpeggio(rootNote);
        }
    }
}

// --- 3. ScoreProvider ---
const ScoreProvider = {
    getScoreForBar(scoreName: string, barNumber: number, beatsPerBar: number): { drums: DrumNote[], bass: BassNote[], solo: SoloNote[], accompaniment: AccompanimentNote[] } {
        if (scoreName !== 'promenade') {
            return { drums: [], bass: [], solo: [], accompaniment: [] };
        }

        const barStartTime = barNumber * beatsPerBar;
        const barEndTime = (barNumber + 1) * beatsPerBar;

        const filterNotes = <T extends { time: number | Tone.Unit.Time }>(notes: T[]): T[] => {
            return notes
                .filter(note => {
                    // Convert Tone.Time to beats if necessary
                    const timeInBeats = typeof note.time === 'number' ? note.time : Tone.Time(note.time).toSeconds() * (Scheduler.bpm / 60);
                    return timeInBeats >= barStartTime && timeInBeats < barEndTime;
                })
                .map(note => {
                    const timeInBeats = typeof note.time === 'number' ? note.time : Tone.Time(note.time).toSeconds() * (Scheduler.bpm / 60);
                    return { ...note, time: timeInBeats - barStartTime };
                });
        };

        return {
            drums: filterNotes(promenadeScore.drums),
            bass: filterNotes(promenadeScore.bass),
            solo: filterNotes(promenadeScore.solo),
            accompaniment: filterNotes(promenadeScore.accompaniment),
        };
    },
};


// --- 4. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null as any,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    bpm: 120,
    instruments: {} as any,
    drumSettings: {} as any,
    score: 'generative' as 'generative' | 'promenade',
    
    // Musical context
    key: 'E',
    scale: 'minor' as 'major' | 'minor',
    progression: [] as string[],
    currentRoot: 'E',

    // Calculated properties
    get beatsPerBar() { return 4; },

    start() {
        if (this.isRunning) return;

        this.reset();
        this.isRunning = true;
        this.updateMusicalContext();
        
        // Use Tone's Transport for timing
        Tone.Transport.bpm.value = this.bpm;
        Tone.Transport.scheduleRepeat(time => {
            this.tick(time);
        }, `${this.beatsPerBar}n`); // Schedule a tick every bar
        
        Tone.Transport.start();

        self.postMessage({ type: 'started' });
    },

    stop() {
        if (!this.isRunning) return;
        Tone.Transport.stop();
        Tone.Transport.cancel();
        this.isRunning = false;
        self.postMessage({ type: 'stopped' });
    },

    reset() {
        this.barCount = 0;
    },
    
    updateSettings(settings: any) {
        let needsReschedule = false;
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.score) this.score = settings.score;
        if (settings.bpm && this.bpm !== settings.bpm) {
            this.bpm = settings.bpm;
            if (this.isRunning) {
                Tone.Transport.bpm.value = this.bpm;
            }
        }
    },
    
    updateMusicalContext() {
        // Simple progression for E minor
        this.progression = ['E', 'C', 'G', 'D'];
        this.currentRoot = this.progression[this.barCount % this.progression.length];
    },

    tick(time: number) { // time is the exact time from Tone.Transport
        if (!this.isRunning) return;
        
        this.updateMusicalContext();

        if (this.score === 'promenade') {
            const totalBars = Math.ceil(promenadeScore.drums[promenadeScore.drums.length - 1].time / this.beatsPerBar);
            const currentBarInScore = this.barCount % totalBars;
            const scoreForBar = ScoreProvider.getScoreForBar(this.score, currentBarInScore, this.beatsPerBar);

            if(scoreForBar.drums.length > 0 && this.drumSettings.enabled) self.postMessage({ type: 'drum_score', data: { score: scoreForBar.drums }});
            if(scoreForBar.bass.length > 0 && this.instruments.bass !== 'none') self.postMessage({ type: 'bass_score', data: { score: scoreForBar.bass }});
            if(scoreForBar.solo.length > 0 && this.instruments.solo !== 'none') self.postMessage({ type: 'solo_score', data: { score: scoreForBar.solo }});
            if(scoreForBar.accompaniment.length > 0 && this.instruments.accompaniment !== 'none') self.postMessage({ type: 'accompaniment_score', data: { score: scoreForBar.accompaniment }});

        } else {
             // 1. Ask generators for their scores for generative mode
            if (this.drumSettings.enabled) {
                const drumScore = DrumGenerator.createScore(this.drumSettings.pattern, this.barCount);
                self.postMessage({ type: 'drum_score', data: { score: drumScore }});
            }
            
            if (this.instruments.bass !== 'none') {
                const bassScore = BassGenerator.createScore(this.currentRoot, this.barCount, this.score);
                self.postMessage({ type: 'bass_score', data: { score: bassScore }});
            }
            
            if (this.instruments.solo !== 'none') {
                const soloScore = SoloGenerator.createScore(this.currentRoot, this.barCount, this.score);
                self.postMessage({ type: 'solo_score', data: { score: soloScore }});
            }
            
            if (this.instruments.accompaniment !== 'none') {
                const accompanimentScore = AccompanimentGenerator.createScore(this.currentRoot, this.barCount, this.score);
                self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore }});
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
                // Tone.js is now a dependency, init on main thread is enough
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

    
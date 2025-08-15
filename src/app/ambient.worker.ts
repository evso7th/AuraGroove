
/// <reference lib="webworker" />

import { promenadeScore } from '@/lib/scores/promenade';
import type { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote, DrumSettings, EffectsSettings, ScoreName, MixProfile, Instruments, InstrumentSettings } from '@/types/music';

// --- 1. PatternProvider (The Music Sheet Library) ---
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
        // Keep old patterns for now, might be useful
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
        none: [],
    },
    getDrumPattern(name: string) {
        return this.drumPatterns[name as keyof typeof this.drumPatterns] || [];
    },
};

// --- 2. Instrument Generators (The Composers) ---

// --- DreamTales Style Generators ---

const DreamTalesHarmonyProvider = {
    // Progression: Em - C - G - D (vi-IV-I-V in G Major)
    chords: [
        { root: 'E', scale: ['E', 'F#', 'G', 'A', 'B', 'C', 'D'] }, // E minor (Aeolian)
        { root: 'C', scale: ['C', 'D', 'E', 'F', 'G', 'A', 'B'] }, // C major (Ionian)
        { root: 'G', scale: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'] }, // G major (Ionian)
        { root: 'D', scale: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'] }  // D major (Ionian)
    ],
    getChord(barNumber: number) {
        const chordIndex = Math.floor(barNumber / 2) % this.chords.length;
        return this.chords[chordIndex];
    }
};

class DreamTalesDrumGenerator {
    static createScore(barNumber: number, mixProfile: MixProfile): DrumNote[] {
        const isFillBar = (barNumber + 1) % 8 === 0;
        if (isFillBar) {
            return PatternProvider.getDrumPattern('dreamtales-fill');
        }
        const patternName = mixProfile === 'mobile' ? 'dreamtales-beat-mobile' : 'dreamtales-beat-desktop';
        return PatternProvider.getDrumPattern(patternName);
    }
}

class DreamTalesBassGenerator {
    static createScore(barNumber: number): BassNote[] {
        // Generate a new note only every 2 bars, creating a long, foundational drone
        if (barNumber % 2 === 0) {
            const { root } = DreamTalesHarmonyProvider.getChord(barNumber);
            // The note lasts for 2 measures ('2m'), creating a "carpet" of sound
            const note: BassNote = { note: `${root}2`, time: 0, duration: '2m', velocity: 1.0 };
            return [note];
        }
        return []; // Return empty array for odd bars
    }
}


class DreamTalesSoloGenerator {
    private static lastNoteIndex = -1;
    private static notes: string[] = [];

    static createScore(barNumber: number): SoloNote[] {
        const beatsPerBar = 4;
        const currentChord = DreamTalesHarmonyProvider.getChord(barNumber);
        
        // Use a more controlled range of notes for melody. 4th octave is primary.
        const scaleWithOctaves = [
            ...currentChord.scale.map(n => `${n}4`),
            ...currentChord.scale.map(n => `${n}3`)
        ];
        
        if (this.lastNoteIndex === -1 || JSON.stringify(scaleWithOctaves) !== JSON.stringify(this.notes)) {
            this.notes = scaleWithOctaves;
            this.lastNoteIndex = Math.floor(Math.random() * this.notes.length);
        }

        // Generate one note per bar
        const noteTime = 0; // At the start of the bar
        const noteDuration = '1m';
        
        // Stepwise motion: go up or down one step in the scale
        const direction = Math.random() > 0.5 ? 1 : -1;
        let nextNoteIndex = this.lastNoteIndex + direction;

        // Boundary check
        if (nextNoteIndex < 0 || nextNoteIndex >= this.notes.length) {
            nextNoteIndex = this.lastNoteIndex - direction; // Reverse direction
        }
         if (nextNoteIndex < 0 || nextNoteIndex >= this.notes.length) {
            nextNoteIndex = this.lastNoteIndex; // Stay on the same note if still out of bounds
        }

        const noteToPlay = this.notes[nextNoteIndex];
        this.lastNoteIndex = nextNoteIndex;

        return [{ notes: noteToPlay, time: noteTime, duration: noteDuration }];
    }
}

class DreamTalesAccompanimentGenerator {
     private static lastBar = -1;

    static createScore(barNumber: number): AccompanimentNote[] {
        if (barNumber % 2 !== 0) return []; // Play only every 2 bars with the bass

        if (barNumber === this.lastBar) return [];
        this.lastBar = barNumber;
        
        const { root, scale } = DreamTalesHarmonyProvider.getChord(barNumber);
        
        // Create a simple triad from the scale, primarily in the 3rd octave
        const triad = [
            `${root}3`,
            `${scale[2]}3`,
            `${scale[4]}3` 
        ];

        // Humanize the chord playing
        return triad.map((note, index) => ({
            notes: note,
            time: index * 0.1, // Stagger the notes slightly
            duration: '1m'
        }));
    }
}


class EffectsGenerator {
    static createScore(mode: EffectsSettings['mode'], bar: number, beatsPerBar = 4): EffectNote[] {
        if (mode === 'none') return [];
        
        const score: EffectNote[] = [];
        
        let effectType: 'piu' | 'bell' | null = null;
        if (mode === 'mixed') {
            effectType = Math.random() > 0.5 ? 'bell' : 'piu';
        } else {
            effectType = mode;
        }

        if (effectType === 'bell') {
             if (Math.random() > 0.4) return [];

            const windChimeNotes = ['C5', 'Eb5', 'F5', 'G5', 'Bb5']; // C Minor Pentatonic
            const durations = ['4n', '4n', '8n', '8n', '8n'];
            const numberOfChimes = Math.random() > 0.5 ? 5 : 4;
            
            let currentTime = Math.random() * (beatsPerBar / 2); // Start in the first half of the bar
            
            for (let i = 0; i < numberOfChimes; i++) {
                const note = windChimeNotes[Math.floor(Math.random() * windChimeNotes.length)];
                const duration = durations[i];
                
                score.push({
                    type: 'bell',
                    time: currentTime,
                    note,
                    duration,
                    isFirst: i === 0,
                });

                const durationInBeats = duration === '4n' ? 1 : 0.5;
                currentTime += durationInBeats * 2; // Sound duration + pause of same duration
            }
        }
        if (effectType === 'piu') {
             if (Math.random() < 0.25) { 
                score.push({ type: 'piu', time: 2.5, note: 'G5' });
             }
        }

        return score;
    }
}


// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null as any,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    bpm: 75,
    instrumentSettings: {
        solo: { name: 'none', volume: 0.8 },
        accompaniment: { name: 'none', volume: 0.8 },
        bass: { name: 'none', volume: 0.8 },
    } as InstrumentSettings,
    drumSettings: { pattern: 'dreamtales-beat', volume: 0.7 } as any,
    effectsSettings: { mode: 'none', volume: 0.7 } as any,
    score: 'dreamtales' as ScoreName,
    mixProfile: 'desktop' as MixProfile,


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
        if (settings.instrumentSettings) this.instrumentSettings = settings.instrumentSettings;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if (settings.effectsSettings) this.effectsSettings = settings.effectsSettings;
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
        if (settings.mixProfile) this.mixProfile = settings.mixProfile;
    },

    tick() {
        if (!this.isRunning) return;

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
            
            if (this.drumSettings.pattern !== 'none') {
                const barDrumNotes = getNotesForBar(promenadeScore.drums);
                if (barDrumNotes.length > 0) self.postMessage({ type: 'drum_score', data: { score: barDrumNotes } });
            }
            if (this.instrumentSettings.bass.name !== 'none') {
                const barBassNotes = getNotesForBar(promenadeScore.bass);
                if (barBassNotes.length > 0) self.postMessage({ type: 'bass_score', data: { score: barBassNotes } });
            }
            if (this.instrumentSettings.solo.name !== 'none') {
                 const barSoloNotes = getNotesForBar(promenadeScore.solo as any[]); // Cast to any to handle time format
                 if (barSoloNotes.length > 0) self.postMessage({ type: 'solo_score', data: { score: barSoloNotes } });
            }
            if (this.instrumentSettings.accompaniment.name !== 'none') {
                 const barAccompanimentNotes = getNotesForBar(promenadeScore.accompaniment as any[]); // Cast to any
                 if (barAccompanimentNotes.length > 0) self.postMessage({ type: 'accompaniment_score', data: { score: barAccompanimentNotes } });
            }

        } else if (this.score === 'dreamtales') { 
            if (this.drumSettings.pattern !== 'none') {
                const drumScore = DreamTalesDrumGenerator.createScore(this.barCount, this.mixProfile)
                    .map(note => ({ ...note, time: note.time * this.secondsPerBeat }));
                if (drumScore.length > 0) self.postMessage({ type: 'drum_score', data: { score: drumScore } });
            }

            if (this.instrumentSettings.bass.name !== 'none') {
                const bassScore = DreamTalesBassGenerator.createScore(this.barCount)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat, duration: note.duration, velocity: 1.0 }));
                if (bassScore.length > 0) self.postMessage({ type: 'bass_score', data: { score: bassScore } });
            }
            if (this.instrumentSettings.solo.name !== 'none') {
                 const soloScore = DreamTalesSoloGenerator.createScore(this.barCount)
                     .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                 if (soloScore.length > 0) self.postMessage({ type: 'solo_score', data: { score: soloScore } });
            }
            if (this.instrumentSettings.accompaniment.name !== 'none') {
                const accompanimentScore = DreamTalesAccompanimentGenerator.createScore(this.barCount)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                if(accompanimentScore.length > 0) self.postMessage({ type: 'accompaniment_score', data: { score: accompanimentScore } });
            }
            
            const effectsScore = EffectsGenerator.createScore(this.effectsSettings.mode, this.barCount, this.beatsPerBar)
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

    


/// <reference lib="webworker" />

import { promenadeScore } from '@/lib/scores/promenade';
import type { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote, DrumSettings, EffectsSettings, ScoreName } from '@/types/music';

// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    drumPatterns: {
        'dreamtales-beat': [
            { sample: 'ride', time: 0, velocity: 0.7 },
            { sample: 'ride', time: 1, velocity: 0.6 },
            { sample: 'kick', time: 2, velocity: 0.8 },
            { sample: 'ride', time: 2, velocity: 0.7 },
            { sample: 'ride', time: 3, velocity: 0.6 },
            { sample: 'snare', time: 3.5, velocity: 0.5 },
        ],
        'dreamtales-fill': [
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
    getDrumPattern(name: DrumSettings['pattern'] | 'dreamtales-beat' | 'dreamtales-fill') {
        return this.drumPatterns[name as keyof typeof this.drumPatterns] || [];
    },
};

// --- 2. Instrument Generators (The Composers) ---

// --- DreamTales Style Generators ---
class DreamTalesDrumGenerator {
    static createScore(barNumber: number): DrumNote[] {
        const patternName = (barNumber + 1) % 8 === 0 ? 'dreamtales-fill' : 'dreamtales-beat';
        return PatternProvider.getDrumPattern(patternName);
    }
}

class DreamTalesBassGenerator {
    // TODO: Get harmony from a central place
    static createScore(barNumber: number): BassNote[] {
        // Simple drone on 'E1' for now
        return [{ note: 'E1', time: 0, duration: '1n', velocity: 1.0 }];
    }
}

class DreamTalesSoloGenerator {
    static createScore(barNumber: number): SoloNote[] {
        // Placeholder - will generate "elfic" melodies later
        return [];
    }
}

class DreamTalesAccompanimentGenerator {
    static createScore(barNumber: number): AccompanimentNote[] {
        // Placeholder - will generate pads/arpeggios later
        return [];
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
    bpm: 100,
    instruments: { solo: 'none', accompaniment: 'none', bass: 'none' } as any,
    drumSettings: { pattern: 'basic', volume: 0.85 } as any,
    effectsSettings: { mode: 'none', volume: 0.7 } as any,
    score: 'dreamtales' as ScoreName,


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
        if (settings.effectsSettings) this.effectsSettings = settings.effectsSettings;
        if (settings.bpm) this.bpm = settings.bpm;
        if (settings.score) this.score = settings.score;
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

        } else if (this.score === 'dreamtales') { 
            if (this.drumSettings.pattern !== 'none') {
                const drumScore = DreamTalesDrumGenerator.createScore(this.barCount)
                    .map(note => ({ ...note, time: note.time * this.secondsPerBeat }));
                if (drumScore.length > 0) self.postMessage({ type: 'drum_score', data: { score: drumScore } });
            }

            if (this.instruments.bass !== 'none') {
                const bassScore = DreamTalesBassGenerator.createScore(this.barCount)
                    .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat, duration: note.duration, velocity: 1.0 }));
                if (bassScore.length > 0) self.postMessage({ type: 'bass_score', data: { score: bassScore } });
            }
            if (this.instruments.solo !== 'none') {
                 const soloScore = DreamTalesSoloGenerator.createScore(this.barCount)
                     .map(note => ({...note, time: (note.time as number) * this.secondsPerBeat}));
                 if (soloScore.length > 0) self.postMessage({ type: 'solo_score', data: { score: soloScore } });
            }
            if (this.instruments.accompaniment !== 'none') {
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

    
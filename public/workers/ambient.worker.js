
/**
 * @file AuraGroove Ambient Music Worker
 *
 * This worker operates on a microservice-style architecture.
 *
 * Core Entities:
 * 1.  MessageBus (self): Handles all communication with the main thread.
 *
 * 2.  Scheduler: The central "conductor". It wakes up at regular intervals,
 *     reads a "composition" from the PatternProvider, and sends the notes
 *     for the current time slice to the main thread.
 *
 * 3.  PatternProvider: The "music sheet library". It holds entire compositions,
 *     which are detailed, multi-track scores specifying what each instrument
 *     should play at what time. This is the single source of truth for musical data.
 *
 * 4.  (DEPRECATED) Instrument Generators: These are no longer used by the Scheduler for
 *     generating music on the fly. The Scheduler now reads directly from the
 *     PatternProvider's compositions.
 *
 * Data Flow on Start:
 * - Main thread sends 'start' with instrument/drum settings.
 * - Scheduler is started. It now has a loop.
 * - In each loop ('tick'):
 *   - Scheduler gets the current bar number.
 *   - It asks the PatternProvider for the notes corresponding to that bar number
 *     from the active composition.
 *   - It separates the notes by instrument type (drums, bass, solo).
 *   - It posts separate messages ('drum_score', 'bass_score', 'solo_score')
 *     back to the main thread, containing the notes for each instrument to play
 *     in the upcoming time slice.
 *
 * This architecture makes the system highly modular. To create a new song or style,
 * one only needs to add a new composition to the PatternProvider.
 */

// --- 1. PatternProvider (The Music Sheet Library) ---
const PatternProvider = {
    compositions: {
        slowAmbientIntro: {
            durationBars: 6, // Total length of this composition piece
            parts: {
                solo: [
                    // A simple melody that plays throughout
                    { bar: 0, notes: [{ notes: 'C4', time: '0:0', duration: '1m' }] },
                    { bar: 1, notes: [{ notes: 'G3', time: '0:0', duration: '1m' }] },
                    { bar: 2, notes: [{ notes: 'A3', time: '0:0', duration: '1m' }] },
                    { bar: 3, notes: [{ notes: 'E3', time: '0:0', duration: '1m' }] },
                    { bar: 4, notes: [{ notes: 'F3', time: '0:0', duration: '1m' }] },
                    { bar: 5, notes: [{ notes: 'C4', time: '0:0', duration: '1m' }] },
                ],
                bass: [
                    // Bass comes in on the 2nd bar (index 1)
                    { bar: 1, notes: [{ note: 'C2', time: '0:0', duration: '1m', velocity: 0.7 }] },
                    { bar: 2, notes: [{ note: 'A1', time: '0:0', duration: '1m', velocity: 0.7 }] },
                    { bar: 3, notes: [{ note: 'E1', time: '0:0', duration: '1m', velocity: 0.7 }] },
                    { bar: 4, notes: [{ note: 'F1', time: '0:0', duration: '1m', velocity: 0.7 }] },
                    { bar: 5, notes: [{ note: 'C2', time: '0:0', duration: '1m', velocity: 0.7 }] },
                ],
                drums: [
                     // Drums build up gradually
                    { bar: 2, notes: [ { sample: 'hat', time: 0 }, { sample: 'hat', time: 1 } ] }, // Just hi-hats
                    { bar: 3, notes: [ { sample: 'kick', time: 0 }, { sample: 'ride', time: 0.5 }, { sample: 'kick', time: 1 }, { sample: 'ride', time: 1.5 } ] }, // Kick and ride
                    { bar: 4, notes: [ { sample: 'snare', time: 0.5 }, { sample: 'hat', time: 1 }, { sample: 'snare', time: 1.75 } ] }, // A fill
                    { bar: 5, notes: [ { sample: 'kick', time: 0 }, { sample: 'hat', time: 0.5 }, { sample: 'snare', time: 1 }, { sample: 'hat', time: 1.5 } ] } // Full basic pattern
                ]
            }
        }
    },
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
    getDrumPattern(name) {
        return this.drumPatterns[name] || this.drumPatterns.basic;
    },
    getCompositionPart(compositionName, partName, bar) {
        const composition = this.compositions[compositionName];
        if (!composition || !composition.parts[partName]) {
            return [];
        }
        
        // Find all notes for the given bar
        const partData = composition.parts[partName].find(p => p.bar === bar);
        
        if(partData) {
            return partData.notes
        }

        // If we are past the defined composition, start using the generative patterns
        if (bar >= composition.durationBars) {
            if (partName === 'drums') {
                return this.getDrumPattern(Scheduler.drumSettings.pattern);
            }
            if (partName === 'solo') {
                return SoloGenerator.createScore();
            }
             if (partName === 'bass') {
                return BassGenerator.createScore('C');
            }
        }
        
        return [];
    }
};

// --- 2. Instrument Generators (The Composers) ---
// These are now mostly for generating content *after* a composition ends.
class DrumGenerator {
    static createScore(patternName, barNumber) {
        return PatternProvider.getDrumPattern(patternName);
    }
}

class BassGenerator {
     static createScore(rootNote = 'E', beatsPerBar = 2) {
        const score = [
            { note: `${rootNote}1`, time: 0, duration: `${beatsPerBar}n`, velocity: 0.9 }
        ];
        return score;
    }
}

class SoloGenerator {
    static notes = ["C4", "D4", "E4", "G4", "A4", "C5"];
    static currentNoteIndex = 0;
    
    static createScore() {
        // Simple sequential melody within the 3rd and 4th octaves
        const octave = Math.random() < 0.5 ? 3 : 4;
        const notes = ["C", "D", "E", "F", "G", "A", "B"];
        const randomNote = notes[Math.floor(Math.random() * notes.length)];
        
        const note = `${randomNote}${octave}`;
        
        return [{ notes: note, time: '0:0', duration: '2n' }];
    }
}

// --- 3. Scheduler (The Conductor) ---
const Scheduler = {
    intervalId: null,
    isRunning: false,
    barCount: 0,
    
    // Settings from main thread
    bpm: 100,
    instruments: {},
    drumSettings: {},
    activeComposition: 'slowAmbientIntro', // The "song" we are playing

    // Calculated properties
    get beatsPerBar() { return 2; }, // Short bars for faster, more dynamic changes
    get secondsPerBeat() { return 60 / this.bpm; },
    get barDuration() { return this.beatsPerBar * this.secondsPerBeat; },


    start() {
        if (this.isRunning) {
            this.stop();
        }
        this.reset();
        this.isRunning = true;
        this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
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
    
    updateSettings(settings) {
        if (settings.instruments) this.instruments = settings.instruments;
        if (settings.drumSettings) this.drumSettings = settings.drumSettings;
        if(settings.bpm) {
            this.bpm = settings.bpm;
            // If running, restart the interval with the new BPM
            if (this.isRunning) {
                clearInterval(this.intervalId);
                this.intervalId = setInterval(() => this.tick(), this.barDuration * 1000);
            }
        }
    },

    tick() {
        if (!this.isRunning) return;
        
        const soloScore = PatternProvider.getCompositionPart(this.activeComposition, 'solo', this.barCount);
        const bassScore = PatternProvider.getCompositionPart(this.activeComposition, 'bass', this.barCount);
        const drumScore = PatternProvider.getCompositionPart(this.activeComposition, 'drums', this.barCount);

        if (this.instruments.solo !== 'none' && soloScore.length > 0) {
            self.postMessage({ type: 'solo_score', data: { score: soloScore } });
        }
        if (this.instruments.bass !== 'none' && bassScore.length > 0) {
            self.postMessage({ type: 'bass_score', data: { score: bassScore } });
        }
        if (this.drumSettings.enabled && drumScore.length > 0) {
            self.postMessage({ type: 'drum_score', data: { score: drumScore } });
        }

        this.barCount++;
    }
};

let isInitialized = false;

// --- MessageBus (The "Kafka" entry point) ---
self.onmessage = async (event) => {
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'init':
                isInitialized = true;
                self.postMessage({ type: 'initialized' });
                break;
            
            case 'start':
                if (!isInitialized) {
                   self.postMessage({ type: 'error', error: "Worker is not initialized with samples yet."});
                   return;
                }
                Scheduler.updateSettings(data);
                Scheduler.start();
                self.postMessage({ type: 'started' }); // Notify UI that playback has started
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

    
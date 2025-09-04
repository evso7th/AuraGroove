

/**
 * @file AuraGroove Music Worker (Architecture: "The Trance Architect")
 *
 * This worker acts as a minimalist composer, following a detailed 12-minute musical score.
 * Its purpose is to generate a hypnotic, gradually evolving piece of music.
 * It is completely passive and only composes the next bar when commanded via a 'tick'.
 */
import type { WorkerSettings, Score, Note, DrumsScore } from '@/types/music';

const TOTAL_DURATION_SECONDS = 12 * 60; // 12 minutes
const BPM = 60;
const BEATS_PER_BAR = 4;
const BAR_DURATION = (60 / BPM) * BEATS_PER_BAR;
const TOTAL_BARS = TOTAL_DURATION_SECONDS / BAR_DURATION;

// --- Musical Constants ---
const KEY_ROOT_MIDI = 40; // E2
const SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // E Natural Minor

const PADS_BY_STAGE: Record<string, string> = {
    intro: 'MelancholicPad.ogg',
    development: 'BladeWalker.ogg',
    climax: 'Fearsome.ogg',
    density: 'Abstruse.ogg',
    return: 'SalvingPad.ogg'
};

// --- "Sparkle" (In-krap-le-ni-ye) Logic ---
let lastSparkleTime = -Infinity;

function shouldAddSparkle(currentTime: number, density: number): boolean {
    const timeSinceLast = currentTime - lastSparkleTime;
    const minTime = 45; 
    const maxTime = 2 * 60; 

    if (timeSinceLast < minTime) return false;
    if (density > 0.4) return false; // Only when quiet

    // Chance increases over time
    const chance = (timeSinceLast - minTime) / (maxTime - minTime);
    return Math.random() < chance;
}

// --- Main Composition Engine ---
const Composer = {
    getStage(progress: number) {
        if (progress < 2 / 12) return { name: 'intro', complexity: progress * (12 / 2) * 0.1 }; // Gradual complexity in intro
        if (progress < 6 / 12) return { name: 'development', complexity: 0.1 + (progress - 2/12) * (12/4) * 0.5 };
        if (progress < 8 / 12) return { name: 'climax', complexity: 0.9 };
        if (progress < 10 / 12) return { name: 'density', complexity: 1.0 };
        return { name: 'return', complexity: 0.2 };
    },

    generateBass(barIndex: number, stage: { name: string, complexity: number }): Note[] {
        const riffPattern = [28, 28, 28, 31]; // E1, E1, E1, G1
        const beatDuration = BAR_DURATION / 4;
        let notes: Note[] = [];

        // Basic riff
        notes.push({ midi: riffPattern[barIndex % 4], time: (barIndex % 4) * beatDuration, duration: beatDuration, velocity: 0.7 });

        // Evolution
        if (stage.complexity > 0.3) { // Level 2: Add octave
             notes.push({ midi: riffPattern[barIndex % 4] + 12, time: (barIndex % 4) * beatDuration, duration: beatDuration, velocity: 0.5 });
        }
        if (stage.complexity > 0.6) { // Level 3: Arpeggio
            const arpNotes = [28, 31, 35]; // E1, G1, B1
            const step = beatDuration / 3;
            for(let i=0; i<3; i++) {
                notes.push({ midi: arpNotes[i], time: (barIndex % 4) * beatDuration + i * step, duration: step, velocity: 0.6});
            }
        }
       
        return notes;
    },

    generateMelody(barIndex: number, stage: { name: string, complexity: number }): Note[] {
       if (stage.name === 'return') return [];
       if (stage.name === 'intro' && Math.random() > stage.complexity * 2) return []; // Sparse melody in intro

       const notes: Note[] = [];
       const notesInBar = Math.floor(2 + stage.complexity * 14); // From 2 to 16 notes
       const step = BAR_DURATION / notesInBar;
       let lastMidi = 60; // Start at C4

       for (let i = 0; i < notesInBar; i++) {
            const direction = Math.random() < 0.6 ? 1 : -1;
            const scaleIndex = (lastMidi - KEY_ROOT_MIDI + direction + SCALE_INTERVALS.length) % SCALE_INTERVALS.length;
            const nextMidi = KEY_ROOT_MIDI + 24 + SCALE_INTERVALS[scaleIndex]; // Base C4 + scale note

            if (nextMidi < 79) { // G5 limit
                 lastMidi = nextMidi;
            }
            notes.push({ midi: lastMidi, time: i * step, duration: step * (1 + Math.random()), velocity: 0.4 + stage.complexity * 0.3 });
       }
       return notes;
    },
    
    generateAccompaniment(barIndex: number, stage: { name: string, complexity: number }): Note[] {
        const notes: Note[] = [];
        const beatDuration = BAR_DURATION / 4;
        const rootMidi = KEY_ROOT_MIDI + 12; // E3
        
        // Don't play on climax/density for contrast
        if (stage.name === 'climax' || stage.name === 'density') return [];
        
        const playChance = stage.name === 'intro' ? stage.complexity : 1;
        if (Math.random() > playChance) return [];

        if (stage.complexity >= 0.05) { // Start very sparsely
            // "Left hand" arpeggio in 3rd octave
            const arpPattern = [rootMidi, rootMidi + 3, rootMidi + 7]; // E3, G3, B3
            const notesToPlay = stage.name === 'intro' ? 1 : (barIndex % 2 === 0 ? 2 : 3);
             for (let i=0; i<4; i++) {
                if(i < notesToPlay && Math.random() < 0.7) {
                    notes.push({midi: arpPattern[i%3], time: i * beatDuration, duration: beatDuration * 2, velocity: 0.4});
                }
            }
        }
         if (stage.complexity > 0.5) {
            // "Right hand" melody in 4th octave
            const melodyPattern = [rootMidi + 12, rootMidi + 15, rootMidi + 19, rootMidi+15]; // E4, G4, B4
             for (let i=0; i<4; i++) {
                if (Math.random() < stage.complexity - 0.4) {
                    notes.push({midi: melodyPattern[i%4], time: i * beatDuration + beatDuration/2, duration: beatDuration, velocity: 0.5});
                }
            }
        }
        return notes;
    },

    generateDrums(barIndex: number, stage: { name: string, complexity: number }): DrumsScore {
        if (stage.name === 'intro' || stage.name === 'return' || !Scheduler.settings.drumSettings.enabled) return [];
        const drums: DrumsScore = [];
        const step = BAR_DURATION / 16;
        
        if (stage.complexity > 0.2) {
             for (let i = 0; i < 16; i++) {
                 if (i % 8 === 0) drums.push({ note: 'C4', time: i * step, velocity: 0.8 * stage.complexity }); // Kick
                 if (i % 8 === 4) drums.push({ note: 'D4', time: i * step, velocity: 0.6 * stage.complexity }); // Snare
             }
        }
        if (stage.complexity > 0.4) {
            for (let i = 0; i < 16; i++) {
                 if (i % 2 === 1) drums.push({ note: 'E4', time: i * step, velocity: 0.3 * stage.complexity }); // Hihat
            }
        }
        return drums;
    }
}


// --- Scheduler (The Conductor) ---
let lastPadStage: string | null = null;

const Scheduler = {
    loopId: null as any,
    isRunning: false,
    barCount: 0,
    
    settings: {
        bpm: 60,
        score: 'dreamtales', 
        drumSettings: { pattern: 'none', enabled: false },
        instrumentSettings: { 
            bass: { name: "glideBass", volume: 0.5, technique: 'arpeggio' },
            melody: { name: "synth", volume: 0.5 },
            accompaniment: { name: "synth", volume: 0.5 },
        },
        textureSettings: {
            sparkles: { enabled: true },
            pads: { enabled: true }
        },
        density: 0.5,
    } as WorkerSettings,

    get barDuration() { 
        return (60 / this.settings.bpm) * 4; // 4 beats per bar
    },

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.barCount = 0;
        lastSparkleTime = -Infinity;
        lastPadStage = null;
        
        const loop = () => {
            if (!this.isRunning) return;
            this.tick();
            this.loopId = setTimeout(loop, this.barDuration * 1000);
        };
        
        loop();
    },

    stop() {
        this.isRunning = false;
        if (this.loopId) {
            clearTimeout(this.loopId);
            this.loopId = null;
        }
    },
    
    updateSettings(newSettings: Partial<WorkerSettings>) {
       this.settings = { ...this.settings, ...newSettings };
    },

    tick() {
        if (!this.isRunning) return;
        
        const progress = (this.barCount * this.barDuration) / TOTAL_DURATION_SECONDS;
        const stage = Composer.getStage(progress);

        const bass = Composer.generateBass(this.barCount, stage);
        const melody = Composer.generateMelody(this.barCount, stage);
        const accompaniment = Composer.generateAccompaniment(this.barCount, stage);
        const drums = Composer.generateDrums(this.barCount, stage);
        
        const score: Score = { bass, melody, accompaniment, drums };

        console.log('Worker sending score:', score);
        self.postMessage({ type: 'score', score });

        const currentTime = this.barCount * this.barDuration;
        
        if (this.settings.textureSettings.sparkles.enabled) {
            // Anchor Chime
            if (stage.name === 'return' && this.barCount % 8 === 0) {
                 self.postMessage({ type: 'sparkle', time: 0.5 });
                 lastSparkleTime = currentTime;
            } 
            // Random sparkles
            else if (shouldAddSparkle(currentTime, this.settings.density)) {
                 self.postMessage({ type: 'sparkle', time: 0 });
                 lastSparkleTime = currentTime;
            }
        }
        
        if (this.settings.textureSettings.pads.enabled) {
            if (stage.name !== lastPadStage) {
                self.postMessage({ type: 'pad', padName: PADS_BY_STAGE[stage.name], time: 0 });
                lastPadStage = stage.name;
            }
        }

        this.barCount++;
    }
};

// --- MessageBus (The entry point) ---
self.onmessage = async (event: MessageEvent) => {
    if (!event.data || !event.data.command) return;
    const { command, data } = event.data;

    try {
        switch (command) {
            case 'start':
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

    

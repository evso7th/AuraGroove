
/**
 * @file AuraGroove Music Worker (Architecture: "Hybrid Engine Composer")
 *
 * This worker's only responsibility is to compose music for all parts.
 * It generates arrays of notes (scores) for synths (bass, melody)
 * and samplers (drums, effects) and sends them to the main thread for execution.
 * It is completely passive and only works when commanded.
 */
import type { WorkerSettings, Score, Note, DrumsScore, EffectsScore } from '@/types/music';

// --- Scheduler (The Conductor) ---
const Scheduler = {
    loopId: null as any,
    isRunning: false,
    barCount: 0,
    
    settings: {
        bpm: 75,
        score: 'evolve',
        drumSettings: { pattern: 'none', enabled: false },
        instrumentSettings: { 
            bass: { name: "portamento", volume: 0.5 },
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

    createScoreForNextBar(): Score {
        const bass: Note[] = [];
        const melody: Note[] = [];
        const drums: DrumsScore = [];
        const effects: EffectsScore = [];

        const maxVoices = 4;
        const notesInBar = 16; // 16th notes
        const step = this.barDuration / notesInBar;
        const bassNotes = [36, 38, 40, 41, 43, 45, 47, 48]; // C2 Major
        const melodyNotes = [60, 62, 64, 65, 67, 69, 71, 72]; // C4 Major

        let activeSynthNotes = 0;

        for (let i = 0; i < notesInBar; i++) {
             const time = i * step;

            // Simple generative logic
            // Bass on the downbeat
            if (i % 8 === 0) {
                 if (activeSynthNotes < maxVoices) {
                    const midi = bassNotes[Math.floor(this.barCount / 2) % bassNotes.length];
                    bass.push({ midi, time, duration: this.barDuration / 2, velocity: 0.6 });
                    activeSynthNotes++;
                 }
            }

            // Melody with density
            if (Math.random() < this.settings.density / 4) {
                 if (activeSynthNotes < maxVoices) {
                    const midi = melodyNotes[Math.floor(Math.random() * melodyNotes.length)];
                    melody.push({ midi, time, duration: step * (Math.floor(Math.random() * 3) + 2), velocity: 0.5 + Math.random() * 0.3 });
                    activeSynthNotes++;
                }
            }

            // Drums
            if (this.settings.drumSettings.enabled) {
                if (i % 8 === 0) drums.push({ note: 'C4', time, velocity: 1.0 }); // Kick
                if (i % 8 === 4) drums.push({ note: 'D4', time, velocity: 0.7 }); // Snare
                if (i % 2 === 0) drums.push({ note: 'E4', time, velocity: 0.4 }); // Hi-hat
            }

             // Effects
            if (i === 0 && this.barCount % 8 === 0 && Math.random() < 0.5) {
                effects.push({ note: 'A4', time: time + step * 0.5, velocity: 0.3 + Math.random() * 0.3 });
            }
        }
        return { bass, melody, drums, effects };
    },

    tick() {
        if (!this.isRunning) return;
        
        const score = this.createScoreForNextBar();
        
        self.postMessage({
            type: 'score',
            score: score
        });

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

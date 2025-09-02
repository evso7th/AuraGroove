
/**
 * @file AuraGroove Music Worker (Architecture: "Composer")
 *
 * This worker's only responsibility is to compose music.
 * It generates arrays of notes (scores) based on the selected style
 * and sends them to the main thread for execution.
 * It is completely passive and only works when commanded.
 */
import type { WorkerSettings, Score } from '@/types/music';


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
        
        // Start the first tick immediately, then set the interval
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

    createScoreForNextBar(barNumber: number): Score {
        const score: Score = [];
        const startTime = 0;
        const step = 0.5; // Every half beat (8th note)
        const notes = [60, 62, 64, 65, 67, 69, 71, 72]; // C major scale degrees

        for (let i = 0; i < 8; i++) { // Generate 8 notes per bar
            const time = startTime + i * step;
            const midi = notes[i % notes.length];
            score.push({ midi, time, duration: 0.4, velocity: 0.8 });
        }
        return score;
    },

    tick() {
        if (!this.isRunning) return;
        
        const score = this.createScoreForNextBar(this.barCount);
        
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

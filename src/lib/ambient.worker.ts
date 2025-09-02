
/**
 * @file AuraGroove Music Worker (Architecture: "Composer")
 *
 * This worker's only responsibility is to compose music.
 * It generates arrays of notes (scores) based on the selected style
 * and sends them to the main thread for execution.
 * It is completely passive and only works when commanded.
 */
import type { WorkerSettings, Score, Note } from '@/types/music';

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
            // Use a dynamic timeout based on the bar duration
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

    createScoreForNextBar(barNumber: number): Score {
        const score: Score = [];
        const maxVoices = 4;
        const notesInBar = 16; // 16th notes
        const step = this.barDuration / notesInBar;
        const notes = [60, 62, 64, 65, 67, 69, 71, 72]; // C major scale degrees

        let activeNotesAtTime: Record<string, number> = {};
        const activeNotes: {end: number}[] = [];

        for (let i = 0; i < notesInBar; i++) {
             const time = i * step;

             // Remove notes that have finished playing
             activeNotes.forEach((note, index) => {
                if(time >= note.end) {
                    activeNotes.splice(index, 1);
                }
             });

            if (Math.random() < this.settings.density) {
                 if (activeNotes.length < maxVoices) {
                    const midi = notes[Math.floor(Math.random() * notes.length)];
                    const duration = (Math.floor(Math.random() * 4) + 1) * step;
                    
                    const newNote: Note = { midi, time, duration, velocity: 0.7 + Math.random() * 0.3 };
                    score.push(newNote);
                    activeNotes.push({end: time + duration});
                }
            }
        }
        return score;
    },

    tick() {
        if (!this.isRunning) return;
        
        const score = this.createScoreForNextBar(this.barCount);
        
        if(score.length > 0){
            self.postMessage({
                type: 'score',
                score: score
            });
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

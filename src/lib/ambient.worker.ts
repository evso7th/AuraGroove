
/**
 * @file AuraGroove Music Worker (Architecture: "Composer")
 *
 * This worker's only responsibility is to compose music.
 * It generates arrays of notes (scores) based on the selected style
 * and sends them to the main thread for execution.
 * It is completely passive and only works when commanded.
 */

// --- Test Composer ---
class Composer {
    constructor() {}
    
    createScoreForNextBar(barNumber: number, settings: any) {
        // This is a placeholder. In future steps, this will generate real scores.
        const bassScore: any[] = [];
        const drumScore: any[] = [];
        const melodyScore: any[] = [];

        return { bassScore, drumScore, melodyScore };
    }
}


// --- Scheduler (The Conductor) ---
const Scheduler = {
    loopId: null as any,
    isRunning: false,
    barCount: 0,
    composer: new Composer(),
    
    settings: {
        bpm: 75,
        score: 'evolve',
        drumSettings: { pattern: 'none', enabled: false },
        instrumentSettings: { 
            bass: { name: "portamento", volume: 0.5 },
        },
    } as any,

    get barDuration() { 
        return (60 / this.settings.bpm) * 4; // 4 beats per bar
    },

    start() {
        if (this.isRunning) return;
        self.postMessage({ type: 'log', message: '[WORKER] Scheduler starting...' });
        this.isRunning = true;
        this.barCount = 0;
        
        // This is a high-precision, resilient loop using setTimeout.
        const loop = () => {
            if (!this.isRunning) return;
            this.tick();
            this.loopId = setTimeout(loop, this.barDuration * 1000);
        };
        
        this.loopId = setTimeout(loop, 50); // Start after a brief delay
    },

    stop() {
        if (!this.isRunning) return;
        self.postMessage({ type: 'log', message: '[WORKER] Scheduler stopping...' });
        this.isRunning = false;
        if (this.loopId) {
            clearTimeout(this.loopId);
            this.loopId = null;
        }
    },
    
    updateSettings(settings: any) {
       Object.assign(this.settings, settings);
    },

    tick() {
        if (!this.isRunning) return;
        
        const score = this.composer.createScoreForNextBar(this.barCount, this.settings);
        
        self.postMessage({
            type: 'score',
            data: {
                bar: this.barCount,
                score: score
            }
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



/**
 * @file AuraGroove Music Worker (Architecture: "Composer-Conductor")
 *
 * This worker is the "Master of Time" and the "Composer".
 * It is responsible for all musical composition. It uses its own internal,
 * high-precision loop and sends scores (arrays of notes) to the main thread.
 */

// --- 1. Composer (Simplified for Test) ---
class Composer {
    constructor() {}
    
    createScoreForNextBar(barNumber: number, settings: any) {
        // Generate a very simple score with only one bass note
        const bassScore = [{
            note: 'C3',
            duration: '4n',
            time: 0, // Play at the start of the bar
            velocity: 0.5
        }];

        const drumScore = [
            { sample: 'kick' as const, time: 0, velocity: 1.0 },
            { sample: 'hat' as const, time: 0.5, velocity: 0.7 },
            { sample: 'snare' as const, time: 1, velocity: 0.8 },
            { sample: 'hat' as const, time: 1.5, velocity: 0.7 },
        ];
        
        const melodyScore: any[] = [];

        return { bassScore, drumScore, melodyScore };
    }
}


// --- 2. Scheduler (The Conductor) ---

const Scheduler = {
    loopId: null as any,
    isRunning: false,
    barCount: 0,
    composer: new Composer(),
    
    settings: {
        bpm: 75,
        score: 'evolve',
        drumSettings: { pattern: 'none', volume: 0, enabled: false },
        instrumentSettings: { 
            bass: { name: "portamento", volume: 0.5 },
            melody: { name: "none", volume: 0, technique: 'arpeggio' },
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
        
        const loop = () => {
            if (!this.isRunning) return;
            this.tick();
            // Use setTimeout for the loop to be resilient to main thread freezes
            this.loopId = setTimeout(loop, this.barDuration * 1000);
        };
        
        // Start the first tick slightly delayed to ensure everything is set up
        this.loopId = setTimeout(loop, 100);
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
        if (settings.bpm) this.settings.bpm = settings.bpm;
        if (settings.drumSettings) this.settings.drumSettings = {...this.settings.drumSettings, ...settings.drumSettings};
        if (settings.instrumentSettings) this.settings.instrumentSettings = {...this.settings.instrumentSettings, ...settings.instrumentSettings};
        if (settings.score) this.settings.score = settings.score;
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

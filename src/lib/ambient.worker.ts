
/**
 * @file AuraGroove Music Worker (Architecture: "The Dynamic Composer")
 *
 * This worker acts as a real-time composer, generating music bar by bar based on settings from the UI.
 * Its goal is to create a continuously evolving piece of music where complexity is controlled by a 'density' parameter.
 * It is completely passive and only composes the next bar when commanded via a 'tick'.
 */
import type { WorkerSettings, Score, Note, DrumsScore, ScoreName } from '@/types/music';

// --- Musical Constants ---
const KEY_ROOT_MIDI = 40; // E2
const SCALE_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // E Natural Minor

const PADS_BY_STYLE: Record<ScoreName, string | null> = {
    dreamtales: 'livecircle.mp3',
    evolve: 'Tibetan bowls.mp3',
    omega: 'things.mp3',
    journey: 'pure_energy.mp3',
    multeity: 'uneverse.mp3',
};

const SPARKLE_SAMPLES = [
    '/assets/music/droplets/merimbo.ogg',
    '/assets/music/droplets/icepad.ogg',
    '/assets/music/droplets/vibes_a.ogg',
    '/assets/music/droplets/sweepingbells.ogg',
    '/assets/music/droplets/belldom.ogg',
    '/assets/music/droplets/dreams.mp3',
    '/assets/music/droplets/end.mp3',
    '/assets/music/droplets/ocean.mp3',
];

const PERCUSSION_SOUNDS = [
    'C2', 'C#2', 'D2', 'D#2', 'E2', 'F2', 'F#2', 'G2', 
    'G#2', 'A2', 'A#2', 'B2', 'C3', 'C#3', 'D3' 
];

const DRUM_FILL_PATTERNS: DrumsScore[] = [
    // Fill 1: Simple tom roll
    [
        { note: 'A4', time: 0, velocity: 0.7 },
        { note: 'A4', time: 0.25, velocity: 0.75 },
        { note: 'G4', time: 0.5, velocity: 0.8 },
        { note: 'G4', time: 0.75, velocity: 0.85 },
    ],
    // Fill 2: Snare build-up
    [
        { note: 'D4', time: 0, velocity: 0.5 },
        { note: 'D4', time: 0.125, velocity: 0.6 },
        { note: 'D4', time: 0.25, velocity: 0.7 },
        { note: 'D4', time: 0.375, velocity: 0.8 },
        { note: 'D4', time: 0.5, velocity: 0.9 },
        { note: 'D4', time: 0.625, velocity: 1.0 },
        { note: 'D4', time: 0.75, velocity: 1.0 },
        { note: 'G4', time: 0.875, velocity: 0.9 },
    ],
    // Fill 3: Syncopated kick/snare
    [
        { note: 'C4', time: 0, velocity: 0.9 },
        { note: 'C4', time: 0.375, velocity: 0.7 },
        { note: 'D4', time: 0.5, velocity: 0.8 },
        { note: 'A4', time: 0.75, velocity: 0.6 },
        { note: 'G4', time: 0.875, velocity: 0.7 },
    ]
];


// --- "Sparkle" (In-krap-le-ni-ye) Logic ---
let lastSparkleTime = -Infinity;

function shouldAddSparkle(currentTime: number, density: number): boolean {
    const timeSinceLast = currentTime - lastSparkleTime;
    const minTime = 30; // Reduced time for more frequent sparkles
    const maxTime = 90;

    if (timeSinceLast < minTime) return false;
    if (density > 0.6) return false; // Only when less dense

    const chance = ((timeSinceLast - minTime) / (maxTime - minTime)) * (1 - density);
    return Math.random() < chance;
}

// --- Note Generation Helpers ---
const getNoteFromDegree = (degree: number, scale: number[], root: number, octave: number) => {
    const scaleLength = scale.length;
    const noteInScale = scale[((degree % scaleLength) + scaleLength) % scaleLength];
    const octaveOffset = Math.floor(degree / scaleLength);
    return root + (octave + octaveOffset) * 12 + noteInScale;
};

// --- Main Composition Engines ---

const MulteityComposer = {
    generateBass(barIndex: number, density: number): Note[] {
        const notes: Note[] = [];
        const beatDuration = Scheduler.barDuration / 4;
        const step = beatDuration / 4; // 16th notes
        const rootMidi = KEY_ROOT_MIDI;
        const progression = [0, 3, 5, 2];
        const chordRootDegree = progression[Math.floor(barIndex / 2) % progression.length];

        for (let i = 0; i < 16; i++) {
            if (Math.random() < density * 0.8) {
                const octave = (i % 8 < 4) ? 0 : 1; // E2 to E3 range
                const degree = chordRootDegree + (i % 4);
                const midi = getNoteFromDegree(degree, SCALE_INTERVALS, rootMidi, octave);
                notes.push({ midi, time: i * step, duration: step, velocity: 0.6 + Math.random() * 0.2 });
            }
        }
        return notes;
    },
    generateAccompaniment(barIndex: number, density: number): Note[] {
        const notes: Note[] = [];
        const beatDuration = Scheduler.barDuration / 4;
        const step = beatDuration / 4; // 16th notes
        const rootMidi = KEY_ROOT_MIDI;
        const progression = [0, 3, 5, 2];
        const chordRootDegree = progression[Math.floor(barIndex / 2) % progression.length];
        
        const pattern = [0, 2, 4, 2]; // Arpeggio pattern over chord tones
        for (let i = 0; i < 16; i++) {
             if (Math.random() < density * 0.9) {
                const octave = 2; // E4 to E5 range
                const degree = chordRootDegree + pattern[i % pattern.length];
                const midi = getNoteFromDegree(degree, SCALE_INTERVALS, rootMidi, octave);
                 if (midi > 40 && midi < 80) { // Keep notes in a reasonable range
                    notes.push({ midi, time: i * step, duration: step * 1.5, velocity: 0.4 + Math.random() * 0.2 });
                 }
            }
        }
        return notes;
    },
    generateMelody(barIndex: number, density: number): Note[] {
        const notes: Note[] = [];
        if (Math.random() > density * 0.8) return notes;

        const rootMidi = KEY_ROOT_MIDI;
        const numNotes = Math.floor(density * 12) + 4;
        const step = Scheduler.barDuration / numNotes;
        let lastDegree = (barIndex * 3) % SCALE_INTERVALS.length + 14; // Start higher

        for (let i = 0; i < numNotes; i++) {
             const useChromatic = Math.random() < (density * 0.1);
             const interval = useChromatic ? (Math.random() < 0.5 ? 1 : -1) : (Math.floor(Math.random() * 3) - 1) * 2;
             lastDegree += interval;
             
             const octave = Math.random() < 0.3 ? 3 : 2; 
             const midi = getNoteFromDegree(lastDegree, SCALE_INTERVALS, rootMidi, octave);
             if (midi > 52 && midi < 88) { // Keep melody in a reasonable range
                notes.push({ midi, time: i * step, duration: step * (1.5 + Math.random()), velocity: 0.5 + density * 0.3 });
             }
        }
        return notes;
    }
}


const Composer = {
    generateBass(barIndex: number, density: number): Note[] {
        const beatDuration = Scheduler.barDuration / 4;
        let notes: Note[] = [];
        
        const riffPattern = [40, 40, 43, 43]; // E2, E2, G2, G2
        notes.push({ midi: riffPattern[barIndex % 4], time: 0, duration: beatDuration * 2, velocity: 0.7 });

        if (density > 0.4) {
            notes.push({ midi: riffPattern[barIndex % 4] + 12, time: beatDuration * 2, duration: beatDuration, velocity: 0.5 });
        }
        if (density > 0.7) {
            const arpNotes = [40, 43, 47]; // E2, G2, B2
            for(let i=0; i<3; i++) {
                notes.push({ midi: arpNotes[i], time: beatDuration * 3 + i * (beatDuration/3), duration: beatDuration/3, velocity: 0.6});
            }
        }
       
        return notes;
    },

    generateMelody(barIndex: number, density: number): Note[] {
        const notes: Note[] = [];
        if (Math.random() > density) return notes; // Melody plays based on density

        const notesInBar = density > 0.6 ? 8 : 4;
        const step = Scheduler.barDuration / notesInBar;
        let lastMidi = 60 + SCALE_INTERVALS[barIndex % SCALE_INTERVALS.length];

        for (let i = 0; i < notesInBar; i++) {
            if (Math.random() < density * 1.2) { // Chance to play a note
                const direction = Math.random() < 0.5 ? 1 : -1;
                const scaleIndex = (lastMidi - KEY_ROOT_MIDI + direction + SCALE_INTERVALS.length) % SCALE_INTERVALS.length;
                const nextMidi = KEY_ROOT_MIDI + 24 + SCALE_INTERVALS[scaleIndex];
                
                if (nextMidi < 79) {
                    lastMidi = nextMidi;
                }
                notes.push({ midi: lastMidi, time: i * step, duration: step * (1 + Math.random()), velocity: 0.5 * density });
            }
        }
        return notes;
    },
    
    generateAccompaniment(barIndex: number, density: number): Note[] {
        const notes: Note[] = [];
        if (density < 0.2) return notes;

        const beatDuration = Scheduler.barDuration / 4;
        const rootMidi = KEY_ROOT_MIDI + 12; // E3
        const arpPattern = [rootMidi, rootMidi + 3, rootMidi + 7]; // E3, G3, B3

        if (barIndex % 2 === 0 || density > 0.5) { 
            for (let i = 0; i < 3; i++) {
                if (Math.random() < density) {
                    notes.push({ 
                        midi: arpPattern[i], 
                        time: i * (beatDuration / 3),
                        duration: beatDuration * 2.5, 
                        velocity: 0.4 * density 
                    });
                }
            }
        }
        
        return notes;
    },

    generateDrums(barIndex: number, density: number): DrumsScore {
        if (!Scheduler.settings.drumSettings.enabled) return [];
        
        const step = Scheduler.barDuration / 16;
        const drums: DrumsScore = [];
        
        // Basic kick and snare
        if (Scheduler.settings.drumSettings.pattern === 'composer') {
            for (let i = 0; i < 16; i++) {
                if (i % 8 === 0) drums.push({ note: 'C4', time: i * step, velocity: 0.8 }); // Kick
                if (i % 8 === 4) drums.push({ note: 'D4', time: i * step, velocity: 0.6 }); // Snare
            }

            // Add hi-hats based on density
            if (density > 0.3) {
                 for (let i = 0; i < 16; i++) {
                     if (i % 4 === 2 && Math.random() < density) drums.push({ note: 'E4', time: i * step, velocity: 0.4 * density });
                }
            }
             // Add crash cymbal based on density
            if (density > 0.8 && barIndex % 4 === 0) {
                drums.push({ note: 'G4', time: 0, velocity: 0.7 * density });
            }
        }

        // Add percussive one-shots
        if (density > 0.2) {
            for (let i = 0; i < 16; i++) {
                // Add on off-beats
                if (i % 4 !== 0 && Math.random() < (density * 0.15)) {
                    const randomPerc = PERCUSSION_SOUNDS[Math.floor(Math.random() * PERCUSSION_SOUNDS.length)];
                    drums.push({ note: randomPerc, time: i * step, velocity: Math.random() * 0.3 + 0.2 });
                }
            }
        }
        
        return drums;
    }
}


// --- Scheduler (The Conductor) ---
let lastPadStyle: ScoreName | null = null;

const Scheduler = {
    loopId: null as any,
    isRunning: false,
    barCount: 0,
    
    settings: {
        bpm: 75,
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
        lastPadStyle = null; // Reset on start
        
        const loop = () => {
            if (!this.isRunning) return;
            this.tick();
            // Use setTimeout for the loop, allows for dynamic bar duration based on BPM
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
       if (this.isRunning) {
         clearTimeout(this.loopId);
         this.loopId = null;
         this.start();
       }
    },

    tick() {
        if (!this.isRunning) return;
        
        console.time('workerTick');

        const density = this.settings.density;
        let bass, melody, accompaniment, drums;
        
        if (this.settings.score === 'multeity') {
             bass = MulteityComposer.generateBass(this.barCount, density);
             melody = MulteityComposer.generateMelody(this.barCount, density);
             accompaniment = MulteityComposer.generateAccompaniment(this.barCount, density);
        } else {
             bass = Composer.generateBass(this.barCount, density);
             melody = Composer.generateMelody(this.barCount, density);
             accompaniment = Composer.generateAccompaniment(this.barCount, density);
        }

        drums = Composer.generateDrums(this.barCount, density);
        
        const score: Score = { bass, melody, accompaniment, drums };

        self.postMessage({ type: 'score', score, time: this.barDuration });

        const currentTime = this.barCount * this.barDuration;
        
        if (this.settings.textureSettings.sparkles.enabled) {
            if (shouldAddSparkle(currentTime, density)) {
                 self.postMessage({ type: 'sparkle', time: 0 });
                 lastSparkleTime = currentTime;
            }
        }
        
        if (this.settings.textureSettings.pads.enabled) {
            const currentStyle = this.settings.score;
            if (currentStyle !== lastPadStyle) {
                 const padName = PADS_BY_STYLE[currentStyle];
                 if (padName) {
                    const delay = this.barCount === 0 ? 1 : 0;
                    self.postMessage({ type: 'pad', padName: padName, time: delay });
                 }
                lastPadStyle = currentStyle;
            }
        }

        this.barCount++;
        console.timeEnd('workerTick');
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

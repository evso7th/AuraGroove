
'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName, WorkletNote, DrumNote } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";

// --- Note Generation Logic (Moved from Worker) ---

// This function now runs in the main thread.
function noteToFreq(note: string) {
    const A4 = 440;
    const noteMap: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 };
    const octave = parseInt(note.slice(-1));
    const key = note.slice(0, -1);
    const semitone = noteMap[key] + (octave - 4) * 12;
    return A4 * Math.pow(2, semitone / 12);
}

const PRESETS = {
    'synthesizer_accompaniment': { attack: 0.2, decay: 0.3, sustain: 0.8, release: 0.8, oscType: 'fatsine' },
};

class EvolutionEngine {
    private barCount: number = 0;
    private chordProgression: string[][] = [
        ['C4', 'E4', 'G4'], // I: C Major
        ['G4', 'B4', 'D5'], // V: G Major
        ['A4', 'C5', 'E5'], // vi: A Minor
        ['F4', 'A4', 'C5']  // IV: F Major
    ];
    private noteIdCounter: number = 0;

    setBar(bar: number) { this.barCount = bar; }
    private getNextNoteId() { return this.noteIdCounter++; }
    
    getCurrentChord(): string[] {
        const chordIndex = Math.floor(this.barCount / 2) % this.chordProgression.length;
        return this.chordProgression[chordIndex];
    }

    generateAccompanimentScore(volume: number, barDuration: number): WorkletNote[] {
        if (this.barCount % 2 !== 0) return [];
        const preset = PRESETS.synthesizer_accompaniment;
        const currentChord = this.getCurrentChord();
        return currentChord.map(note => ({
            id: this.getNextNoteId(),
            part: 'accompaniment',
            freq: noteToFreq(note),
            attack: preset.attack,
            decay: preset.decay,
            sustain: preset.sustain,
            release: preset.release,
            oscType: preset.oscType as any,
            startTime: 0, 
            duration: barDuration,
            velocity: volume / 3 
        }));
    }

    generateDrumScore(volume: number, secondsPerBeat: number): DrumNote[] {
       const score: DrumNote[] = [];
       if (this.barCount % 1 === 0) {
            score.push({ sample: 'kick', velocity: volume, beat: 0, time: 0 });
            score.push({ sample: 'snare', velocity: volume * 0.8, beat: 2, time: 2 * secondsPerBeat });
       }
       return score;
    }
}

const DrumPatterns: Record<string, Omit<DrumNote, 'time'>[]> = {
    'ambient_beat': [
        { sample: 'kick', velocity: 1.0, beat: 0 },
        { sample: 'hat', velocity: 0.3, beat: 0.5 },
        { sample: 'snare', velocity: 0.8, beat: 1.0 },
        { sample: 'hat', velocity: 0.3, beat: 1.5 },
        { sample: 'kick', velocity: 0.9, beat: 2.0 },
        { sample: 'hat', velocity: 0.3, beat: 2.5 },
        { sample: 'snare', velocity: 0.7, beat: 3.0 },
        { sample: 'hat', velocity: 0.3, beat: 3.5 },
    ]
};

const SCORE_CHUNK_DURATION_IN_BARS = 2; // Generate smaller chunks more frequently

export const useAuraGroove = () => {
  const { isInitialized, isInitializing, engine } = useAudioEngine();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'composer', volume: 0.7 });
  const [effectsSettings, setEffectsSettings] = useState<EffectsSettings>({ mode: 'none', volume: 0.7 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    solo: { name: "none", volume: 0.8 },
    accompaniment: { name: "synthesizer", volume: 0.7 },
    bass: { name: "none", volume: 0.9 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('evolve');

  // --- Refs for scheduling logic ---
  const evolutionEngineRef = useRef(new EvolutionEngine());
  const barCountRef = useRef(0);
  const nextScheduleTimeRef = useRef(0);
  const loopIdRef = useRef<any>(null);

  const scheduleNextChunk = useCallback(() => {
    if (!engine) return;
    const T = engine.getTone();
    if (!T) return;

    const currentBpm = bpm;
    const beatsPerBar = 4;
    const barDuration = (beatsPerBar * 60) / currentBpm;
    const secondsPerBeat = 60 / currentBpm;
    
    const scheduleTime = Math.max(nextScheduleTimeRef.current, T.context.currentTime);

    // Generate scores for the upcoming chunk
    let synthScore: { solo: WorkletNote[], accompaniment: WorkletNote[], bass: WorkletNote[], effects: WorkletNote[] } = { solo: [], accompaniment: [], bass: [], effects: [] };
    let drumScore: DrumNote[] = [];

    for (let i = 0; i < SCORE_CHUNK_DURATION_IN_BARS; i++) {
        const currentBar = barCountRef.current + i;
        const barStartTime = i * barDuration;
        
        evolutionEngineRef.current.setBar(currentBar);

        // Accompaniment
        if (instrumentSettings.accompaniment.name !== 'none') {
            const accompanimentNotes = evolutionEngineRef.current.generateAccompanimentScore(instrumentSettings.accompaniment.volume, barDuration);
            accompanimentNotes.forEach(n => { n.startTime += barStartTime; synthScore.accompaniment.push(n); });
        }
        
        // Drums
        if (drumSettings.pattern === 'composer') {
             const barDrumNotes = evolutionEngineRef.current.generateDrumScore(drumSettings.volume, secondsPerBeat);
             barDrumNotes.forEach(n => { n.time += barStartTime; drumScore.push(n); });
        } else if (drumSettings.pattern !== 'none') {
            const pattern = DrumPatterns[drumSettings.pattern] || [];
            const barDrumNotes = pattern.map(n => ({...n, time: n.beat * secondsPerBeat, velocity: n.velocity * drumSettings.volume}));
            barDrumNotes.forEach(n => { n.time += barStartTime; drumScore.push(n); });
        }
    }
    
    // Schedule the generated scores
    T.Transport.scheduleOnce(() => {
        engine.scheduleSynthScore(synthScore, T.context.currentTime);
        engine.scheduleDrumScore(drumScore, T.context.currentTime);
    }, scheduleTime);

    barCountRef.current += SCORE_CHUNK_DURATION_IN_BARS;
    const chunkDuration = SCORE_CHUNK_DURATION_IN_BARS * barDuration;
    nextScheduleTimeRef.current = scheduleTime + chunkDuration;

  }, [engine, bpm, instrumentSettings, drumSettings]);


  const handleTogglePlay = useCallback(async () => {
    if (!isInitialized || !engine) return;
    const T = engine.getTone();
    if (!T) return;
    
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    
    if (newIsPlaying) {
        if (T.context.state === 'suspended') {
            await T.start();
        }
        engine.setIsPlaying(true);
        barCountRef.current = 0;
        nextScheduleTimeRef.current = T.context.currentTime + 0.1;
        
        // Start the scheduling loop
        scheduleNextChunk(); // Schedule the first chunk immediately
        const loopDuration = SCORE_CHUNK_DURATION_IN_BARS * 4 * 60 / bpm;
        loopIdRef.current = T.Transport.scheduleRepeat(
          () => scheduleNextChunk(),
          `${SCORE_CHUNK_DURATION_IN_BARS}m`, // Schedule every N measures
          nextScheduleTimeRef.current
        );

    } else {
        engine.setIsPlaying(false);
        if (loopIdRef.current) {
            T.Transport.clear(loopIdRef.current);
            loopIdRef.current = null;
        }
        engine.clearAllSchedules();
    }
  }, [isInitialized, engine, isPlaying, scheduleNextChunk, bpm]);

  useEffect(() => {
    if (engine) {
        engine.updateSettings({ bpm });
    }
  }, [bpm, engine]);

  return {
    isInitializing: !isInitialized,
    isPlaying,
    loadingText: isInitializing ? 'Audio Engine is warming up...' : '',
    handleTogglePlay,
    drumSettings,
    setDrumSettings,
    instrumentSettings,
    setInstrumentSettings,
    bpm,
    handleBpmChange: setBpm,
    score,
    handleScoreChange: setScore,
  };
};

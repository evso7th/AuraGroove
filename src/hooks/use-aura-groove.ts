
'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { useToast } from "@/hooks/use-toast";
import { DrumMachine } from "@/lib/drum-machine";
import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName } from '@/types/music';

const SCORE_CHUNK_DURATION_IN_BARS = 8;

export const useAuraGroove = () => {
  // --- Global State ---
  const [isStarted, setIsStarted] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingText, setLoadingText] = useState("Click Start");

  // --- Music Settings State ---
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'none', volume: 0.7 });
  const [effectsSettings, setEffectsSettings] = useState<EffectsSettings>({ mode: 'none', volume: 0.7 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    solo: { name: "none", volume: 0.8 },
    accompaniment: { name: "synthesizer", volume: 0.7 },
    bass: { name: "none", volume: 0.9 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('evolve');
  
  const { toast } = useToast();

  // --- Refs for Worker and Audio components ---
  const musicWorkerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const drumMachineRef = useRef<DrumMachine | null>(null);
  const drumChannelRef = useRef<Tone.Channel | null>(null);
  const nextScheduleTimeRef = useRef<number>(0);
  const scoreRequestLoopIdRef = useRef<number | null>(null);


  const requestNewScoreFromWorker = useCallback(() => {
    console.log("[HOOK_TRACE] Requesting new score from worker.");
    if (musicWorkerRef.current) {
        musicWorkerRef.current.postMessage({ 
            command: 'request_new_score', 
            data: { chunkDurationInBars: SCORE_CHUNK_DURATION_IN_BARS } 
        });
    }
  }, []);

  const handleStop = useCallback(() => {
    console.log("[HOOK_TRACE] handleStop called.");
    if (Tone.Transport.state !== 'started') return;

    Tone.Transport.pause();
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    workletNodeRef.current?.port.postMessage({ type: 'clear' });
    drumMachineRef.current?.stopAll();
    setIsPlaying(false);
    console.log("[HOOK_TRACE] Tone.Transport paused.");
  }, []);

  const handlePlay = useCallback(async () => {
    console.log("[HOOK_TRACE] handlePlay called.");

    // If already playing, just stop.
    if (isPlaying) {
      handleStop();
      return;
    }
    
    // Resume transport if it's just paused
    if (Tone.Transport.state === 'paused') {
        Tone.Transport.start();
        console.log("[HOOK_TRACE] Tone.Transport resumed.");
        musicWorkerRef.current?.postMessage({ command: 'start', data: { drumSettings, instrumentSettings, effectsSettings, bpm, score } });
        setIsPlaying(true);
        return;
    }

    // This is the first play or play after a full stop
    if (Tone.Transport.state !== 'started') {
        const settings = { drumSettings, instrumentSettings, effectsSettings, bpm, score };
        musicWorkerRef.current?.postMessage({ command: 'start', data: settings });
        await Tone.Transport.start();
        setIsPlaying(true);
        console.log("[HOOK_TRACE] Tone.Transport started.");
    }

  }, [isPlaying, handleStop, drumSettings, instrumentSettings, effectsSettings, bpm, score]);


  const handleStart = useCallback(async () => {
    if (isStarted) return;

    setIsInitializing(true);
    
    try {
        setLoadingText("Waking up audio context...");
        await Tone.start();
        const context = Tone.getContext().rawContext;
        audioContextRef.current = context;
        console.log("[HOOK_TRACE] AudioContext started.");

        setLoadingText("Loading Synthesis Engine...");
        await context.audioWorklet.addModule('/workers/synth.worklet.js');
        const workletNode = new AudioWorkletNode(context, 'synth-processor', { outputChannelCount: [2] });
        workletNode.connect(context.destination);
        workletNodeRef.current = workletNode;
        console.log("[HOOK_TRACE] AudioWorkletNode created.");

        setLoadingText("Initializing Drum Machine...");
        const drumChannel = new Tone.Channel(Tone.gainToDb(drumSettings.volume)).toDestination();
        drumChannelRef.current = drumChannel;
        const drums = new DrumMachine(drumChannel);
        await drums.waitForReady();
        drumMachineRef.current = drums;
        console.log("[HOOK_TRACE] DrumMachine initialized.");
        
        setLoadingText("Waking up the Composer...");
        const worker = new Worker(new URL('../app/ambient.worker.ts', import.meta.url));
        musicWorkerRef.current = worker;
        worker.postMessage({ command: 'init' });

        worker.onmessage = (event: MessageEvent) => {
            const { type, synthScore, drumScore, error } = event.data;
            console.log(`[HOOK_TRACE] Received message from worker: ${type}`, event.data);

            if (type === 'score_ready') {
                if (!isPlaying) return;

                Tone.Transport.scheduleOnce((time) => {
                    if (workletNodeRef.current && synthScore) {
                        workletNodeRef.current.port.postMessage({ type: 'schedule', score: synthScore, startTime: time });
                    }
                    if (drumMachineRef.current && drumScore) {
                        drumMachineRef.current.scheduleDrumScore(drumScore, time);
                    }
                }, nextScheduleTimeRef.current);
                
                const currentBpm = Tone.Transport.bpm.value;
                const chunkDuration = (SCORE_CHUNK_DURATION_IN_BARS * 4 * 60) / currentBpm;
                nextScheduleTimeRef.current += chunkDuration;
            } else if (type === 'error') {
                toast({ variant: "destructive", title: "Worker Error", description: error });
                handleStop();
            } else if (type === 'started') {
                 nextScheduleTimeRef.current = Tone.context.currentTime + 0.1;
                 requestNewScoreFromWorker();
            }
        };

        await new Promise(resolve => {
            const checkInit = (event: MessageEvent) => {
                if (event.data.type === 'initialized') {
                    worker.removeEventListener('message', checkInit);
                    resolve(true);
                }
            };
            worker.addEventListener('message', checkInit);
        });

        console.log("[HOOK_TRACE] Worker initialized.");
        setIsStarted(true);
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        toast({ variant: "destructive", title: "Initialization Failed", description: errorMsg });
    } finally {
        setIsInitializing(false);
    }
  }, [isStarted, requestNewScoreFromWorker, handleStop, toast, isPlaying, drumSettings.volume]);


  // Effect for updating worker settings
  useEffect(() => {
    if (musicWorkerRef.current && isStarted) {
        const settings = { instrumentSettings, drumSettings, effectsSettings, bpm, score };
        musicWorkerRef.current.postMessage({ command: 'update_settings', data: settings });
    }
  }, [instrumentSettings, drumSettings, effectsSettings, bpm, score, isStarted]);

  // Effect for updating drum volume
  useEffect(() => {
    if (drumChannelRef.current) {
        drumChannelRef.current.volume.value = Tone.gainToDb(drumSettings.volume);
    }
  }, [drumSettings.volume]);

  // Effect for managing the score request loop
  useEffect(() => {
    if (isStarted) {
        Tone.Transport.bpm.value = bpm;
        if (scoreRequestLoopIdRef.current !== null) {
            Tone.Transport.clear(scoreRequestLoopIdRef.current);
        }
        scoreRequestLoopIdRef.current = Tone.Transport.scheduleRepeat(() => {
            if (isPlaying) {
               requestNewScoreFromWorker();
            }
        }, `${SCORE_CHUNK_DURATION_IN_BARS}m`);
    }
    return () => {
        if (scoreRequestLoopIdRef.current !== null) {
            Tone.Transport.clear(scoreRequestLoopIdRef.current);
        }
    };
  }, [bpm, isStarted, isPlaying, requestNewScoreFromWorker]);

  // Cleanup effect
  useEffect(() => {
    return () => {
        console.log("[HOOK_TRACE] Unmounting. Cleaning up audio resources.");
        handleStop();
        musicWorkerRef.current?.terminate();
        if (scoreRequestLoopIdRef.current !== null) {
            Tone.Transport.clear(scoreRequestLoopIdRef.current);
        }
        workletNodeRef.current?.disconnect();
        drumChannelRef.current?.dispose();
        // Don't stop transport globally here, it might be used by other components
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isStarted,
    isInitializing,
    isPlaying,
    loadingText,
    handleStart,
    handleTogglePlay: handlePlay,
    drumSettings,
    setDrumSettings,
    instrumentSettings,
    setInstrumentSettings,
    bpm,
    setBpm,
    score,
    setScore,
  };
};

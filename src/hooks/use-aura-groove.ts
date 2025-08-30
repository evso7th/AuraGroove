
'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { DrumMachine } from "@/lib/drum-machine";
import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName, ToneJS } from '@/types/music';

const SCORE_CHUNK_DURATION_IN_BARS = 8;

export const useAuraGroove = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingText, setLoadingText] = useState("Initializing...");
  
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

  const toneRef = useRef<ToneJS | null>(null);
  const musicWorkerRef = useRef<Worker | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const drumMachineRef = useRef<DrumMachine | null>(null);
  const nextScheduleTimeRef = useRef<number>(0);
  const scoreRequestLoopIdRef = useRef<any | null>(null);
  const isPlayingRef = useRef(isPlaying); // Use ref to track isPlaying in callbacks

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);


  const requestNewScoreFromWorker = useCallback(() => {
    if (musicWorkerRef.current) {
      musicWorkerRef.current.postMessage({ 
        command: 'request_new_score', 
        data: { chunkDurationInBars: SCORE_CHUNK_DURATION_IN_BARS } 
      });
    }
  }, []);

  const stopAudio = useCallback(() => {
    const Tone = toneRef.current;
    if (!Tone || !Tone.Transport || Tone.Transport.state !== 'started') return;

    Tone.Transport.pause();
    Tone.Transport.cancel();
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    if(workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'clear' });
    }
    drumMachineRef.current?.stopAll();
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initializeAudio = async () => {
        try {
            setLoadingText("Creating Audio Context...");
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            if (context.state === 'suspended') await context.resume();
            
            setLoadingText("Waking up audio context...");
            const Tone = await import('tone');
            toneRef.current = Tone;
            
            Tone.setContext(context);
            await Tone.start();
            console.log("[HOOK_TRACE] AudioContext started.");

            setLoadingText("Loading Synthesis Engine...");
            await context.audioWorklet.addModule('/workers/synth.worklet.js');
            console.log("[HOOK_TRACE] AudioWorklet module added.");

            const workletNode = new AudioWorkletNode(context, 'synth-processor');
            workletNodeRef.current = workletNode;
            workletNode.connect(context.destination);
            console.log("[HOOK_TRACE] Native AudioWorkletNode created and connected.");

            setLoadingText("Initializing Drum Machine...");
            const drumChannel = new Tone.Channel({ volume: Tone.gainToDb(drumSettings.volume), pan: 0 }).connect(Tone.getDestination());
            const drums = new DrumMachine(drumChannel, Tone);
            await drums.waitForReady();
            drumMachineRef.current = drums;
            console.log("[HOOK_TRACE] DrumMachine initialized.");
            
            setLoadingText("Waking up the Composer...");
            const worker = new Worker(new URL('../app/ambient.worker.ts', import.meta.url));
            musicWorkerRef.current = worker;
            worker.postMessage({ command: 'init' });

            worker.onmessage = (event: MessageEvent) => {
                const { type, synthScore, drumScore, error } = event.data;
                const T = toneRef.current;
                if (!T || !T.Transport) return;
        
                if (type === 'score_ready') {
                    T.Transport.scheduleOnce((time) => {
                      const scheduleTime = Math.max(time, T.context.currentTime);
                      if (workletNodeRef.current && synthScore) {
                        workletNodeRef.current.port.postMessage({ type: 'schedule', score: synthScore, startTime: scheduleTime });
                      }
                      if (drumMachineRef.current && drumScore) {
                        drumMachineRef.current.scheduleDrumScore(drumScore, scheduleTime);
                      }
                    }, nextScheduleTimeRef.current);
                    
                    const currentBpm = T.Transport.bpm.value;
                    const chunkDuration = (SCORE_CHUNK_DURATION_IN_BARS * 4 * 60) / currentBpm;
                    nextScheduleTimeRef.current += chunkDuration;
                } else if (type === 'error') {
                    toast({ variant: "destructive", title: "Worker Error", description: error });
                    stopAudio();
                } else if (type === 'started') {
                    nextScheduleTimeRef.current = T.context.currentTime + 0.1;
                    requestNewScoreFromWorker();
                }
            };
            
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error("Worker initialization timed out")), 5000);
                const checkInit = (event: MessageEvent) => {
                    if (event.data.type === 'initialized') {
                        clearTimeout(timeout);
                        resolve();
                    }
                };
                worker.addEventListener('message', checkInit, { once: true });
            });
            console.log("[HOOK_TRACE] Worker initialized.");
            
            if (isMounted) setIsInitializing(false);

        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          toast({ variant: "destructive", title: "Initialization Failed", description: errorMsg });
          console.error("Initialization failed:", e);
           if (isMounted) setIsInitializing(false);
        } finally {
           if (isMounted) setLoadingText("");
        }
    }

    initializeAudio();

    return () => {
      isMounted = false;
      console.log("[HOOK_TRACE] Unmounting. Cleaning up audio resources.");
      stopAudio();
      musicWorkerRef.current?.terminate();
      workletNodeRef.current?.disconnect();
    };
  }, [toast, requestNewScoreFromWorker, stopAudio]);
  
  
  const handleTogglePlay = useCallback(async () => {
    if (isInitializing) return;

    const Tone = toneRef.current;
    if (!Tone || !Tone.Transport) {
      toast({ variant: "destructive", title: "Audio Engine Failed", description: "Audio components not ready. Please refresh the page."});
      return;
    }

    if (isPlaying) {
      stopAudio();
      return;
    }
    
    if (Tone.Transport.state !== 'started') {
      await Tone.start();
      Tone.Transport.start();
    }
    
    const settings = { drumSettings, instrumentSettings, effectsSettings, bpm, score };
    musicWorkerRef.current?.postMessage({ command: 'start', data: settings });
    setIsPlaying(true);
  }, [isInitializing, isPlaying, stopAudio, drumSettings, instrumentSettings, effectsSettings, bpm, score, toast]);

  const handleBpmChange = useCallback((newBpm: number) => {
    setBpm(newBpm);
  }, []);

  const handleScoreChange = useCallback((newScore: ScoreName) => {
    setScore(newScore);
  }, []);
  
  // Update worker with settings when they change
  useEffect(() => {
    if (musicWorkerRef.current && !isInitializing) {
        const settings = { instrumentSettings, drumSettings, effectsSettings, bpm, score };
        musicWorkerRef.current.postMessage({ command: 'update_settings', data: settings });
    }
  }, [instrumentSettings, drumSettings, effectsSettings, bpm, score, isInitializing]);

  // Handle score request loop
  useEffect(() => {
    const Tone = toneRef.current;
    if (!isInitializing && Tone) {
        Tone.Transport.bpm.value = bpm;
        if (scoreRequestLoopIdRef.current !== null) {
            Tone.Transport.clear(scoreRequestLoopIdRef.current);
        }
        scoreRequestLoopIdRef.current = Tone.Transport.scheduleRepeat(() => {
            if (isPlayingRef.current) {
               requestNewScoreFromWorker();
            }
        }, `${SCORE_CHUNK_DURATION_IN_BARS}m`);
    }
    return () => {
        if (scoreRequestLoopIdRef.current !== null && toneRef.current) {
            toneRef.current.Transport.clear(scoreRequestLoopIdRef.current);
        }
    };
  }, [bpm, isInitializing, requestNewScoreFromWorker]);

  return {
    isInitializing,
    isPlaying,
    loadingText,
    handleTogglePlay,
    drumSettings,
    setDrumSettings,
    instrumentSettings,
    setInstrumentSettings,
    bpm,
    handleBpmChange,
    score,
    handleScoreChange,
  };
};

    
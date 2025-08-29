
'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { DrumMachine } from "@/lib/drum-machine";
import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName, ToneJS } from '@/types/music';

const SCORE_CHUNK_DURATION_IN_BARS = 8;

export const useAuraGroove = () => {
  const [isInitializing, setIsInitializing] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingText, setLoadingText] = useState("Loading...");
  
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
  const workletNodeRef = useRef<any | null>(null);
  const drumMachineRef = useRef<DrumMachine | null>(null);
  const drumChannelRef = useRef<any | null>(null);
  const nextScheduleTimeRef = useRef<number>(0);
  const scoreRequestLoopIdRef = useRef<number | null>(null);

  const requestNewScoreFromWorker = useCallback(() => {
    if (musicWorkerRef.current) {
      musicWorkerRef.current.postMessage({ 
        command: 'request_new_score', 
        data: { chunkDurationInBars: SCORE_CHUNK_DURATION_IN_BARS } 
      });
    }
  }, []);

  const handleStop = useCallback(() => {
    const Tone = toneRef.current;
    if (!Tone || !Tone.Transport || Tone.Transport.state !== 'started') return;

    Tone.Transport.pause();
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    if(workletNodeRef.current) {
      workletNodeRef.current.port.postMessage({ type: 'clear' });
    }
    drumMachineRef.current?.stopAll();
    setIsPlaying(false);
  }, []);

  const handleTogglePlay = useCallback(async () => {
    if (isInitializing) return;

    const Tone = toneRef.current;
    if (!Tone || !Tone.Transport) return;

    if (isPlaying) {
      handleStop();
      return;
    }
    
    if (Tone.Transport.state !== 'started') {
      Tone.Transport.start();
    } else if (Tone.Transport.state === 'paused') {
      Tone.Transport.start();
    }
    
    const settings = { drumSettings, instrumentSettings, effectsSettings, bpm, score };
    musicWorkerRef.current?.postMessage({ command: 'start', data: settings });
    setIsPlaying(true);
  }, [isInitializing, isPlaying, handleStop, drumSettings, instrumentSettings, effectsSettings, bpm, score]);

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        setLoadingText("Waking up audio context...");
        const Tone = await import('tone');
        await Tone.start();
        toneRef.current = Tone;
        console.log("[HOOK_TRACE] AudioContext started.");

        const context = Tone.getContext();
        
        setLoadingText("Loading Synthesis Engine...");
        await context.audioWorklet.addModule('/workers/synth.worklet.js');
        console.log("[HOOK_TRACE] AudioWorklet module added.");
        
        const workletNode = new Tone.AudioWorkletNode(context, 'synth-processor', { outputChannelCount: [2] });
        workletNode.toDestination();
        workletNodeRef.current = workletNode;
        console.log("[HOOK_TRACE] AudioWorkletNode created and connected.");

        setLoadingText("Initializing Drum Machine...");
        const drumChannel = new Tone.Channel({ volume: Tone.gainToDb(drumSettings.volume), pan: 0 }).toDestination();
        drumChannelRef.current = drumChannel;
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
            if (!isPlaying) return;

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
            handleStop();
          } else if (type === 'started') {
            nextScheduleTimeRef.current = T.context.currentTime + 0.1;
            requestNewScoreFromWorker();
          }
        };

        await new Promise<void>(resolve => {
          const checkInit = (event: MessageEvent) => {
            if (event.data.type === 'initialized') {
              worker.removeEventListener('message', checkInit);
              resolve();
            }
          };
          worker.addEventListener('message', checkInit);
        });

        console.log("[HOOK_TRACE] Worker initialized.");
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        toast({ variant: "destructive", title: "Initialization Failed", description: errorMsg });
        console.error("Initialization failed:", e);
      } finally {
        setIsInitializing(false);
        setLoadingText("");
      }
    };
    
    initializeAudio();

    return () => {
      console.log("[HOOK_TRACE] Unmounting. Cleaning up audio resources.");
      const Tone = toneRef.current;
      handleStop();
      if (Tone && scoreRequestLoopIdRef.current !== null) {
        Tone.Transport.clear(scoreRequestLoopIdRef.current);
      }
      drumChannelRef.current?.dispose();
      musicWorkerRef.current?.terminate();
      workletNodeRef.current?.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (musicWorkerRef.current && !isInitializing) {
        const settings = { instrumentSettings, drumSettings, effectsSettings, bpm, score };
        musicWorkerRef.current.postMessage({ command: 'update_settings', data: settings });
    }
  }, [instrumentSettings, drumSettings, effectsSettings, bpm, score, isInitializing]);

  useEffect(() => {
    if (drumChannelRef.current && toneRef.current) {
        drumChannelRef.current.volume.value = toneRef.current.gainToDb(drumSettings.volume);
    }
  }, [drumSettings.volume]);

  useEffect(() => {
    const Tone = toneRef.current;
    if (!isInitializing && Tone) {
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
        if (scoreRequestLoopIdRef.current !== null && toneRef.current) {
            toneRef.current.Transport.clear(scoreRequestLoopIdRef.current);
        }
    };
  }, [bpm, isInitializing, isPlaying, requestNewScoreFromWorker]);

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
    setBpm,
    score,
    setScore,
  };
};

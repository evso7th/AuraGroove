
'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { DrumMachine } from "@/lib/drum-machine";
import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName, ToneJS } from '@/types/music';

const SCORE_CHUNK_DURATION_IN_BARS = 8;

interface AudioEngine {
  setIsPlaying: (isPlaying: boolean) => void;
  updateSettings: (settings: any) => void;
}

interface AudioEngineContextType {
  engine: AudioEngine | null;
  isInitialized: boolean;
  isInitializing: boolean;
  initialize: () => Promise<boolean>;
}

const AudioEngineContext = createContext<AudioEngineContextType | null>(null);

export const useAudioEngine = () => {
  const context = useContext(AudioEngineContext);
  if (!context) {
    throw new Error('useAudioEngine must be used within an AudioEngineProvider');
  }
  return context;
};

export const AudioEngineProvider = ({ children }: { children: React.ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const engineRef = useRef<AudioEngine | null>(null);
  const { toast } = useToast();

  const toneRef = useRef<ToneJS | null>(null);
  const musicWorkerRef = useRef<Worker | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const drumMachineRef = useRef<DrumMachine | null>(null);
  const nextScheduleTimeRef = useRef<number>(0);

  const requestNewScoreFromWorker = useCallback(() => {
    if (musicWorkerRef.current) {
      musicWorkerRef.current.postMessage({ 
        command: 'request_new_score', 
        data: { chunkDurationInBars: SCORE_CHUNK_DURATION_IN_BARS } 
      });
    }
  }, []);

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (context.state === 'suspended') await context.resume();

      const Tone = await import('tone');
      toneRef.current = Tone;
      Tone.setContext(context);
      await Tone.start();
      console.log("[CONTEXT_TRACE] AudioContext started.");

      await context.audioWorklet.addModule('/workers/synth.worklet.js');
      const workletNode = new AudioWorkletNode(context, 'synth-processor');
      workletNode.connect(context.destination);
      workletNodeRef.current = workletNode;
      console.log("[CONTEXT_TRACE] Native AudioWorkletNode created.");

      const drumChannel = new Tone.Channel({ volume: Tone.gainToDb(0.7), pan: 0 }).connect(Tone.getDestination());
      const drums = new DrumMachine(drumChannel, Tone);
      await drums.waitForReady();
      drumMachineRef.current = drums;
      console.log("[CONTEXT_TRACE] DrumMachine initialized.");
      
      const worker = new Worker(new URL('../app/ambient.worker.ts', import.meta.url));
      musicWorkerRef.current = worker;
      
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
            if (T.Transport.state === 'started') {
                T.Transport.pause();
                T.Transport.cancel();
            }
        } else if (type === 'started') {
            nextScheduleTimeRef.current = T.context.currentTime + 0.1;
            requestNewScoreFromWorker();
        }
      };
      
      worker.postMessage({ command: 'init' });

      let scoreRequestLoopId: any = null;

      engineRef.current = {
        setIsPlaying: (isPlaying: boolean) => {
          if (!toneRef.current) return;
          if (isPlaying) {
            if (toneRef.current.Transport.state !== 'started') {
              toneRef.current.Transport.start();
            }
            musicWorkerRef.current?.postMessage({ command: 'start' });
            if (scoreRequestLoopId === null) {
              scoreRequestLoopId = toneRef.current.Transport.scheduleRepeat(() => {
                requestNewScoreFromWorker();
              }, `${SCORE_CHUNK_DURATION_IN_BARS}m`);
            }
          } else {
            if (toneRef.current.Transport.state === 'started') {
              toneRef.current.Transport.pause();
            }
            musicWorkerRef.current?.postMessage({ command: 'stop' });
            if(workletNodeRef.current) {
                workletNodeRef.current.port.postMessage({ type: 'clear' });
            }
            drumMachineRef.current?.stopAll();
            if (scoreRequestLoopId !== null) {
              toneRef.current.Transport.clear(scoreRequestLoopId);
              scoreRequestLoopId = null;
            }
          }
        },
        updateSettings: (settings: any) => {
          musicWorkerRef.current?.postMessage({ command: 'update_settings', data: settings });
          if (toneRef.current) {
            toneRef.current.Transport.bpm.value = settings.bpm;
          }
        }
      };

      setIsInitialized(true);
      return true;
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      toast({ variant: "destructive", title: "Initialization Failed", description: errorMsg });
      console.error("Initialization failed:", e);
      return false;
    } finally {
        setIsInitializing(false);
    }
  }, [isInitialized, isInitializing, toast, requestNewScoreFromWorker]);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize }}>
      {children}
    </AudioEngineContext.Provider>
  );
};


'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { AudioPlayer } from '@/lib/audio-player';
import type { ToneJS, AudioChunk, WorkerCommand, WorkerSettings, DrumSampleName } from '@/types/music';

type WorkerMessage = {
  type: 'score';
  data: any; // expand this later
} | {
  type: 'started' | 'stopped' | 'error';
  error?: string;
};

interface AudioEngine {
  setIsPlaying: (isPlaying: boolean) => void;
  updateSettings: (settings: Partial<WorkerSettings>) => void;
  getTone: () => ToneJS | null;
}

interface AudioEngineContextType {
  engine: AudioEngine | null;
  isInitialized: boolean;
  isInitializing: boolean;
  initialize: () => Promise<boolean>;
  loadingText: string;
}

const AudioEngineContext = createContext<AudioEngineContextType | null>(null);

export const useAudioEngine = () => {
  const context = useContext(AudioEngineContext);
  if (!context) {
    throw new Error('useAudioEngine must be used within an AudioEngineProvider');
  }
  return context;
};

const DRUM_SAMPLES_TO_LOAD: Record<DrumSampleName, string> = {
    'kick': '/assets/drums/kick_drum6.wav',
    'snare': '/assets/drums/snare.wav',
    'hat': '/assets/drums/closed_hi_hat_accented.wav',
    'crash': '/assets/drums/crash1.wav',
    'ride': '/assets/drums/cymbal1.wav',
};

export const AudioEngineProvider = ({ children }: { children: React.ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  const engineRef = useRef<AudioEngine | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const toneRef = useRef<ToneJS | null>(null);
  const lastSettingsRef = useRef<Partial<WorkerSettings>>({});

  const { toast } = useToast();

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    setLoadingText('Loading Audio Libraries...');
    try {
      const Tone = await import('tone');
      toneRef.current = Tone;
      await Tone.start();
      console.log('[CONTEXT_TRACE] Tone.js started.');
      

      setLoadingText('Initializing Composer AI...');
      const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      console.log('[CONTEXT_TRACE] Web Worker created.');
      

      // MOCK MANAGERS for now. To be replaced with real ones.
      const drumMachine = { schedule: (score: any) => { if(score.length > 0) console.log("[CONTEXT_TRACE] Scheduling Drums:", score)} };
      const accompanimentManager = { schedule: (score: any) => { if(score.length > 0) console.log("[CONTEXT_TRACE] Scheduling Accompaniment:", score)} };
      const bassManager = { schedule: (score: any) => { if(score.length > 0) console.log("[CONTEXT_TRACE] Scheduling Bass:", score)} };
      const soloManager = { schedule: (score: any) => { if(score.length > 0) console.log("[CONTEXT_TRACE] Scheduling Solo:", score)} };


      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        console.log('[CONTEXT_TRACE] Received message from worker:', event.data);
        const { type, data } = event.data;
        if (type === 'score') {
           // These will be replaced by real manager calls
           drumMachine.schedule(data.drumScore);
           accompanimentManager.schedule(data.accompanimentScore);
           bassManager.schedule(data.bassScore);
           soloManager.schedule(data.soloScore);

        } else if (event.data.type === 'error') {
            console.error('Error from worker:', event.data.error);
            toast({
                variant: 'destructive',
                title: 'Worker Error',
                description: event.data.error,
            });
        }
      };

      engineRef.current = {
        getTone: () => toneRef.current,
        setIsPlaying: (isPlaying: boolean) => {
          console.log('[CONTEXT_TRACE] setIsPlaying called with:', isPlaying);
          if (!workerRef.current || !toneRef.current) return;
          const T = toneRef.current;
          
          if (isPlaying) {
            T.Transport.start();
            workerRef.current.postMessage({ command: 'start', data: lastSettingsRef.current } as WorkerCommand);
          } else {
            T.Transport.stop();
            workerRef.current.postMessage({ command: 'stop' });
          }
        },
        updateSettings: (settings: Partial<WorkerSettings>) => {
           console.log('[CONTEXT_TRACE] Updating worker settings:', settings);
           if (!workerRef.current) return;
           lastSettingsRef.current = {...lastSettingsRef.current, ...settings};
           workerRef.current.postMessage({ command: 'update_settings', data: settings });
           if (toneRef.current && settings.bpm) {
             toneRef.current.Transport.bpm.value = settings.bpm;
           }
        },
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
        setLoadingText('');
    }
  }, [isInitialized, isInitializing, toast]);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

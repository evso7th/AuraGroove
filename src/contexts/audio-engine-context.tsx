
'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { DrumMachine } from "@/lib/drum-machine";
import type { ToneJS, WorkletNote, DrumNote } from '@/types/music';

// --- Type Definitions for Worker Communication ---
type WorkerMessage = {
  type: 'score';
  data: {
    drumScore: DrumNote[];
    barDuration: number;
  };
} | {
  type: 'started' | 'stopped' | 'error';
  error?: string;
};

// The AudioEngine now orchestrates Tone.js and the Web Worker
interface AudioEngine {
  setIsPlaying: (isPlaying: boolean) => void;
  updateSettings: (settings: any) => void;
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

export const AudioEngineProvider = ({ children }: { children: React.ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const engineRef = useRef<AudioEngine | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const { toast } = useToast();

  const toneRef = useRef<ToneJS | null>(null);
  const drumMachineRef = useRef<DrumMachine | null>(null);

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    setLoadingText('Loading Tone.js...');
    try {
      const Tone = await import('tone');
      toneRef.current = Tone;
      
      await Tone.start();
      console.log("[CONTEXT_TRACE] AudioContext started.");

      setLoadingText('Initializing Drum Machine...');
      const drumChannel = new Tone.Channel({ volume: Tone.gainToDb(0.7), pan: 0 }).toDestination();
      const drums = new DrumMachine(drumChannel, Tone);
      await drums.waitForReady();
      drumMachineRef.current = drums;
      console.log("[CONTEXT_TRACE] DrumMachine initialized.");
      
      setLoadingText('Initializing Composer AI...');
      const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      console.log("[CONTEXT_TRACE] Web Worker created.");

      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, data } = event.data;
        if (type === 'score') {
          const now = toneRef.current?.now() ?? 0;
          drumMachineRef.current?.scheduleDrumScore(data.drumScore, now);
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
          if (!workerRef.current) return;
          const command = isPlaying ? 'start' : 'stop';
          console.log("[CONTEXT_TRACE] setIsPlaying command sent to worker:", command);
          // Settings are sent on 'start'
          const settings = isPlaying ? {
              // This is a placeholder for the actual state management
              bpm: 120, 
              drumSettings: { pattern: 'ambient_beat', volume: 0.7, enabled: true },
          } : {};
          workerRef.current.postMessage({ command, data: settings });

          if (isPlaying) {
             if (Tone.Transport.state !== 'started') Tone.Transport.start();
          } else {
             if (Tone.Transport.state === 'started') Tone.Transport.stop();
             drumMachineRef.current?.stopAll();
          }
        },
        updateSettings: (settings: any) => {
           if (!workerRef.current) return;
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

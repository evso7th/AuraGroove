

'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { ToneJS, WorkerCommand, WorkerSettings, DrumNote, SynthNote, AudioProfile } from '@/types/music';

// Import the real managers
import { DrumMachine } from '@/lib/drum-machine';
import { BassSynthManager } from '@/lib/bass-synth-manager';
import { MelodySynthManager } from '@/lib/melody-synth-manager';
import { EffectsSynthManager } from '@/lib/effects-synth-manager';
import { useIsMobile } from '@/hooks/use-mobile';


type Score = {
    drumScore: DrumNote[];
    bassScore: SynthNote[];
    melodyScore: SynthNote[];
    barDuration: number;
};

type WorkerMessage = {
  type: 'score';
  data: Score;
} | {
  type: 'started' | 'stopped' | 'error';
  error?: string;
};

export interface AudioEngine {
  setIsPlaying: (isPlaying: boolean) => void;
  updateSettings: (settings: Partial<WorkerSettings>) => void;
  getTone: () => ToneJS | null;
  drumMachine: DrumMachine;
  bassManager: BassSynthManager;
  melodyManager: MelodySynthManager;
  effectsManager: EffectsSynthManager;
}

interface AudioEngineContextType {
  engine: AudioEngine | null;
  isInitialized: boolean;
  isInitializing: boolean;
  initialize: (audioProfile: AudioProfile) => Promise<boolean>;
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
  const toneRef = useRef<ToneJS | null>(null);
  const managersRef = useRef<{
      drumMachine?: DrumMachine;
      bassManager?: BassSynthManager;
      melodyManager?: MelodySynthManager;
      effectsManager?: EffectsSynthManager;
  }>({});
  const tickLoopRef = useRef<Tone.Loop | null>(null);
  const lastSettingsRef = useRef<Partial<WorkerSettings>>({});
  const nextScoreRef = useRef<Score | null>(null); // Buffer for the next score

  const { toast } = useToast();
  const isMobile = useIsMobile();

  const initialize = useCallback(async (audioProfile: AudioProfile) => {
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    setLoadingText('Loading Audio Libraries...');
    try {
      const Tone = await import('tone');
      toneRef.current = Tone;
      await Tone.start();
      console.log('[MAIN THREAD] Tone.js started.');

      // --- Initialize real managers ---
      const T = toneRef.current;

      managersRef.current = {
          drumMachine: new DrumMachine(T),
          bassManager: new BassSynthManager(T),
          melodyManager: new MelodySynthManager(T),
          effectsManager: new EffectsSynthManager(T),
      };
      console.log('[MAIN THREAD] Synth managers created.');

      setLoadingText('Initializing Composer AI...');
      const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      console.log('[MAIN THREAD] Web Worker created.');
      
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.type === 'score') {
            console.log('[MAIN THREAD] Received score from worker:', message.data);
            // Just store the score in the buffer. The loop will pick it up.
            nextScoreRef.current = message.data;
        } else if (message.type === 'error') {
            console.error('Error from worker:', message.error);
            toast({
                variant: 'destructive',
                title: 'Worker Error',
                description: message.error,
            });
        }
      };

      // --- Create the main transport loop ---
      tickLoopRef.current = new T.Loop((time) => {
        // 1. Play the score that was buffered on the previous tick.
        if (nextScoreRef.current && managersRef.current && toneRef.current) {
            console.log(`[MAIN THREAD] Scheduling score with managers for time: ${time}`);
            const { drumMachine, bassManager, melodyManager } = managersRef.current;
            drumMachine?.schedule(nextScoreRef.current.drumScore, time);
            bassManager?.schedule(nextScoreRef.current.bassScore, time);
            melodyManager?.schedule(nextScoreRef.current.melodyScore, time);
            nextScoreRef.current = null; // Clear the buffer after scheduling
        }

        // 2. Ask the worker to compose the score for the *next* tick.
        if (workerRef.current) {
            console.log('[MAIN THREAD] Sending tick to worker.');
            workerRef.current.postMessage({ command: 'tick' });
        }
      }, '1m'); // The loop triggers every measure.


      engineRef.current = {
        getTone: () => toneRef.current,
        // Expose managers
        drumMachine: managersRef.current.drumMachine!,
        bassManager: managersRef.current.bassManager!,
        melodyManager: managersRef.current.melodyManager!,
        effectsManager: managersRef.current.effectsManager!,
        setIsPlaying: (isPlaying: boolean) => {
          if (!workerRef.current || !toneRef.current || !managersRef.current) return;
          const T = toneRef.current;
          
          if (isPlaying) {
            console.log('[MAIN THREAD] setIsPlaying(true): Attempting to start transport and loop.');
            if (T.Transport.state !== 'started') {
                 // Trigger the first tick immediately to fill the buffer
                 workerRef.current.postMessage({ command: 'tick' });
                 tickLoopRef.current?.start(T.now());
                 T.Transport.start();
                 console.log('[MAIN THREAD] Tone.Transport started.');
            }
          } else {
             console.log('[MAIN THREAD] setIsPlaying(false): Attempting to stop transport and reset.');
             if (T.Transport.state === 'started') {
                tickLoopRef.current?.stop(0);
                T.Transport.stop();
                T.Transport.cancel(0); // Clear all scheduled events

                // Command all managers to stop their sounds
                managersRef.current.bassManager?.stopAll();
                managersRef.current.melodyManager?.stopAll();
                
                // Reset the worker's composition state
                workerRef.current.postMessage({ command: 'reset' });
                nextScoreRef.current = null; // Clear the buffer

                console.log('[MAIN THREAD] Tone.Transport stopped and all sounds/schedules cleared.');
             }
          }
        },
        updateSettings: (settings: Partial<WorkerSettings>) => {
           if (!workerRef.current) return;
           lastSettingsRef.current = {...lastSettingsRef.current, ...settings};
           workerRef.current.postMessage({ command: 'update_settings', data: settings });
           if (toneRef.current && settings.bpm) {
             toneRef.current.Transport.bpm.value = settings.bpm;
           }
        },
      };
      
      // Send initial settings to the worker
       workerRef.current.postMessage({ command: 'init' });

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
  }, [isInitialized, isInitializing, toast, isMobile]);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

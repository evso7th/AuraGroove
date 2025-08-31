

'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { ToneJS, WorkerCommand, WorkerSettings, DrumNote, SynthNote, AudioProfile } from '@/types/music';

// Import the real managers
import { DrumMachine } from '@/lib/drum-machine';
import { SoloSynthManager } from '@/lib/solo-synth-manager';
import { AccompanimentSynthManager } from '@/lib/accompaniment-synth-manager';
import { BassSynthManager } from '@/lib/bass-synth-manager';
import { EffectsSynthManager } from '@/lib/effects-synth-manager';
import { useIsMobile } from '@/hooks/use-mobile';


type Score = {
    drumScore: DrumNote[];
    soloScore: SynthNote[];
    accompanimentScore: SynthNote[];
    bassScore: SynthNote[];
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
  soloManager: SoloSynthManager;
  accompanimentManager: AccompanimentSynthManager;
  bassManager: BassSynthManager;
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
      soloManager?: SoloSynthManager;
      accompanimentManager?: AccompanimentSynthManager;
      bassManager?: BassSynthManager;
      effectsManager?: EffectsSynthManager;
  }>({});
  const tickLoopRef = useRef<Tone.Loop | null>(null);
  const lastSettingsRef = useRef<Partial<WorkerSettings>>({});

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
      console.log('[CONTEXT_TRACE] Tone.js started.');

      // --- Initialize real managers ---
      const T = toneRef.current;
      const deviceType = isMobile ? 'mobile' : 'desktop';

      managersRef.current = {
          drumMachine: new DrumMachine(T),
          soloManager: new SoloSynthManager(T),
          accompanimentManager: new AccompanimentSynthManager(T, 'mobile'),
          bassManager: new BassSynthManager(T),
          effectsManager: new EffectsSynthManager(T),
      };
      console.log('[CONTEXT_TRACE] Synth managers created.');

      setLoadingText('Initializing Composer AI...');
      const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      console.log('[CONTEXT_TRACE] Web Worker created.');
      
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, data } = event.data;
        // console.log('[CONTEXT_TRACE] Received message from worker:', type, data); // Too noisy
        if (type === 'score' && managersRef.current && toneRef.current) {
            const T = toneRef.current;
            const { drumMachine, soloManager, accompanimentManager, bassManager } = managersRef.current;
            const nextBarTime = T.Transport.seconds + data.barDuration;
            
            T.Transport.scheduleOnce((time) => {
                drumMachine?.schedule(data.drumScore, time);
                soloManager?.schedule(data.soloScore, time);
                accompanimentManager?.schedule(data.accompanimentScore, time);
                bassManager?.schedule(data.bassScore, time);
            }, nextBarTime);

        } else if (type === 'error') {
            console.error('Error from worker:', event.data.error);
            toast({
                variant: 'destructive',
                title: 'Worker Error',
                description: event.data.error,
            });
        }
      };

      // --- Create the main transport loop ---
      tickLoopRef.current = new T.Loop((time) => {
        // console.log('[CONTEXT_TRACE] TickLoop: Sending tick to worker...'); // Too noisy
        if (workerRef.current) {
            workerRef.current.postMessage({ command: 'tick' });
        }
      }, '1m');


      engineRef.current = {
        getTone: () => toneRef.current,
        // Expose managers
        drumMachine: managersRef.current.drumMachine!,
        soloManager: managersRef.current.soloManager!,
        accompanimentManager: managersRef.current.accompanimentManager!,
        bassManager: managersRef.current.bassManager!,
        effectsManager: managersRef.current.effectsManager!,
        setIsPlaying: (isPlaying: boolean) => {
          if (!workerRef.current || !toneRef.current || !managersRef.current) return;
          const T = toneRef.current;
          
          if (isPlaying) {
            console.log('[CONTEXT_TRACE] setIsPlaying(true): Attempting to start transport and loop.');
            if (T.Transport.state !== 'started') {
                 tickLoopRef.current?.start(0);
                 T.Transport.start();
                 console.log('[CONTEXT_TRACE] Tone.Transport started.');
            }
          } else {
             console.log('[CONTEXT_TRACE] setIsPlaying(false): Attempting to stop transport and reset.');
             if (T.Transport.state === 'started') {
                tickLoopRef.current?.stop(0);
                T.Transport.stop();
                T.Transport.cancel(0); // Clear all scheduled events

                // Command all managers to stop their sounds
                managersRef.current.bassManager?.stopAll();
                managersRef.current.soloManager?.stopAll();
                managersRef.current.accompanimentManager?.stopAll();
                
                // Reset the worker's composition state
                workerRef.current.postMessage({ command: 'reset' });

                console.log('[CONTEXT_TRACE] Tone.Transport stopped and all sounds/schedules cleared.');
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

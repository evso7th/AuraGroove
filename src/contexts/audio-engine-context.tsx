
'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Tone as ToneJS, WorkerCommand, WorkerSettings, DrumNote, SynthNote, AudioProfile } from '@/types/music';

// Import the real managers
import { DrumMachine } from '@/lib/drum-machine';
import { BassSynthManager } from '@/lib/bass-synth-manager';
import { MelodySynthManager } from '@/lib/melody-synth-manager';
import { EffectsSynthManager } from '@/lib/effects-synth-manager';

// This is the structure of the data received from the worker
type Score = {
    drumScore: DrumNote[];
    bassScore: SynthNote[];
    melodyScore: SynthNote[];
    barDuration: number;
};

// This is the structure of messages from the worker
type WorkerMessage = {
  type: 'score';
  data: Score;
} | {
  type: 'started' | 'stopped' | 'error';
  error?: string;
};

// This is the public interface of our audio engine
export interface AudioEngine {
  setIsPlaying: (isPlaying: boolean) => void;
  updateSettings: (settings: Partial<WorkerSettings>) => void;
  getTone: () => ToneJS | null;
  drumMachine: DrumMachine;
  bassManager: BassSynthManager;
  melodyManager: MelodySynthManager;
  effectsManager: EffectsSynthManager;
}

// React Context for the audio engine
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

// The provider component that encapsulates all audio logic
export const AudioEngineProvider = ({ children }: { children: React.ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  // Refs to hold instances that shouldn't trigger re-renders
  const engineRef = useRef<AudioEngine | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const toneRef = useRef<typeof import('tone') | null>(null);
  const managersRef = useRef<{
      drumMachine?: DrumMachine;
      bassManager?: BassSynthManager;
      melodyManager?: MelodySynthManager;
      effectsManager?: EffectsSynthManager;
  }>({});
  const tickLoopRef = useRef<Tone.Loop | null>(null);
  const nextScoreRef = useRef<Score | null>(null); // Key part of the new architecture: the lookahead buffer

  const { toast } = useToast();

  const initialize = useCallback(async (audioProfile: AudioProfile) => {
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    setLoadingText('Loading Audio Libraries...');
    try {
      // Dynamically import Tone.js
      const Tone = await import('tone');
      toneRef.current = Tone;
      await Tone.start();
      console.log('[MAIN THREAD] Tone.js started.');

      // --- Initialize Synth and Drum Managers ---
      managersRef.current = {
          drumMachine: new DrumMachine(Tone),
          bassManager: new BassSynthManager(Tone),
          melodyManager: new MelodySynthManager(Tone),
          effectsManager: new EffectsSynthManager(Tone),
      };
      console.log('[MAIN THREAD] Synth managers created.');

      // --- Initialize Web Worker (The Composer) ---
      setLoadingText('Initializing Composer AI...');
      const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      console.log('[MAIN THREAD] Web Worker created.');
      
      // --- Set up the message handler from the worker ---
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.type === 'score') {
            console.log(`[MAIN THREAD] Received score from worker for next measure.`);
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

      // --- Create the main transport loop (The Conductor's Heartbeat) ---
      tickLoopRef.current = new Tone.Loop((time) => {
        if (nextScoreRef.current && managersRef.current && toneRef.current) {
            console.log(`[MAIN THREAD] Loop Tick: Scheduling score for time: ${time}`);
            const { drumMachine, bassManager, melodyManager } = managersRef.current;
            
            console.log('[MAIN THREAD] PRE-SCHEDULE CHECK FOR DRUMS...');
            drumMachine?.schedule(nextScoreRef.current.drumScore, time);
            
            console.log('[MAIN THREAD] PRE-SCHEDULE CHECK FOR BASS...');
            bassManager?.schedule(nextScoreRef.current.bassScore, time);

            console.log('[MAIN THREAD] PRE-SCHEDULE CHECK FOR MELODY...');
            melodyManager?.schedule(nextScoreRef.current.melodyScore, time);
            
            nextScoreRef.current = null; 
        }

        if (workerRef.current) {
            console.log('[MAIN THREAD] Loop Tick: Sending tick to worker to compose for the NEXT measure.');
            workerRef.current.postMessage({ command: 'tick' });
        }
      }, '1m'); // The loop triggers every measure.


      // --- Define the public engine interface ---
      engineRef.current = {
        getTone: () => toneRef.current,
        drumMachine: managersRef.current.drumMachine!,
        bassManager: managersRef.current.bassManager!,
        melodyManager: managersRef.current.melodyManager!,
        effectsManager: managersRef.current.effectsManager!,
        
        setIsPlaying: (isPlaying: boolean) => {
          if (!workerRef.current || !toneRef.current || !tickLoopRef.current) return;
          const T = toneRef.current;
          
          if (isPlaying) {
            console.log('[MAIN THREAD] setIsPlaying(true): Starting transport and loop.');
            if (T.Transport.state !== 'started') {
                 console.log('[MAIN THREAD] Sending pre-emptive tick to worker to fill buffer.');
                 workerRef.current.postMessage({ command: 'tick' });
                 
                 tickLoopRef.current.start(0);
                 T.Transport.start();
                 console.log('[MAIN THREAD] Tone.Transport started.');
            }
          } else {
             console.log('[MAIN THREAD] setIsPlaying(false): Stopping transport and resetting.');
             if (T.Transport.state === 'started') {
                tickLoopRef.current.stop(0);
                T.Transport.stop();
                T.Transport.cancel(0);

                managersRef.current.bassManager?.stopAll();
                managersRef.current.melodyManager?.stopAll();
                
                workerRef.current.postMessage({ command: 'reset' });
                nextScoreRef.current = null; 

                console.log('[MAIN THREAD] Tone.Transport stopped and all sounds/schedules cleared.');
             }
          }
        },
        
        updateSettings: (settings: Partial<WorkerSettings>) => {
           if (!workerRef.current) return;
           workerRef.current.postMessage({ command: 'update_settings', data: settings });
           if (toneRef.current && settings.bpm) {
             toneRef.current.Transport.bpm.value = settings.bpm;
           }
        },
      };
      
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
  }, [isInitialized, isInitializing, toast]);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

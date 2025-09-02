
'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Tone as ToneJS, WorkerCommand, WorkerSettings, DrumNote, SynthNote, AudioProfile, EffectsSettings } from '@/types/music';

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
  toggleEffects: (enabled: boolean) => void;
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
  const toneRef = useRef<{ rhythm: ToneJS, melody: ToneJS } | null>(null);

  const rhythmContextRef = useRef<{
    Tone: ToneJS | null,
    transport: Tone.Transport | null,
    fx: { reverb?: Tone.Reverb, delay?: Tone.FeedbackDelay },
    channels: Record<string, Tone.Channel>,
    managers: { drumMachine?: DrumMachine, bassManager?: BassSynthManager },
    tickLoop?: Tone.Loop,
    nextScore?: Score | null
  }>({ Tone: null, transport: null, fx: {}, channels: {}, managers: {} });

  const melodyContextRef = useRef<{
    Tone: ToneJS | null,
    transport: Tone.Transport | null,
    fx: { reverb?: Tone.Reverb, delay?: Tone.FeedbackDelay },
    channels: Record<string, Tone.Channel>,
    managers: { melodyManager?: MelodySynthManager, effectsManager?: EffectsSynthManager },
    tickLoop?: Tone.Loop,
    nextScore?: Score | null
  }>({ Tone: null, transport: null, fx: {}, channels: {}, managers: {} });


  const { toast } = useToast();

  const initialize = useCallback(async (audioProfile: AudioProfile) => {
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    setLoadingText('Loading Audio Libraries...');
    try {
      const Tone = await import('tone');
      await Tone.start();
      console.log('[MAIN THREAD] Tone.js contexts starting.');
      
      // --- Initialize Rhythm Context ---
      setLoadingText('Initializing Rhythm Engine...');
      const rhythmTone = Tone; // Using the same library, but could be different instances
      rhythmContextRef.current.Tone = rhythmTone;
      rhythmContextRef.current.transport = rhythmTone.Transport;
      rhythmContextRef.current.fx = {
        reverb: new rhythmTone.Reverb({ decay: 2, wet: 0 }).toDestination(),
        delay: new rhythmTone.FeedbackDelay({ delayTime: "8n", feedback: 0.2, wet: 0 }).toDestination()
      };
      rhythmContextRef.current.channels = {
        drums: new rhythmTone.Channel().toDestination(),
        bass: new rhythmTone.Channel().toDestination(),
      };
      Object.values(rhythmContextRef.current.channels).forEach(ch => {
        ch.connect(rhythmContextRef.current.fx.reverb!);
        ch.connect(rhythmContextRef.current.fx.delay!);
      });
      rhythmContextRef.current.managers.drumMachine = new DrumMachine(rhythmTone, rhythmContextRef.current.channels.drums);
      rhythmContextRef.current.managers.bassManager = new BassSynthManager(rhythmTone, rhythmContextRef.current.channels.bass);
      console.log('[RHYTHM CONTEXT] Initialized.');

      // --- Initialize Melody Context ---
      setLoadingText('Initializing Melody Engine...');
      const melodyTone = Tone; // Using the same library
      melodyContextRef.current.Tone = melodyTone;
      melodyContextRef.current.transport = melodyTone.Transport; // Both use the same transport for sync
      melodyContextRef.current.fx = {
        reverb: new melodyTone.Reverb({ decay: 6, wet: 0 }).toDestination(),
        delay: new melodyTone.FeedbackDelay({ delayTime: "4n", feedback: 0.4, wet: 0 }).toDestination()
      };
      melodyContextRef.current.channels = {
        melody: new melodyTone.Channel().toDestination(),
        effects: new melodyTone.Channel().toDestination()
      };
       Object.values(melodyContextRef.current.channels).forEach(ch => {
        ch.connect(melodyContextRef.current.fx.reverb!);
        ch.connect(melodyContextRef.current.fx.delay!);
      });
      melodyContextRef.current.managers.melodyManager = new MelodySynthManager(melodyTone, melodyContextRef.current.channels.melody);
      melodyContextRef.current.managers.effectsManager = new EffectsSynthManager(melodyTone);
       console.log('[MELODY CONTEXT] Initialized.');


      // --- Initialize Web Worker (The Composer) ---
      setLoadingText('Initializing Composer AI...');
      const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      
      // --- Set up the message handler from the worker ---
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.type === 'score') {
            rhythmContextRef.current.nextScore = message.data;
            melodyContextRef.current.nextScore = message.data;
        } else if (message.type === 'error') {
            console.error('Error from worker:', message.error);
            toast({ variant: 'destructive', title: 'Worker Error', description: message.error });
        }
      };

      // --- Create the main transport loop (The Conductor's Heartbeat) ---
      const loop = new Tone.Loop((time) => {
        const { managers: rhythmManagers, nextScore: rhythmScore } = rhythmContextRef.current;
        if (rhythmScore && rhythmManagers.drumMachine && rhythmManagers.bassManager) {
            rhythmManagers.drumMachine.schedule(rhythmScore.drumScore, time);
            rhythmManagers.bassManager.schedule(rhythmScore.bassScore, time);
            rhythmContextRef.current.nextScore = null; 
        }

        const { managers: melodyManagers, nextScore: melodyScore } = melodyContextRef.current;
        if (melodyScore && melodyManagers.melodyManager && melodyManagers.effectsManager) {
            melodyManagers.melodyManager.schedule(melodyScore.melodyScore, time);
            melodyContextRef.current.nextScore = null;
        }

        if (workerRef.current) {
            workerRef.current.postMessage({ command: 'tick' });
        }
      }, '1m');
      
      rhythmContextRef.current.tickLoop = loop;


      // --- Define the public engine interface ---
      engineRef.current = {
        drumMachine: rhythmContextRef.current.managers.drumMachine!,
        bassManager: rhythmContextRef.current.managers.bassManager!,
        melodyManager: melodyContextRef.current.managers.melodyManager!,
        effectsManager: melodyContextRef.current.managers.effectsManager!,
        
        setIsPlaying: (isPlaying: boolean) => {
            const T = Tone.Transport;
            const loop = rhythmContextRef.current.tickLoop;
            if (!workerRef.current || !T || !loop) return;

            if (isPlaying) {
                if (T.state !== 'started') {
                    workerRef.current.postMessage({ command: 'tick' });
                    loop.start(0);
                    T.start();
                }
            } else {
                if (T.state === 'started') {
                    loop.stop(0);
                    T.stop();
                    T.cancel(0);
                    
                    rhythmContextRef.current.managers.bassManager?.stopAll();
                    melodyContextRef.current.managers.melodyManager?.stopAll();

                    workerRef.current.postMessage({ command: 'reset' });
                    rhythmContextRef.current.nextScore = null;
                    melodyContextRef.current.nextScore = null;
                }
            }
        },
        
        updateSettings: (settings: Partial<WorkerSettings>) => {
           if (!workerRef.current) return;
           workerRef.current.postMessage({ command: 'update_settings', data: settings });
           if (Tone.Transport && settings.bpm) {
             Tone.Transport.bpm.value = settings.bpm;
           }
        },

        toggleEffects: (enabled: boolean) => {
            if (rhythmContextRef.current.fx.reverb) rhythmContextRef.current.fx.reverb.wet.value = enabled ? 0.15 : 0;
            if (rhythmContextRef.current.fx.delay) rhythmContextRef.current.fx.delay.wet.value = enabled ? 0.1 : 0;
            if (melodyContextRef.current.fx.reverb) melodyContextRef.current.fx.reverb.wet.value = enabled ? 0.35 : 0;
            if (melodyContextRef.current.fx.delay) melodyContextRef.current.fx.delay.wet.value = enabled ? 0.25 : 0;
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

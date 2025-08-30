
'use client';

import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { DrumMachine } from "@/lib/drum-machine";
import type { ToneJS, WorkletNote, DrumNote } from '@/types/music';

// The AudioEngine now directly communicates with the AudioWorklet and DrumMachine.
interface AudioEngine {
  setIsPlaying: (isPlaying: boolean) => void;
  updateSettings: (settings: any) => void;
  scheduleSynthScore: (score: { solo: WorkletNote[], accompaniment: WorkletNote[], bass: WorkletNote[], effects: WorkletNote[] }, startTime: number) => void;
  scheduleDrumScore: (score: DrumNote[], startTime: number) => void;
  clearAllSchedules: () => void;
  getTone: () => ToneJS | null;
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
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const drumMachineRef = useRef<DrumMachine | null>(null);

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    try {
      // Dynamically import Tone.js only on the client side
      const Tone = await import('tone');
      toneRef.current = Tone;
      
      await Tone.start();
      console.log("[CONTEXT_TRACE] AudioContext started.");

      const context = Tone.getContext();
      
      // Load the AudioWorklet processor
      // The path is relative to the `public` directory. Webpack plugin handles the rest.
      await context.audioWorklet.addModule('/workers/synth.worklet.js');
      const workletNode = new AudioWorkletNode(context, 'synth-processor');
      workletNode.connect(context.destination);
      workletNodeRef.current = workletNode;
      console.log("[CONTEXT_TRACE] Native AudioWorkletNode created and connected.");

      // Initialize Drum Machine
      const drumChannel = new Tone.Channel({ volume: Tone.gainToDb(0.7), pan: 0 }).connect(Tone.getDestination());
      const drums = new DrumMachine(drumChannel, Tone);
      await drums.waitForReady();
      drumMachineRef.current = drums;
      console.log("[CONTEXT_TRACE] DrumMachine initialized.");
      
      // Create the engine object with methods to control the audio
      engineRef.current = {
        getTone: () => toneRef.current,
        setIsPlaying: (isPlaying: boolean) => {
          if (!toneRef.current) return;
          const T = toneRef.current;
          if (isPlaying) {
            if (T.Transport.state !== 'started') {
              T.Transport.start();
            }
          } else {
            if (T.Transport.state === 'started') {
              T.Transport.stop(); // Use stop() to reset the timeline
              workletNodeRef.current?.port.postMessage({ type: 'clear' });
              drumMachineRef.current?.stopAll();
            }
          }
        },
        updateSettings: (settings: any) => {
           if (toneRef.current && settings.bpm) {
            toneRef.current.Transport.bpm.value = settings.bpm;
          }
          // Here you could post messages to the worklet to update synth params if needed
        },
        scheduleSynthScore: (score, startTime) => {
           workletNodeRef.current?.port.postMessage({ type: 'schedule', score, startTime });
        },
        scheduleDrumScore: (score, startTime) => {
            drumMachineRef.current?.scheduleDrumScore(score, startTime);
        },
        clearAllSchedules: () => {
            workletNodeRef.current?.port.postMessage({ type: 'clear' });
            drumMachineRef.current?.stopAll();
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
  }, [isInitialized, isInitializing, toast]);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

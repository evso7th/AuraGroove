
'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerCommand, WorkerSettings, DrumNote, SynthNote, ScoreName } from '@/types/music';

// This is the structure of messages from the composer worker
type ComposerWorkerMessage = {
  type: 'score';
  data: {
    drumScore: DrumNote[];
    bassScore: SynthNote[];
    melodyScore: SynthNote[]; // We'll ignore this for now
    barDuration: number;
  };
} | {
  type: 'started' | 'stopped' | 'error';
  error?: string;
};

// This is the structure for commands to the rhythm frame
type RhythmFrameCommand = {
    command: 'init' | 'start' | 'stop' | 'schedule';
    payload?: any;
    time?: number; // Absolute time
}


// This is the public interface of our audio engine
export interface AudioEngine {
  setIsPlaying: (isPlaying: boolean) => void;
  updateSettings: (settings: Partial<WorkerSettings>) => void;
}

// React Context for the audio engine
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

// The provider component that encapsulates all audio logic
export const AudioEngineProvider = ({ children }: { children: React.ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  const engineRef = useRef<AudioEngine | null>(null);
  const composerWorkerRef = useRef<Worker | null>(null);
  const rhythmFrameRef = useRef<HTMLIFrameElement | null>(null);
  const scheduleIntervalRef = useRef<any>(null);


  const nextBarTime = useRef<number>(0);
  const lookahead = 0.1; // seconds
  const scheduleAheadTime = 0.2; // seconds

  const { toast } = useToast();
  
  const postToRhythmFrame = (message: RhythmFrameCommand) => {
    rhythmFrameRef.current?.contentWindow?.postMessage(message, '*');
  }
  
  const postToComposerWorker = (message: WorkerCommand) => {
    composerWorkerRef.current?.postMessage(message);
  }

  // The main scheduling loop, run by a simple setInterval in the main thread
  const scheduleLoop = useCallback(() => {
    while (nextBarTime.current < performance.now() + scheduleAheadTime * 1000) {
        postToComposerWorker({ command: 'tick' });
    }
  }, []);

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    setLoadingText('Initializing Composer AI...');
    
    return new Promise<boolean>((resolve) => {
        try {
            // --- Initialize Web Worker (The Composer) ---
            const composerWorker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
            composerWorkerRef.current = composerWorker;
            
            // --- Set up the message handler from the composer worker ---
            composerWorker.onmessage = (event: MessageEvent<ComposerWorkerMessage>) => {
                const message = event.data;
                if (message.type === 'score') {
                    // Send the relevant parts of the score to the rhythm frame
                    postToRhythmFrame({
                        command: 'schedule',
                        payload: {
                            drumScore: message.data.drumScore,
                            bassScore: message.data.bassScore
                        },
                        time: nextBarTime.current / 1000 // convert ms to seconds
                    });
                     nextBarTime.current += message.data.barDuration * 1000;
                } else if (message.type === 'error') {
                    console.error('Error from composer worker:', message.error);
                    toast({ variant: 'destructive', title: 'Composer Error', description: message.error });
                }
            };
            
            setLoadingText('Loading Rhythm Engine...');
            const rhythmFrame = document.getElementById('rhythm-frame') as HTMLIFrameElement;
            rhythmFrameRef.current = rhythmFrame;


            // Wait for the iframe to be ready
            const frameLoadHandler = () => {
                postToRhythmFrame({ command: 'init' });
                
                engineRef.current = {
                    setIsPlaying: (isPlaying: boolean) => {
                        if(isPlaying) {
                            nextBarTime.current = performance.now() + lookahead * 1000;
                            postToRhythmFrame({ command: 'start' });
                            postToComposerWorker({command: 'reset'});
                            if (scheduleIntervalRef.current) clearInterval(scheduleIntervalRef.current);
                            scheduleIntervalRef.current = setInterval(scheduleLoop, 25);
                        } else {
                            if (scheduleIntervalRef.current) clearInterval(scheduleIntervalRef.current);
                            scheduleIntervalRef.current = null;
                            postToRhythmFrame({ command: 'stop' });
                        }
                    },
                    updateSettings: (settings: Partial<WorkerSettings>) => {
                        postToComposerWorker({ command: 'update_settings', data: settings });
                        // Also forward relevant settings to the frame
                        postToRhythmFrame({
                            command: 'payload', // A generic command to update settings
                            payload: {
                                instrumentSettings: settings.instrumentSettings,
                                drumSettings: settings.drumSettings,
                                bpm: settings.bpm,
                            }
                        })
                    }
                };

                setIsInitialized(true);
                setIsInitializing(false);
                setLoadingText('');
                rhythmFrame.removeEventListener('load', frameLoadHandler);
                resolve(true);
            };
            
            if (rhythmFrame.contentWindow && rhythmFrame.contentWindow.document.readyState === 'complete') {
                 frameLoadHandler();
            } else {
                rhythmFrame.addEventListener('load', frameLoadHandler);
            }

        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          toast({ variant: "destructive", title: "Initialization Failed", description: errorMsg });
          console.error("Initialization failed:", e);
          setIsInitializing(false);
          setLoadingText('');
          resolve(false);
        }
    });
  }, [isInitialized, isInitializing, toast, scheduleLoop]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
        composerWorkerRef.current?.terminate();
        if(scheduleIntervalRef.current) clearInterval(scheduleIntervalRef.current);
    }
  }, []);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

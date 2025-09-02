
'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, Score, RhythmFrameCommand } from '@/types/music';

// --- Type Definitions ---
type WorkerCommand = {
    command: 'start' | 'stop' | 'update_settings';
    data?: any;
}

type WorkerMessage = {
    type: 'score' | 'error' | 'log';
    data?: any;
    error?: string;
    message?: string;
}

// --- Public Interface ---
export interface AudioEngine {
  setIsPlaying: (isPlaying: boolean) => void;
  updateSettings: (settings: Partial<WorkerSettings>) => void;
}

// --- React Context ---
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

// --- Provider Component ---
export const AudioEngineProvider = ({ children }: { children: React.ReactNode }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  const workerRef = useRef<Worker | null>(null);
  const rhythmFrameRef = useRef<HTMLIFrameElement | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  const isRhythmFrameReady = useRef(false);
  
  const { toast } = useToast();

  const postToWorker = (message: WorkerCommand) => {
    workerRef.current?.postMessage(message);
  };

  const postToRhythmFrame = (message: RhythmFrameCommand) => {
      rhythmFrameRef.current?.contentWindow?.postMessage(message, '*');
  };

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;
    setIsInitializing(true);
    setLoadingText('Initializing audio systems...');

    return new Promise<boolean>((resolve) => {
        // --- Get Iframe ---
        const iframe = document.getElementById('rhythm-frame') as HTMLIFrameElement;
        if (!iframe) {
            console.error("Fatal: Rhythm frame not found in DOM.");
            toast({ variant: "destructive", title: "Initialization Failed", description: "Rhythm frame not found." });
            setIsInitializing(false);
            resolve(false);
            return;
        }
        rhythmFrameRef.current = iframe;

        // --- Setup Worker ---
        const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        // --- Worker Message Handler ---
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const { type, data, error, message } = event.data;

            if(message) console.log(`[MSG FROM WORKER] ${message}`);

            switch (type) {
                case 'score':
                    if (isRhythmFrameReady.current) {
                        postToRhythmFrame({ command: 'schedule', payload: data });
                    }
                    break;
                case 'error':
                    const errorMsg = error || "Unknown error from worker.";
                    toast({ variant: "destructive", title: "Worker Error", description: errorMsg });
                    console.error("Worker Error:", errorMsg);
                    break;
            }
        };

        // --- Iframe Message Handler ---
        const handleFrameMessage = (event: MessageEvent) => {
             if (!event.data || !event.data.type) return;
             const { type, error } = event.data;

             if(type === 'rhythm_frame_ready'){
                 console.log("[AudioEngine] Rhythm frame is ready for commands.");
                 isRhythmFrameReady.current = true;
                 
                 engineRef.current = {
                    setIsPlaying: (isPlaying: boolean) => {
                        postToWorker({ command: isPlaying ? 'start' : 'stop' });
                        postToRhythmFrame({ command: isPlaying ? 'start' : 'stop' });
                    },
                    updateSettings: (settings: Partial<WorkerSettings>) => {
                        postToWorker({ command: 'update_settings', data: settings });
                        // We can also send relevant settings to the frame if needed, e.g., for effects
                        postToRhythmFrame({command: 'set_param', payload: {
                            bassInstrument: settings.instrumentSettings?.bass.name,
                            melodyInstrument: settings.instrumentSettings?.melody.name
                        }});
                    }
                 };

                 setLoadingText('Engine initialized.');
                 setIsInitialized(true);
                 setIsInitializing(false);
                 resolve(true);

             } else if (type === 'error') {
                 const errorMsg = error || "Unknown error from rhythm frame.";
                 toast({ variant: "destructive", title: "Rhythm Frame Error", description: errorMsg });
                 console.error("Rhythm Frame Error:", errorMsg);
                 setIsInitializing(false);
                 resolve(false);
             }
        };

        window.addEventListener('message', handleFrameMessage);

        setLoadingText('Initializing Rhythm Engine...');
        // The iframe will load its own scripts. Once it's ready, it sends 'rhythm_frame_ready'
        // But we need to tell it to start its own initialization once it has loaded.
        iframe.onload = () => {
             console.log('[AudioEngine] Iframe loaded. Sending init command...');
             postToRhythmFrame({ command: 'init' });
        };
        // If the iframe is already loaded by the time this runs
        if (iframe.contentWindow && iframe.contentDocument?.readyState === 'complete') {
            console.log('[AudioEngine] Iframe already loaded. Sending init command...');
            postToRhythmFrame({ command: 'init' });
        }


    });
  }, [isInitialized, isInitializing, toast]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
        workerRef.current?.terminate();
        // The iframe will be removed with the component
    }
  }, []);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

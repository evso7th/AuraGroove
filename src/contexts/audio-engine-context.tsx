
'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, FrameMessage } from '@/types/music';

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
  const melodyFrameRef = useRef<HTMLIFrameElement | null>(null);

  const engineRef = useRef<AudioEngine | null>(null);
  
  const { toast } = useToast();
  
  useEffect(() => {
    // This effect should run only once to initialize the worker and listeners
    const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    const handleWorkerMessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, data, error, message } = event.data;

        if (message) console.log(`[MSG FROM WORKER] ${message}`);

        if (type === 'score' && data) {
            if (rhythmFrameRef.current && data.score.bassScore) {
                const rhythmPayload = { 
                    bar: data.bar, 
                    score: { bassScore: data.score.bassScore, drumScore: data.score.drumScore } 
                };
                rhythmFrameRef.current.contentWindow?.postMessage({ command: 'schedule', payload: rhythmPayload }, '*');
            }
            if (melodyFrameRef.current && data.score.melodyScore) {
                 const melodyPayload = { 
                    bar: data.bar, 
                    score: data.score.melodyScore
                };
                melodyFrameRef.current.contentWindow?.postMessage({ command: 'schedule', payload: melodyPayload }, '*');
            }
        } else if (type === 'error') {
            const errorMsg = error || "Unknown error from worker.";
            toast({ variant: "destructive", title: "Worker Error", description: errorMsg });
            console.error("Worker Error:", errorMsg);
        }
    };
    
    worker.onmessage = handleWorkerMessage;

    return () => {
        worker.terminate();
    };
  }, [toast]);


  const initialize = async () => {
    if (isInitialized || isInitializing) return true;
    setIsInitializing(true);
    setLoadingText('Initializing audio systems...');

    // Get iframe elements from the DOM
    rhythmFrameRef.current = document.getElementById('rhythm-frame') as HTMLIFrameElement;
    melodyFrameRef.current = document.getElementById('melody-frame') as HTMLIFrameElement;
    
    // Immediately send init commands. We trust the frames will be ready.
    rhythmFrameRef.current.contentWindow?.postMessage({ command: 'init' }, '*');
    melodyFrameRef.current.contentWindow?.postMessage({ command: 'init' }, '*');

    // Define the engine functions
    engineRef.current = {
        setIsPlaying: (isPlaying: boolean) => {
            const command = isPlaying ? 'start' : 'stop';
            // Also send start/stop to frames to handle AudioContext resume
            workerRef.current?.postMessage({ command });
            rhythmFrameRef.current?.contentWindow?.postMessage({ command }, '*');
            melodyFrameRef.current?.contentWindow?.postMessage({ command }, '*');
        },
        updateSettings: (settings: Partial<WorkerSettings>) => {
            console.log('[AudioEngineProvider] updateSettings called with:', settings);
            workerRef.current?.postMessage({ command: 'update_settings', data: settings });

             if (settings.instrumentSettings?.bass?.name) {
                rhythmFrameRef.current?.contentWindow?.postMessage({ command: 'set_param', payload: { bassInstrument: settings.instrumentSettings.bass.name } }, '*');
            }
            if (settings.instrumentSettings?.melody?.name) {
                const payload = { melodyInstrument: settings.instrumentSettings.melody.name };
                console.log('[AudioEngineProvider] POSTING to melody-frame:', { command: 'set_param', payload });
                melodyFrameRef.current?.contentWindow?.postMessage({ command: 'set_param', payload }, '*');
            }
        }
    };
    
    // Assume initialization is successful and let the user proceed.
    setLoadingText('Engine initialized.');
    setIsInitialized(true);
    setIsInitializing(false);

    return true;
  };

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

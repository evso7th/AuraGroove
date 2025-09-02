
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
    const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    const handleWorkerMessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, data, error, message } = event.data;

        if(message) console.log(`[MSG FROM WORKER] ${message}`);

        switch (type) {
            case 'score':
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
                break;
            case 'error':
                const errorMsg = error || "Unknown error from worker.";
                toast({ variant: "destructive", title: "Worker Error", description: errorMsg });
                console.error("Worker Error:", errorMsg);
                break;
        }
    };
    
    worker.onmessage = handleWorkerMessage;

    const handleFrameMessage = (event: MessageEvent<FrameMessage>) => {
         if (!event.data || !event.data.type) return;
         const { type, error, frame } = event.data;
         
         if (type === 'error') {
             const errorMsg = error || "Unknown error from an iframe.";
             toast({ variant: "destructive", title: "Audio Frame Error", description: errorMsg });
             console.error("IFrame Error:", errorMsg, `(from ${frame})`);
         }
    };
    window.addEventListener('message', handleFrameMessage);

    return () => {
        worker.terminate();
        window.removeEventListener('message', handleFrameMessage);
    }
  }, [toast]);


  const initialize = async () => {
    if (isInitialized || isInitializing) return true;
    setIsInitializing(true);
    setLoadingText('Initializing audio systems...');

    rhythmFrameRef.current = document.getElementById('rhythm-frame') as HTMLIFrameElement;
    melodyFrameRef.current = document.getElementById('melody-frame') as HTMLIFrameElement;
    
    rhythmFrameRef.current.contentWindow?.postMessage({ command: 'init' }, '*');
    melodyFrameRef.current.contentWindow?.postMessage({ command: 'init' }, '*');

    engineRef.current = {
        setIsPlaying: (isPlaying: boolean) => {
            workerRef.current?.postMessage({ command: isPlaying ? 'start' : 'stop' });
            rhythmFrameRef.current?.contentWindow?.postMessage({ command: isPlaying ? 'start' : 'stop' }, '*');
            melodyFrameRef.current?.contentWindow?.postMessage({ command: isPlaying ? 'start' : 'stop' }, '*');
        },
        updateSettings: (settings: Partial<WorkerSettings>) => {
            workerRef.current?.postMessage({ command: 'update_settings', data: settings });
             if (settings.instrumentSettings?.bass?.name) {
                rhythmFrameRef.current?.contentWindow?.postMessage({ command: 'set_param', payload: { bassInstrument: settings.instrumentSettings.bass.name } }, '*');
            }
            if (settings.instrumentSettings?.melody?.name) {
                melodyFrameRef.current?.contentWindow?.postMessage({ command: 'set_param', payload: { melodyInstrument: settings.instrumentSettings.melody.name } }, '*');
            }
        }
    };
    
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

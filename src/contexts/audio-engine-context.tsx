
'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings } from '@/types/music';

// --- Type Definitions ---
type WorkerCommand = {
    command: 'start' | 'stop' | 'update_settings';
    data?: any;
}

type FrameCommand = {
     command: 'init' | 'start' | 'stop' | 'set_param' | 'report_status';
     payload?: any;
}

type WorkerMessage = {
    type: 'score' | 'error' | 'log';
    data?: any;
    error?: string;
    message?: string;
}

type FrameMessage = {
    type: 'rhythm_frame_ready' | 'error' | 'status_report';
    frame: 'rhythm'; // Only rhythm frame is left
    state?: string; // AudioContext.state
    error?: string;
};


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
  
  const { toast } = useToast();
  
  useEffect(() => {
    // This effect should run only once to initialize the worker and listeners
    const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    const handleWorkerMessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, data, error, message } = event.data;

        if (message) console.log(`[MSG FROM WORKER] ${message}`);

        if (type === 'score' && data) {
            if (rhythmFrameRef.current && (data.score.bassScore || data.score.drumScore)) {
                 const rhythmPayload = { 
                    bar: data.bar, 
                    score: { bassScore: data.score.bassScore, drumScore: data.score.drumScore } 
                };
                rhythmFrameRef.current.contentWindow?.postMessage({ command: 'schedule', payload: rhythmPayload }, '*');
            }
        } else if (type === 'error') {
            const errorMsg = error || "Unknown error from worker.";
            toast({ variant: "destructive", title: "Worker Error", description: errorMsg });
            console.error("Worker Error:", errorMsg);
        }
    };

    const handleFrameMessage = (event: MessageEvent<FrameMessage>) => {
        if (event.data.type === 'status_report') {
            console.log(`[${event.data.frame.toUpperCase()} FRAME STATUS] ${event.data.state}`);
        }
    }
    
    worker.onmessage = handleWorkerMessage;
    window.addEventListener('message', handleFrameMessage);

    // Diagnostic interval
    const diagnosticInterval = setInterval(() => {
        rhythmFrameRef.current?.contentWindow?.postMessage({ command: 'report_status' }, '*');
    }, 2000);


    return () => {
        worker.terminate();
        window.removeEventListener('message', handleFrameMessage);
        clearInterval(diagnosticInterval);
    };
  }, [toast]);


  const initialize = async () => {
    if (isInitialized || isInitializing) return true;
    setIsInitializing(true);
    setLoadingText('Initializing audio systems...');

    rhythmFrameRef.current = document.getElementById('rhythm-frame') as HTMLIFrameElement;
    
    const initRhythm = new Promise<void>(resolve => {
        const onReady = (e: MessageEvent<FrameMessage>) => {
            if (e.data.type === 'rhythm_frame_ready') {
                window.removeEventListener('message', onReady);
                resolve();
            }
        }
        window.addEventListener('message', onReady);
        rhythmFrameRef.current?.contentWindow?.postMessage({ command: 'init' }, '*');
    });

    await initRhythm;
    
    engineRef.current = {
        setIsPlaying: (isPlaying: boolean) => {
            const command = isPlaying ? 'start' : 'stop';
            workerRef.current?.postMessage({ command });
            rhythmFrameRef.current?.contentWindow?.postMessage({ command }, '*');
        },
        updateSettings: (settings: Partial<WorkerSettings>) => {
            workerRef.current?.postMessage({ command: 'update_settings', data: settings });

             if (settings.instrumentSettings?.bass?.name) {
                rhythmFrameRef.current?.contentWindow?.postMessage({ command: 'set_param', payload: { bassInstrument: settings.instrumentSettings.bass.name } }, '*');
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

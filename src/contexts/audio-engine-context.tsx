
'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, Score, RhythmFrameCommand, MelodyFrameCommand, FrameMessage } from '@/types/music';

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
  
  // This effect sets up the worker and message listeners once.
  useEffect(() => {
    const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    const handleWorkerMessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, data, error, message } = event.data;

        if(message) console.log(`[MSG FROM WORKER] ${message}`);

        switch (type) {
            case 'score':
                if (rhythmFrameRef.current && data.score.bassScore) {
                    rhythmFrameRef.current.contentWindow?.postMessage({ command: 'schedule', payload: { bar: data.bar, score: { bassScore: data.score.bassScore, drumScore: data.score.drumScore } } }, '*');
                }
                 if (melodyFrameRef.current && data.score.melodyScore) {
                    melodyFrameRef.current.contentWindow?.postMessage({ command: 'schedule', payload: { bar: data.bar, score: { melodyScore: data.score.melodyScore } } }, '*');
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

    // The main message handler for events from any iframe
    const handleFrameMessage = (event: MessageEvent<FrameMessage>) => {
         if (!event.data || !event.data.type) return;
         const { type, error, frame } = event.data;
         
         if (type === 'error') {
             const errorMsg = error || "Unknown error from an iframe.";
             toast({ variant: "destructive", title: "Audio Frame Error", description: errorMsg });
             console.error("IFrame Error:", errorMsg, `(from ${frame})`);
         }
         
         // We can listen for other messages here if needed in the future.
         if (type === 'rhythm_frame_ready' || type === 'melody_frame_ready') {
            console.log(`[AudioEngine] Received ready signal from ${frame} frame.`);
         }
    };
    window.addEventListener('message', handleFrameMessage);

    // Cleanup function
    return () => {
        worker.terminate();
        window.removeEventListener('message', handleFrameMessage);
    }
  }, [toast]);


  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;
    setIsInitializing(true);
    setLoadingText('Initializing audio systems...');

    // Get frames from the DOM
    const rhythmFrame = document.getElementById('rhythm-frame') as HTMLIFrameElement;
    const melodyFrame = document.getElementById('melody-frame') as HTMLIFrameElement;

    if (!rhythmFrame || !melodyFrame) {
      console.error("Fatal: One or more iframes not found in DOM.");
      toast({ variant: "destructive", title: "Initialization Failed", description: "Audio engine frames not found." });
      setIsInitializing(false);
      return false;
    }
    
    rhythmFrameRef.current = rhythmFrame;
    melodyFrameRef.current = melodyFrame;

    // Send init command to both frames. We trust them to initialize.
    rhythmFrame.contentWindow?.postMessage({ command: 'init' }, '*');
    melodyFrame.contentWindow?.postMessage({ command: 'init' }, '*');

    // Define the engine interface
    engineRef.current = {
        setIsPlaying: (isPlaying: boolean) => {
            workerRef.current?.postMessage({ command: isPlaying ? 'start' : 'stop' });
            rhythmFrameRef.current?.contentWindow?.postMessage({ command: isPlaying ? 'start' : 'stop' }, '*');
            melodyFrameRef.current?.contentWindow?.postMessage({ command: isPlaying ? 'start' : 'stop' }, '*');
        },
        updateSettings: (settings: Partial<WorkerSettings>) => {
            workerRef.current?.postMessage({ command: 'update_settings', data: settings });
            rhythmFrameRef.current?.contentWindow?.postMessage({ command: 'set_param', payload: { bassInstrument: settings.instrumentSettings?.bass.name } }, '*');
            melodyFrameRef.current?.contentWindow?.postMessage({ command: 'set_param', payload: { melodyInstrument: settings.instrumentSettings?.melody.name } }, '*');
        }
    };

    // Assume initialization is successful and let's move to the main UI.
    // We can add a more robust check later if needed.
    setTimeout(() => {
        setLoadingText('Engine initialized.');
        setIsInitialized(true);
        setIsInitializing(false);
    }, 1000); // Give a short delay for frames to warm up, then proceed.

    return true;
  }, [isInitialized, isInitializing, toast]);


  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

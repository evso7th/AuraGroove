
'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, Score } from '@/types/music';

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
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const engineRef = useRef<AudioEngine | null>(null);
  
  const { toast } = useToast();
  
  useEffect(() => {
    // This effect runs only once to initialize the worker
    const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    const handleWorkerMessage = (event: MessageEvent<WorkerMessage>) => {
        const { type, data, error, message } = event.data;
        if (message) console.log(`[MSG FROM WORKER] ${message}`);
        
        if (type === 'score' && data) {
            // TODO: In Step 3, this will send the score to the AudioWorklet pool
            // console.log("Received score for bar:", data.bar);
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
    
    // As per the Advisor's recommendation, we ensure the AudioContext is unlocked
    // by the user's first gesture.
    if (!audioContextRef.current) {
        try {
            setLoadingText('Waiting for user interaction...');
            audioContextRef.current = new AudioContext();
            
            const unlockAudio = async () => {
                if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                    await audioContextRef.current.resume();
                }
                window.removeEventListener('click', unlockAudio);
                window.removeEventListener('touchend', unlockAudio);
            };

            window.addEventListener('click', unlockAudio);
            window.addEventListener('touchend', unlockAudio);
            
            // Check initial state
            await unlockAudio();

        } catch (e) {
            toast({ variant: "destructive", title: "Audio Error", description: "Could not create AudioContext."});
            console.error(e);
            return false;
        }
    }
    
    setIsInitializing(true);
    setLoadingText('Initializing audio systems...');
    
    // In future steps, we will load the AudioWorklet here.
    
    engineRef.current = {
        setIsPlaying: (isPlaying: boolean) => {
            const command = isPlaying ? 'start' : 'stop';
            workerRef.current?.postMessage({ command });
        },
        updateSettings: (settings: Partial<WorkerSettings>) => {
            workerRef.current?.postMessage({ command: 'update_settings', data: settings });
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

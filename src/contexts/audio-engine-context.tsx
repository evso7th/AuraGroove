
'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Score, WorkerSettings } from '@/types/music';

// --- Type Definitions ---
type WorkerMessage = {
    type: 'score' | 'error' | 'log';
    score?: Score;
    error?: string;
    message?: string;
}

// --- React Context ---
interface AudioEngineContextType {
  isInitialized: boolean;
  isPlaying: boolean;
  initialize: () => Promise<boolean>;
  setIsPlaying: (playing: boolean) => void;
  updateSettings: (settings: Partial<WorkerSettings>) => void;
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  
  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const { toast } = useToast();
  
  const initialize = useCallback(async () => {
    if (isInitialized) return true;
    
    // Ensure the AudioContext is unlocked by the user's first gesture.
    if (!audioContextRef.current) {
        try {
            setLoadingText('Waiting for user interaction...');
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = context;
            
            const unlockAudio = async () => {
                if (context && context.state === 'suspended') {
                    await context.resume();
                    console.log("AudioContext resumed!");
                }
                window.removeEventListener('click', unlockAudio, true);
                window.removeEventListener('touchend', unlockAudio, true);
            };

            window.addEventListener('click', unlockAudio, true);
            window.addEventListener('touchend', unlockAudio, true);
            
            // Check initial state
            await unlockAudio();

        } catch (e) {
            toast({ variant: "destructive", title: "Audio Error", description: "Could not create AudioContext."});
            console.error(e);
            return false;
        }
    }
     
    // Initialize the worker if it doesn't exist
    if (!workerRef.current) {
        setLoadingText("Initializing music composer...");
        const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
        
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const { type, score, error, message } = event.data;
            if (message) console.log(`[MSG FROM WORKER] ${message}`);
            
            if (type === 'score' && score) {
                console.log("Received score from worker:", score);
                // In Step 3, this will be sent to the AudioWorklet pool
            } else if (type === 'error') {
                const errorMsg = error || "Unknown error from worker.";
                toast({ variant: "destructive", title: "Worker Error", description: errorMsg });
                console.error("Worker Error:", errorMsg);
            }
        };
        workerRef.current = worker;
    }
    
    setLoadingText('Engine initialized.');
    setIsInitialized(true);
    return true;
  }, [isInitialized, toast]);

  const setIsPlayingCallback = useCallback((playing: boolean) => {
    if (!isInitialized || !workerRef.current) return;
    
    const command = playing ? 'start' : 'stop';
    workerRef.current.postMessage({ command });
    setIsPlaying(playing);

  }, [isInitialized]);

  const updateSettingsCallback = useCallback((settings: Partial<WorkerSettings>) => {
     if (!isInitialized || !workerRef.current) return;
     workerRef.current.postMessage({ command: 'update_settings', data: settings });
  }, [isInitialized]);


  useEffect(() => {
    // Cleanup worker on component unmount
    return () => {
        workerRef.current?.terminate();
    };
  }, []);

  return (
    <AudioEngineContext.Provider value={{
        isInitialized,
        isPlaying,
        initialize,
        setIsPlaying: setIsPlayingCallback,
        updateSettings: updateSettingsCallback,
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

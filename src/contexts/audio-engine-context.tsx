
'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings } from '@/types/music';
import { AudioPlayer } from '@/lib/audio-player';

// --- Type Definitions ---
type WorkerCommand = {
    command: 'init' | 'start' | 'stop' | 'update_settings';
    data?: any;
}

type WorkerMessage = {
    type: 'worker_ready' | 'worker_started' | 'audio_chunk' | 'error' | 'log';
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
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const engineRef = useRef<AudioEngine | null>(null);
  
  const { toast } = useToast();
  
  const postToWorker = (message: WorkerCommand) => {
    workerRef.current?.postMessage(message);
  }

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;
    setIsInitializing(true);
    
    return new Promise<boolean>((resolve) => {
      try {
        setLoadingText('Booting worker...');
        const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        const audioPlayer = new AudioPlayer();
        audioPlayer.init().then(() => {
            audioPlayerRef.current = audioPlayer;
            
            // --- Worker Message Handler ---
            worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
                const { type, data, error, message } = event.data;

                if(message) console.log(`[MSG FROM WORKER] ${message}`);

                switch (type) {
                    case 'worker_ready':
                        setLoadingText('Worker ready. Engine initialized.');
                        
                        engineRef.current = {
                            setIsPlaying: (isPlaying: boolean) => {
                                if (isPlaying) {
                                    audioPlayer.start();
                                    postToWorker({ command: 'start' });
                                } else {
                                    audioPlayer.stop();
                                    postToWorker({ command: 'stop' });
                                }
                            },
                            updateSettings: (settings: Partial<WorkerSettings>) => {
                                postToWorker({ command: 'update_settings', data: settings });
                            }
                        };

                        setIsInitialized(true);
                        setIsInitializing(false);
                        resolve(true);
                        break;
                    
                    case 'audio_chunk':
                        audioPlayer.scheduleChunk(data.chunk, data.duration);
                        break;
                        
                    case 'error':
                        const errorMsg = error || "Unknown error from worker.";
                        toast({ variant: "destructive", title: "Worker Error", description: errorMsg });
                        console.error("Worker Error:", errorMsg);
                        setIsInitializing(false);
                        resolve(false);
                        break;
                }
            };
            
            setLoadingText('Initializing worker...');
            postToWorker({ command: 'init', data: { sampleRate: audioPlayer.getSampleRate() } });

        }).catch(e => {
            const errorMsg = e instanceof Error ? e.message : String(e);
            toast({ variant: "destructive", title: "Audio Player Failed", description: errorMsg });
            console.error("Audio Player initialization failed:", e);
            setIsInitializing(false);
            resolve(false);
        });

      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        toast({ variant: "destructive", title: "Initialization Failed", description: errorMsg });
        console.error("Initialization failed:", e);
        workerRef.current?.terminate();
        setIsInitializing(false);
        resolve(false);
      }
    });
  }, [isInitialized, isInitializing, toast]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
        workerRef.current?.terminate();
        audioPlayerRef.current?.stop();
    }
  }, []);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

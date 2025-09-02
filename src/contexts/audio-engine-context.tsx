
'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, Score, RhythmFrameCommand, RhythmFrameMessage, MelodyFrameMessage } from '@/types/music';

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
  
  const readyStatesRef = useRef({ rhythm: false, melody: false });
  const timeoutRef = useRef<any>(null);
  
  const { toast } = useToast();

  const postToWorker = (message: WorkerCommand) => {
    workerRef.current?.postMessage(message);
  };

  const postToRhythmFrame = (message: RhythmFrameCommand) => {
      rhythmFrameRef.current?.contentWindow?.postMessage(message, '*');
  };

  const postToMelodyFrame = (message: MelodyFrameMessage) => {
      melodyFrameRef.current?.contentWindow?.postMessage(message, '*');
  };

    // This function is now defined directly inside the provider
    const checkAllFramesReady = () => {
        if (readyStatesRef.current.rhythm && readyStatesRef.current.melody) {
            console.log('[AudioEngine] All frames are ready.');
            
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            engineRef.current = {
                setIsPlaying: (isPlaying: boolean) => {
                    postToWorker({ command: isPlaying ? 'start' : 'stop' });
                    postToRhythmFrame({ command: isPlaying ? 'start' : 'stop' });
                    postToMelodyFrame({ command: isPlaying ? 'start' : 'stop' });
                },
                updateSettings: (settings: Partial<WorkerSettings>) => {
                    postToWorker({ command: 'update_settings', data: settings });
                    postToRhythmFrame({ command: 'set_param', payload: { bassInstrument: settings.instrumentSettings?.bass.name } });
                    postToMelodyFrame({ command: 'set_param', payload: { melodyInstrument: settings.instrumentSettings?.melody.name } });
                }
            };

            setLoadingText('Engine initialized.');
            setIsInitialized(true);
            setIsInitializing(false);
        }
    };

  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;
    setIsInitializing(true);
    setLoadingText('Initializing audio systems...');

    return new Promise<boolean>((resolve) => {
        timeoutRef.current = setTimeout(() => {
            console.error("Fatal: Timed out waiting for iframes to become ready.");
            toast({ variant: "destructive", title: "Initialization Failed", description: "Timed out waiting for audio engines." });
            setIsInitializing(false);
            resolve(false);
        }, 5000); // 5 second timeout

        // --- Get Iframes ---
        rhythmFrameRef.current = document.getElementById('rhythm-frame') as HTMLIFrameElement;
        melodyFrameRef.current = document.getElementById('melody-frame') as HTMLIFrameElement;

        if (!rhythmFrameRef.current || !melodyFrameRef.current) {
            console.error("Fatal: One or more iframes not found in DOM.");
            toast({ variant: "destructive", title: "Initialization Failed", description: "Audio engine frames not found." });
            setIsInitializing(false);
            clearTimeout(timeoutRef.current);
            resolve(false);
            return;
        }

        // --- Setup Worker ---
        const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;

        // --- Worker Message Handler ---
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            const { type, data, error, message } = event.data;

            if(message) console.log(`[MSG FROM WORKER] ${message}`);

            switch (type) {
                case 'score':
                    if (readyStatesRef.current.rhythm && data.score.bassScore && data.score.drumScore) {
                        postToRhythmFrame({ command: 'schedule', payload: { bar: data.bar, score: { bassScore: data.score.bassScore, drumScore: data.score.drumScore } } });
                    }
                     if (readyStatesRef.current.melody && data.score.melodyScore) {
                        postToMelodyFrame({ command: 'schedule', payload: { bar: data.bar, score: { melodyScore: data.score.melodyScore } } });
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
        const handleFrameMessage = (event: MessageEvent<RhythmFrameMessage | MelodyFrameMessage>) => {
             if (!event.data || !event.data.type) return;
             const { type, error, frame } = event.data;

             if (type === 'rhythm_frame_ready' || frame === 'rhythm') {
                 console.log("[AudioEngine] Rhythm frame is ready.");
                 readyStatesRef.current.rhythm = true;
                 checkAllFramesReady();
             } else if (type === 'melody_frame_ready' || frame === 'melody') {
                 console.log("[AudioEngine] Melody frame is ready.");
                 readyStatesRef.current.melody = true;
                 checkAllFramesReady();
             } else if (type === 'error') {
                 const errorMsg = error || "Unknown error from an iframe.";
                 toast({ variant: "destructive", title: "Audio Frame Error", description: errorMsg });
                 console.error("IFrame Error:", errorMsg);
                 setIsInitializing(false);
                 clearTimeout(timeoutRef.current);
                 resolve(false);
             }
        };

        window.addEventListener('message', handleFrameMessage);

        const initFrame = (frame: HTMLIFrameElement | null, frameName: string) => {
            if (!frame) return;
             const initFn = () => {
                 console.log(`[AudioEngine] ${frameName} loaded. Sending init command...`);
                 frame.contentWindow?.postMessage({ command: 'init' }, '*');
            };
            if (frame.contentWindow && frame.contentDocument?.readyState === 'complete') {
                initFn();
            } else {
                frame.onload = initFn;
            }
        };

        initFrame(rhythmFrameRef.current, "Rhythm frame");
        initFrame(melodyFrameRef.current, "Melody frame");

    });
  }, [isInitialized, isInitializing, toast]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
        workerRef.current?.terminate();
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
    }
  }, []);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

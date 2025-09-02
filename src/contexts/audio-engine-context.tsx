
'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerCommand, WorkerSettings, DrumNote, SynthNote, ScoreName, InstrumentSettings } from '@/types/music';

// This is the structure of messages from the composer worker
type ComposerWorkerMessage = {
  type: 'score';
  data: {
    drumScore: DrumNote[];
    bassScore: SynthNote[];
    melodyScore: SynthNote[];
    barDuration: number;
  };
} | {
  type: 'error';
  error?: string;
};

// This is the structure for commands to the rhythm frame
type RhythmFrameCommand = {
    command: 'init' | 'start' | 'stop' | 'schedule' | 'set_param';
    payload?: any;
}

// This is the structure for messages from the rhythm frame
type RhythmFrameMessage = {
    type: 'request_score';
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
  
  const { toast } = useToast();
  
  const postToRhythmFrame = (message: RhythmFrameCommand) => {
    rhythmFrameRef.current?.contentWindow?.postMessage(message, '*');
  }
  
  const postToComposerWorker = (message: WorkerCommand) => {
    composerWorkerRef.current?.postMessage(message);
  }

  const initialize = useCallback(async () => {
    console.log(`[INIT TRACE ${performance.now()}] Initialize started.`);
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    setLoadingText('Initializing Composer AI...');
    
    return new Promise<boolean>((resolve) => {
        try {
            // --- Initialize Web Worker (The Composer) ---
            console.log(`[INIT TRACE ${performance.now()}] Creating worker...`);
            const composerWorker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
            console.log(`[INIT TRACE ${performance.now()}] Worker created.`);
            composerWorkerRef.current = composerWorker;
            
            // --- Set up the message handler from the composer worker ---
            console.log(`[INIT TRACE ${performance.now()}] Setting up worker onmessage...`);
            composerWorker.onmessage = (event: MessageEvent<ComposerWorkerMessage>) => {
                const message = event.data;
                 console.log(`[MAIN THREAD] Received score from worker:`, message.data);
                 if (message.type === 'score') {
                    // Forward the complete score to the rhythm frame for scheduling
                    postToRhythmFrame({
                        command: 'schedule',
                        payload: message.data
                    });
                } else if (message.type === 'error') {
                    console.error('Error from composer worker:', message.error);
                    toast({ variant: 'destructive', title: 'Composer Error', description: message.error });
                }
            };
            console.log(`[INIT TRACE ${performance.now()}] Worker onmessage set.`);
            
            setLoadingText('Loading Rhythm Engine...');
            console.log(`[INIT TRACE ${performance.now()}] Getting rhythm frame...`);
            const rhythmFrame = document.getElementById('rhythm-frame') as HTMLIFrameElement;
            console.log(`[INIT TRACE ${performance.now()}] Rhythm frame obtained:`, rhythmFrame);
            rhythmFrameRef.current = rhythmFrame;

             // --- Handler for messages from the iframe ---
            const handleRhythmFrameMessage = (event: MessageEvent<RhythmFrameMessage>) => {
                if (event.source !== rhythmFrame.contentWindow) return; // Security check
                
                if (event.data.type === 'request_score') {
                    // The rhythm frame is requesting the next bar, so we tick the composer.
                    postToComposerWorker({ command: 'tick' });
                }
            };

            window.addEventListener('message', handleRhythmFrameMessage);


            // Wait for the iframe to be ready
            const frameLoadHandler = () => {
                console.log(`[INIT TRACE ${performance.now()}] frameLoadHandler started.`);
                
                console.log(`[INIT TRACE ${performance.now()}] Posting 'init' to rhythm frame.`);
                postToRhythmFrame({ command: 'init' });
                console.log(`[INIT TRACE ${performance.now()}] 'init' posted.`);
                
                console.log(`[INIT TRACE ${performance.now()}] Creating engineRef.`);
                engineRef.current = {
                    setIsPlaying: (isPlaying: boolean) => {
                        if(isPlaying) {
                            postToRhythmFrame({ command: 'start' });
                            postToComposerWorker({command: 'reset'});
                        } else {
                            postToRhythmFrame({ command: 'stop' });
                        }
                    },
                    updateSettings: (settings: Partial<WorkerSettings>) => {
                        // NEW: Send atomic commands instead of one large object
                        if (settings.instrumentSettings) {
                            const { bass, melody } = settings.instrumentSettings;
                            // For Composer
                            postToComposerWorker({command: 'set_param', data: {key: 'bass_name', value: bass.name}});
                            postToComposerWorker({command: 'set_param', data: {key: 'bass_volume', value: bass.volume}});
                            postToComposerWorker({command: 'set_param', data: {key: 'melody_name', value: melody.name}});
                            postToComposerWorker({command: 'set_param', data: {key: 'melody_volume', value: melody.volume}});
                            postToComposerWorker({command: 'set_param', data: {key: 'melody_technique', value: melody.technique}});
                            
                            // For Rhythm Frame
                            postToRhythmFrame({command: 'set_param', payload: {target: 'bass', key: 'name', value: bass.name}});
                            postToRhythmFrame({command: 'set_param', payload: {target: 'bass', key: 'volume', value: bass.volume}});
                        }
                        if (settings.drumSettings) {
                             // For Composer
                             postToComposerWorker({command: 'set_param', data: {key: 'drum_pattern', value: settings.drumSettings.pattern}});
                             postToComposerWorker({command: 'set_param', data: {key: 'drum_volume', value: settings.drumSettings.volume}});
                             // For Rhythm Frame
                             postToRhythmFrame({command: 'set_param', payload: {target: 'drums', key: 'volume', value: settings.drumSettings.volume}});
                        }
                        if (settings.bpm) {
                             // For Composer
                            postToComposerWorker({command: 'set_param', data: {key: 'bpm', value: settings.bpm}});
                             // For Rhythm Frame
                            postToRhythmFrame({command: 'set_param', payload: {target: 'transport', key: 'bpm', value: settings.bpm}});
                        }
                         if (settings.score) {
                            postToComposerWorker({command: 'set_param', data: {key: 'score', value: settings.score}});
                        }
                    }
                };
                console.log(`[INIT TRACE ${performance.now()}] engineRef created.`);

                setIsInitialized(true);
                setIsInitializing(false);
                setLoadingText('');
                rhythmFrame.removeEventListener('load', frameLoadHandler);
                console.log(`[INIT TRACE ${performance.now()}] frameLoadHandler finished.`);
                resolve(true);
            };
            
            if (rhythmFrame.contentWindow && rhythmFrame.contentWindow.document.readyState === 'complete') {
                 console.log(`[INIT TRACE ${performance.now()}] Frame already loaded, calling handler directly.`);
                 frameLoadHandler();
            } else {
                console.log(`[INIT TRACE ${performance.now()}] Frame not loaded, adding event listener.`);
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
  }, [isInitialized, isInitializing, toast]);
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
        composerWorkerRef.current?.terminate();
    }
  }, []);

  return (
    <AudioEngineContext.Provider value={{ engine: engineRef.current, isInitialized, isInitializing, initialize, loadingText }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerCommand, WorkerSettings, ScoreName, InstrumentSettings, ComposerWorkerMessage } from '@/types/music';
import type { RhythmFrameCommand, RhythmFrameMessage } from '@/types/music';


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
    if (isInitialized || isInitializing) return true;

    setIsInitializing(true);
    
    return new Promise<boolean>((resolve) => {
        try {
            setLoadingText('Initializing Composer...');
            const composerWorker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
            composerWorkerRef.current = composerWorker;
            
            composerWorker.onmessage = (event: MessageEvent<ComposerWorkerMessage>) => {
                const message = event.data;
                 if (message.type === 'score') {
                    postToRhythmFrame({ command: 'schedule', payload: message.data });
                } else if (message.type === 'error') {
                    console.error('Error from composer worker:', message.error);
                    toast({ variant: 'destructive', title: 'Composer Error', description: message.error });
                }
            };
            
            setLoadingText('Waiting for Rhythm Engine...');
            const rhythmFrame = document.getElementById('rhythm-frame') as HTMLIFrameElement;
            rhythmFrameRef.current = rhythmFrame;

            const handleRhythmFrameMessage = (event: MessageEvent<RhythmFrameMessage>) => {
                if (event.source !== rhythmFrame.contentWindow) return;
                
                if (event.data.type === 'request_score') {
                    postToComposerWorker({ command: 'tick' });
                } else if (event.data.type === 'rhythm_frame_ready') {
                    setLoadingText('Rhythm Engine Ready. Finalizing...');
                    
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
                             if (settings.instrumentSettings) {
                                const { bass, melody } = settings.instrumentSettings;
                                postToComposerWorker({command: 'set_param', data: {key: 'bass_name', value: bass.name}});
                                postToComposerWorker({command: 'set_param', data: {key: 'bass_volume', value: bass.volume}});
                                postToComposerWorker({command: 'set_param', data: {key: 'melody_name', value: melody.name}});
                                postToComposerWorker({command: 'set_param', data: {key: 'melody_volume', value: melody.volume}});
                                postToComposerWorker({command: 'set_param', data: {key: 'melody_technique', value: melody.technique}});
                                postToRhythmFrame({command: 'set_param', payload: {target: 'bass', key: 'name', value: bass.name}});
                                postToRhythmFrame({command: 'set_param', payload: {target: 'bass', key: 'volume', value: bass.volume}});
                            }
                            if (settings.drumSettings) {
                                 postToComposerWorker({command: 'set_param', data: {key: 'drum_pattern', value: settings.drumSettings.pattern}});
                                 postToComposerWorker({command: 'set_param', data: {key: 'drum_volume', value: settings.drumSettings.volume}});
                                 postToRhythmFrame({command: 'set_param', payload: {target: 'drums', key: 'volume', value: settings.drumSettings.volume}});
                            }
                            if (settings.bpm) {
                                postToComposerWorker({command: 'set_param', data: {key: 'bpm', value: settings.bpm}});
                                postToRhythmFrame({command: 'set_param', payload: {target: 'transport', key: 'bpm', value: settings.bpm}});
                            }
                             if (settings.score) {
                                postToComposerWorker({command: 'set_param', data: {key: 'score', value: settings.score}});
                            }
                        }
                    };

                    setIsInitialized(true);
                    setIsInitializing(false);
                    setLoadingText('');
                    window.removeEventListener('message', handleRhythmFrameMessage); // Clean up listener
                    resolve(true);
                } else if (event.data.type === 'error') {
                     const errorMsg = event.data.error || "Unknown error from rhythm frame.";
                     toast({ variant: "destructive", title: "Rhythm Engine Error", description: errorMsg });
                     console.error("Rhythm Engine Error:", errorMsg);
                     setIsInitializing(false);
                     setLoadingText('');
                     resolve(false);
                }
            };

            window.addEventListener('message', handleRhythmFrameMessage);

            // Send the init command to the iframe, which will trigger the AudioContext
            setLoadingText('Initializing Rhythm Engine...');
            postToRhythmFrame({ command: 'init' });

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

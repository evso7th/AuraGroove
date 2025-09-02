
'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { Score, WorkerSettings, Note } from '@/types/music';

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
  const [isInitializing, setIsInitializing] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const synthPoolRef = useRef<AudioWorkletNode[]>([]);
  const nextVoiceRef = useRef(0);
  
  const { toast } = useToast();
  
  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;
    
    setIsInitializing(true);
    
    if (!audioContextRef.current) {
        try {
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
            await unlockAudio();

        } catch (e) {
            toast({ variant: "destructive", title: "Audio Error", description: "Could not create AudioContext."});
            console.error(e);
            setIsInitializing(false);
            return false;
        }
    }
    
    if (!workerRef.current) {
        const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            if (event.data.type === 'score' && event.data.score) {
                 if (audioContextRef.current && synthPoolRef.current.length > 0) {
                    scheduleScore(event.data.score, audioContextRef.current.currentTime);
                 }
            } else if (event.data.type === 'error') {
                 toast({ variant: "destructive", title: "Worker Error", description: event.data.error });
            }
        };
        workerRef.current = worker;
    }
    
    if(audioContextRef.current && synthPoolRef.current.length === 0) {
        try {
            await audioContextRef.current.audioWorklet.addModule('/worklets/synth-processor.js');
            const numVoices = 4; // Start with 4 voices for mobile-first safety
            for(let i = 0; i < numVoices; i++) {
                const node = new AudioWorkletNode(audioContextRef.current, 'synth-processor');
                node.connect(audioContextRef.current.destination);
                synthPoolRef.current.push(node);
            }
        } catch(e) {
            toast({ variant: "destructive", title: "Audio Worklet Error", description: "Failed to load synth processor." });
            console.error(e);
            setIsInitializing(false);
            return false;
        }
    }
    
    setIsInitialized(true);
    setIsInitializing(false);
    return true;
  }, [isInitialized, isInitializing, toast]);

  const scheduleScore = (score: Score, now: number) => {
    score.forEach(note => {
        const voice = synthPoolRef.current[nextVoiceRef.current % synthPoolRef.current.length];
        if (voice) {
            const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
            
            // Send noteOn message
            voice.port.postMessage({
                type: 'noteOn',
                frequency: freq,
                velocity: note.velocity || 0.8,
                when: now + note.time,
            });

            // Schedule noteOff message from the main thread
            const noteOffTime = (note.time + note.duration) * 1000;
            setTimeout(() => {
                voice.port.postMessage({
                    type: 'noteOff',
                    frequency: freq, // To identify which note to turn off if needed
                });
            }, noteOffTime);
        }
        nextVoiceRef.current++;
    });
  }

  const setIsPlayingCallback = useCallback((playing: boolean) => {
    if (!isInitialized || !workerRef.current || !audioContextRef.current) return;
    
    const command = playing ? 'start' : 'stop';
    if(playing && audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    workerRef.current.postMessage({ command });
    setIsPlaying(playing);

  }, [isInitialized]);

  const updateSettingsCallback = useCallback((settings: Partial<WorkerSettings>) => {
     if (!isInitialized || !workerRef.current) return;
     workerRef.current.postMessage({ command: 'update_settings', data: settings });
  }, [isInitialized]);

  useEffect(() => {
    return () => {
        workerRef.current?.terminate();
    };
  }, []);

  return (
    <AudioEngineContext.Provider value={{
        isInitialized: isInitialized && !isInitializing,
        isPlaying,
        initialize,
        setIsPlaying: setIsPlayingCallback,
        updateSettings: updateSettingsCallback,
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

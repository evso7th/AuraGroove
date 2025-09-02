
'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, Score, Note, DrumsScore, EffectsScore } from '@/types/music';
import * as Tone from 'tone';

// --- Type Definitions ---
type WorkerMessage = {
    type: 'score' | 'error';
    score?: Score;
    error?: string;
};

const isMobile = () => {
    if (typeof window === 'undefined') return false;
    return /Android|iPhone|iPad|iPod|WebOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

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
  const samplerRef = useRef<Tone.Sampler | null>(null);
  const nextVoiceRef = useRef(0);
  
  const { toast } = useToast();
  
  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;
    
    setIsInitializing(true);
    
    if (!audioContextRef.current) {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: isMobile() ? 22050 : 44100,
            });
            await context.resume();
            audioContextRef.current = context;
            Tone.setContext(context);
            console.log(`AudioContext initialized with sample rate: ${context.sampleRate}`);

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
                 if (audioContextRef.current && (synthPoolRef.current.length > 0 || samplerRef.current)) {
                    scheduleScore(event.data.score, audioContextRef.current);
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
            const numVoices = isMobile() ? 4 : 6;
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

    if (!samplerRef.current) {
        try {
            samplerRef.current = new Tone.Sampler({
                urls: {
                    C4: "kick_drum6.wav",
                    D4: "snare.wav",
                    E4: "closed_hi_hat_accented.wav",
                    F4: "crash1.wav",
                    G4: "hightom.wav",
                    A4: "cymbal_bell1.wav", // Effect 1
                    B4: "cymbal_bell2.wav"  // Effect 2
                },
                baseUrl: "/assets/drums/",
                onload: () => {
                    console.log("Sampler loaded");
                }
            }).toDestination();
        } catch (e) {
            toast({ variant: "destructive", title: "Sampler Error", description: "Failed to load drum samples." });
            console.error(e);
            setIsInitializing(false);
            return false;
        }
    }
    
    setIsInitialized(true);
    setIsInitializing(false);
    return true;
  }, [isInitialized, isInitializing, toast]);

  const scheduleScore = (score: Score, audioContext: AudioContext) => {
    const now = audioContext.currentTime;

    // Schedule synth parts (bass, melody) with AudioWorklet
    [...(score.bass || []), ...(score.melody || [])].forEach(note => {
        const voice = synthPoolRef.current[nextVoiceRef.current % synthPoolRef.current.length];
        if (voice) {
            const freq = 440 * Math.pow(2, (note.midi - 69) / 12);
            const noteOnTime = now + note.time;

            voice.port.postMessage({
                type: 'noteOn',
                frequency: freq,
                velocity: note.velocity || 0.8,
                when: noteOnTime,
            });

            const noteOffTime = noteOnTime + note.duration;
            const delayUntilOff = (noteOffTime - audioContext.currentTime);
            
            if (delayUntilOff > 0) {
                 setTimeout(() => {
                    voice.port.postMessage({ type: 'noteOff' });
                }, delayUntilOff * 1000);
            } else {
                 voice.port.postMessage({ type: 'noteOff' });
            }
        }
        nextVoiceRef.current++;
    });

    // Schedule sample parts (drums, effects) with Tone.Sampler
    if (samplerRef.current) {
        const sampler = samplerRef.current;
        (score.drums || []).forEach(note => {
             sampler.triggerAttack(note.note, now + note.time, note.velocity);
        });
        (score.effects || []).forEach(note => {
             sampler.triggerAttack(note.note, now + note.time, note.velocity);
        });
    }
  };

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
        audioContextRef.current?.close();
        samplerRef.current?.dispose();
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


'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, Score, Note, DrumsScore, EffectsScore, BassInstrument, InstrumentPart } from '@/types/music';

// --- Type Definitions ---
type WorkerMessage = {
    type: 'score' | 'error' | 'debug';
    score?: Score;
    error?: string;
    message?: string;
    data?: any;
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
  setVolume: (part: InstrumentPart, volume: number) => void;
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
  const settingsRef = useRef<WorkerSettings | null>(null);

  const gainNodesRef = useRef<Record<InstrumentPart, GainNode | null>>({
    bass: null,
    melody: null,
    drums: null,
    effects: null,
  });
  
  const { toast } = useToast();
  
  const initialize = useCallback(async () => {
    console.log('[AudioEngine] Initialize called');
    if (isInitialized || isInitializing) return true;
    
    setIsInitializing(true);
    
    if (!audioContextRef.current) {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: isMobile() ? 44100 : 44100,
            });
             if (context.state === 'suspended') {
                console.log('[AudioEngine] AudioContext is suspended, resuming...');
                await context.resume();
            }
            audioContextRef.current = context;
            console.log(`[AudioEngine] Initialized`, { context: context.state, sampleRate: context.sampleRate });

        } catch (e) {
            toast({ variant: "destructive", title: "Audio Error", description: "Could not create AudioContext."});
            console.error(e);
            setIsInitializing(false);
            return false;
        }
    }
    
     // Create GainNodes before worker and synths
    if (audioContextRef.current && !gainNodesRef.current.bass) {
        console.log('[AudioEngine] Creating GainNodes');
        const context = audioContextRef.current;
        const parts: InstrumentPart[] = ['bass', 'melody', 'drums', 'effects'];
        parts.forEach(part => {
            const gainNode = context.createGain();
            gainNode.connect(context.destination);
            gainNodesRef.current[part] = gainNode;
        });
    }

    if (!workerRef.current) {
        const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            if (event.data.type === 'score' && event.data.score) {
                 if (audioContextRef.current && (synthPoolRef.current.length > 0)) {
                    scheduleScore(event.data.score, audioContextRef.current);
                 }
            } else if (event.data.type === 'error') {
                 toast({ variant: "destructive", title: "Worker Error", description: event.data.error });
            } else if (event.data.type === 'debug') {
                 console.log(`[Worker DBG] ${event.data.message}`, event.data.data);
            }
        };
        workerRef.current = worker;
    }
    
    if(audioContextRef.current && synthPoolRef.current.length === 0) {
        try {
            // This file is in /public/worklets/ and is not part of the build process
            await audioContextRef.current.audioWorklet.addModule('/worklets/synth-processor.js');
            const numVoices = isMobile() ? 6 : 8;
            console.log(`[AudioEngine] Creating synth pool with ${numVoices} voices`);
            const melodyGain = gainNodesRef.current.melody;
            if (!melodyGain) throw new Error("Melody gain node not initialized");

            for(let i = 0; i < numVoices; i++) {
                const node = new AudioWorkletNode(audioContextRef.current, 'synth-processor');
                node.connect(melodyGain);
                synthPoolRef.current.push(node);
            }
             console.log('[AudioEngine] Synth pool created', { voices: synthPoolRef.current.length });
        } catch(e) {
            toast({ variant: "destructive", title: "Audio Worklet Error", description: "Failed to load synth processor." });
            console.error(e);
            setIsInitializing(false);
            return false;
        }
    }
    
    setIsInitialized(true);
    setIsInitializing(false);
    console.log('[AudioEngine] Initialization complete.');
    return true;
  }, [isInitialized, isInitializing, toast]);

  const getPresetParams = (instrumentName: BassInstrument, note: Note) => {
    console.log('[AudioEngine] getPresetParams called for', { instrumentName });
    const isMob = isMobile();
    let freq = 0;
    try {
        // Corrected from note.note.midi
        freq = 440 * Math.pow(2, (note.midi - 69) / 12);
    } catch(e) {
        console.error("Failed to calculate frequency for note:", note, e);
        return null;
    }

    if (isNaN(freq)) {
        console.error("Calculated frequency is NaN for note:", note);
        return null;
    }

    switch (instrumentName) {
        case 'portamento':
            return {
                type: 'noteOn',
                frequency: freq,
                velocity: note.velocity || 0.8,
                attack: 0.1,
                release: isMob ? 2.0 : 4.0,
                portamento: 0.05,
                filterCutoff: 1000,
                oscType: 'triangle'
            };
        default: // 'none' or other cases
             return null;
    }
  }


  const scheduleScore = (score: Score, audioContext: AudioContext) => {
    console.log('[AudioEngine] Scheduling score', { score });
    const now = audioContext.currentTime;
    const currentSettings = settingsRef.current;
    
    const bassNotes = score.bass || [];
    
    bassNotes.forEach(note => {
        const voice = synthPoolRef.current[nextVoiceRef.current % synthPoolRef.current.length];
        const bassGainNode = gainNodesRef.current.bass;
        
        if (voice && bassGainNode) {
            let params;
            if (currentSettings) {
                params = getPresetParams(currentSettings.instrumentSettings.bass.name, note);
            } else {
                 console.warn("[AudioEngine] No settings found for bass note scheduling");
                 return;
            }
            
            if (!params) {
                console.log("[AudioEngine] Skipping note, no params returned from getPresetParams (likely instrument is 'none')");
                return;
            }

            voice.disconnect();
            voice.connect(bassGainNode);

            const noteOnTime = now + note.time;
            console.log('[AudioEngine] Posting message to worklet', { params: {...params, when: noteOnTime} });
            voice.port.postMessage({ ...params, when: noteOnTime });

            const noteOffTime = noteOnTime + note.duration;
            const delayUntilOff = (noteOffTime - audioContext.currentTime);
            
            setTimeout(() => {
                voice.port.postMessage({ type: 'noteOff' });
            }, delayUntilOff > 0 ? delayUntilOff * 1000 : 0);
        }
        nextVoiceRef.current++;
    });
  };


  const setIsPlayingCallback = useCallback((playing: boolean) => {
    if (!isInitialized || !workerRef.current || !audioContextRef.current) return;
    
    const command = playing ? 'start' : 'stop';
    if(playing && audioContextRef.current.state === 'suspended') {
      console.log("[AudioEngine] Resuming AudioContext on play");
      audioContextRef.current.resume();
    }

    workerRef.current.postMessage({ command });
    setIsPlaying(playing);
    if (playing) {
      console.log(`[AudioEngine] Playback started`);
    } else {
      console.log(`[AudioEngine] Playback stopped`);
    }

  }, [isInitialized]);

  const updateSettingsCallback = useCallback((settings: Partial<WorkerSettings>) => {
     if (!isInitialized || !workerRef.current) return;
     const newSettings = { ...settingsRef.current, ...settings } as WorkerSettings;
     settingsRef.current = newSettings;
     workerRef.current.postMessage({ command: 'update_settings', data: newSettings });
     console.log('[AudioEngine] Settings updated', newSettings);
  }, [isInitialized]);

  const setVolumeCallback = useCallback((part: InstrumentPart, volume: number) => {
    const gainNode = gainNodesRef.current[part];
    if (gainNode) {
        gainNode.gain.value = volume;
        console.log(`[AudioEngine] Volume change`, { part, volume });
    } else {
        console.warn(`[AudioEngine] Attempted to set volume for non-existent part: ${part}`);
    }
  }, []);

  useEffect(() => {
    return () => {
        console.log('[AudioEngine] Cleaning up...');
        workerRef.current?.terminate();
        audioContextRef.current?.close();
    };
  }, []);

  return (
    <AudioEngineContext.Provider value={{
        isInitialized: isInitialized && !isInitializing,
        isPlaying,
        initialize,
        setIsPlaying: setIsPlayingCallback,
        updateSettings: updateSettingsCallback,
        setVolume: setVolumeCallback,
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
};


'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, Score, Note, DrumsScore, InstrumentPart, BassInstrument, MelodyInstrument, AccompanimentInstrument } from '@/types/music';
import { DrumMachine } from '@/lib/drum-machine';
import { AccompanimentSynthManager } from '@/lib/accompaniment-synth-manager';
import { BassSynthManager } from '@/lib/bass-synth-manager';
import { getPresetParams } from '@/lib/presets';

// --- Type Definitions ---
type WorkerMessage = {
    type: 'score' | 'error' | 'debug';
    score?: Score;
    error?: string;
    message?: string;
    data?: any;
};

// --- Constants ---
const VOICE_BALANCE = {
  bass: 1.0,
  melody: 0.5,
  accompaniment: 0.6,
  drums: 0.8,
  effects: 0.6,
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
  setInstrument: (part: 'bass' | 'melody' | 'accompaniment', name: BassInstrument | MelodyInstrument | AccompanimentInstrument) => void;
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
  const drumMachineRef = useRef<DrumMachine | null>(null);
  const accompanimentManagerRef = useRef<AccompanimentSynthManager | null>(null);
  const bassManagerRef = useRef<BassSynthManager | null>(null);

  const gainNodesRef = useRef<Record<InstrumentPart, GainNode | null>>({
    bass: null,
    melody: null,
    accompaniment: null,
    drums: null,
    effects: null,
  });
  
  const { toast } = useToast();
  
  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;
    
    setIsInitializing(true);
    
    if (!audioContextRef.current) {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: isMobile() ? 44100 : 44100,
            });
             if (context.state === 'suspended') {
                await context.resume();
            }
            audioContextRef.current = context;

        } catch (e) {
            toast({ variant: "destructive", title: "Audio Error", description: "Could not create AudioContext."});
            console.error(e);
            setIsInitializing(false);
            return false;
        }
    }
    
    if (audioContextRef.current && !gainNodesRef.current.bass) {
        const context = audioContextRef.current;
        const parts: InstrumentPart[] = ['bass', 'melody', 'accompaniment', 'effects', 'drums'];
        parts.forEach(part => {
            if (!gainNodesRef.current[part]) {
                const gainNode = context.createGain();
                gainNode.connect(context.destination);
                gainNodesRef.current[part] = gainNode;
            }
        });
    }

    if (!drumMachineRef.current && audioContextRef.current) {
        const drumGainNode = gainNodesRef.current.drums!;
        drumMachineRef.current = new DrumMachine(audioContextRef.current, drumGainNode);
        await drumMachineRef.current.init();
    }
    
    if (!accompanimentManagerRef.current && audioContextRef.current) {
        const accompGainNode = gainNodesRef.current.accompaniment!;
        accompanimentManagerRef.current = new AccompanimentSynthManager(audioContextRef.current, accompGainNode);
        await accompanimentManagerRef.current.init();
    }
    
    if (!bassManagerRef.current && audioContextRef.current) {
        const bassGainNode = gainNodesRef.current.bass!;
        bassManagerRef.current = new BassSynthManager(audioContextRef.current, bassGainNode);
        await bassManagerRef.current.init();
    }


    if (!workerRef.current) {
        const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            if (event.data.type === 'score' && event.data.score) {
                 if (audioContextRef.current) {
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
            // This pool is now only for the monophonic melody line
            await audioContextRef.current.audioWorklet.addModule('/worklets/synth-processor.js');
            const numVoices = isMobile() ? 4 : 8;
            for(let i = 0; i < numVoices; i++) {
                const node = new AudioWorkletNode(audioContextRef.current, 'synth-processor');
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

  const scheduleScore = (score: Score, audioContext: AudioContext) => {
    const now = audioContext.currentTime;
    const currentSettings = settingsRef.current;
    
    // --- Bass Scheduling (Polyphonic Worklet) ---
    const bassScore = score.bass || [];
    if (bassScore.length > 0 && bassManagerRef.current && currentSettings?.instrumentSettings.bass.name !== 'none') {
        bassManagerRef.current.schedule(bassScore, now);
    }
    
    // --- Melody Scheduling (Monophonic Pool) ---
    const melodyScore = score.melody || [];
    if (melodyScore.length > 0) {
        const instrumentName = currentSettings?.instrumentSettings.melody.name;
        const gainNode = gainNodesRef.current.melody;
        
        if (instrumentName !== 'none' && gainNode) {
            melodyScore.forEach(note => {
                const voice = synthPoolRef.current[nextVoiceRef.current % synthPoolRef.current.length];
                nextVoiceRef.current++;

                if (voice) {
                    const params = getPresetParams(instrumentName as MelodyInstrument, note);
                    if (!params) return;

                    voice.disconnect();
                    voice.connect(gainNode);

                    const noteOnTime = now + note.time;
                    voice.port.postMessage({ ...params, when: noteOnTime });

                    const noteOffTime = noteOnTime + note.duration;
                    const delayUntilOff = (noteOffTime - audioContext.currentTime);
                    
                    setTimeout(() => {
                        voice.port.postMessage({ type: 'noteOff', release: params.release });
                    }, delayUntilOff > 0 ? delayUntilOff * 1000 : 0);
                }
            });
        }
    }
    
    // --- Accompaniment Scheduling (Polyphonic Worklet) ---
    const accompanimentScore = score.accompaniment || [];
    if (accompanimentScore.length > 0 && accompanimentManagerRef.current && currentSettings?.instrumentSettings.accompaniment.name !== 'none') {
        accompanimentManagerRef.current.schedule(accompanimentScore, now);
    }

    // --- Drum Scheduling ---
    const drumScore = score.drums || [];
    if (drumScore.length > 0 && drumMachineRef.current) {
        if (currentSettings?.drumSettings.enabled) {
            drumMachineRef.current.schedule(drumScore, now);
        }
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
    if (!playing) {
        accompanimentManagerRef.current?.stop();
        bassManagerRef.current?.stop();
    }

  }, [isInitialized]);

  const updateSettingsCallback = useCallback((settings: Partial<WorkerSettings>) => {
     if (!isInitialized || !workerRef.current) return;
     const newSettings = { ...settingsRef.current, ...settings } as WorkerSettings;
     settingsRef.current = newSettings;
     workerRef.current.postMessage({ command: 'update_settings', data: newSettings });
  }, [isInitialized]);

  const setVolumeCallback = useCallback((part: InstrumentPart, volume: number) => {
    const gainNode = gainNodesRef.current[part];
    if (gainNode) {
        const balancedVolume = volume * (VOICE_BALANCE[part as keyof typeof VOICE_BALANCE] ?? 1);
        gainNode.gain.setTargetAtTime(balancedVolume, audioContextRef.current?.currentTime ?? 0, 0.01);
    }
  }, []);

  const setInstrumentCallback = useCallback((part: 'bass' | 'melody' | 'accompaniment', name: BassInstrument | MelodyInstrument | AccompanimentInstrument) => {
    if (part === 'accompaniment' && accompanimentManagerRef.current) {
        accompanimentManagerRef.current.setPreset(name as MelodyInstrument);
    }
    if (part === 'bass' && bassManagerRef.current) {
        bassManagerRef.current.setPreset(name as BassInstrument);
    }
    
    if (settingsRef.current) {
      const newSettings = {
        ...settingsRef.current,
        instrumentSettings: {
          ...settingsRef.current.instrumentSettings,
          [part]: {
            ...settingsRef.current.instrumentSettings[part],
            name,
          }
        }
      };
      updateSettingsCallback(newSettings);
    }
  }, [updateSettingsCallback]);

  useEffect(() => {
    return () => {
        workerRef.current?.terminate();
        accompanimentManagerRef.current?.dispose();
        bassManagerRef.current?.dispose();
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
        setInstrument: setInstrumentCallback,
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
};


'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, Score, Note, DrumsScore, EffectsScore, BassInstrument, InstrumentPart, MelodyInstrument } from '@/types/music';
import { DrumMachine } from '@/lib/drum-machine';

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
  melody: 0.5, // Higher frequencies are perceived as louder
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
        const parts: InstrumentPart[] = ['bass', 'melody', 'effects', 'drums'];
        parts.forEach(part => {
            const gainNode = context.createGain();
            gainNode.connect(context.destination);
            gainNodesRef.current[part] = gainNode;
        });
    }

    if (!drumMachineRef.current && audioContextRef.current) {
        console.log('[AudioEngine] Creating DrumMachine');
        // The drum machine now gets its dedicated GainNode from the pre-created map
        const drumGainNode = gainNodesRef.current.drums;
        if (!drumGainNode) {
            console.error("[AudioEngine] Drum gain node not found during initialization.");
            setIsInitializing(false);
            return false;
        }
        drumMachineRef.current = new DrumMachine(audioContextRef.current, drumGainNode);
        await drumMachineRef.current.init();
        console.log('[AudioEngine] DrumMachine created');
    }


    if (!workerRef.current) {
        const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
            if (event.data.type === 'score' && event.data.score) {
                 if (audioContextRef.current && (synthPoolRef.current.length > 0 || drumMachineRef.current)) {
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
            await audioContextRef.current.audioWorklet.addModule('/worklets/synth-processor.js');
            const numVoices = isMobile() ? 6 : 8;
            console.log(`[AudioEngine] Creating synth pool with ${numVoices} voices`);
            
            for(let i = 0; i < numVoices; i++) {
                const node = new AudioWorkletNode(audioContextRef.current, 'synth-processor');
                // Don't connect here, connect on demand
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

  const getPresetParams = (instrumentName: BassInstrument | MelodyInstrument, note: Note) => {
    let freq = 0;
    try {
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
                release: isMobile() ? 2.0 : 4.0,
                portamento: 0.05,
                filterCutoff: 1000,
                oscType: 'triangle'
            };
        case 'synth':
             return {
                type: 'noteOn',
                frequency: freq,
                velocity: note.velocity || 0.7,
                attack: 0.05,
                release: 1.5,
                portamento: 0,
                filterCutoff: 2500,
                q: 1.2,
                oscType: 'sawtooth'
            };
        case 'melody_synth':
             return {
                type: 'noteOn',
                frequency: freq,
                velocity: note.velocity || 0.7,
                attack: 0.02,
                release: 0.8,
                portamento: 0,
                filterCutoff: 4000,
                q: 1.0,
                oscType: 'fatsine' // A slightly richer sine wave
            };
        default: // 'none' or other cases
             return null;
    }
  }


  const scheduleScore = (score: Score, audioContext: AudioContext) => {
    const now = audioContext.currentTime;
    const currentSettings = settingsRef.current;
    
    const parts: { partName: 'bass' | 'melody', notes: Note[] }[] = [
        { partName: 'bass', notes: score.bass || [] },
        { partName: 'melody', notes: score.melody || [] },
    ];
    
    parts.forEach(({ partName, notes }) => {
        if (!currentSettings) return;

        const instrumentName = currentSettings.instrumentSettings[partName].name;
        const gainNode = gainNodesRef.current[partName];
        
        if (instrumentName === 'none' || !gainNode) return;

        notes.forEach(note => {
            const voice = synthPoolRef.current[nextVoiceRef.current % synthPoolRef.current.length];
            nextVoiceRef.current++;

            if (voice) {
                 const finalInstrument = partName === 'melody' ? 'melody_synth' : instrumentName;
                 const params = getPresetParams(finalInstrument as MelodyInstrument, note);
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
    });
    
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
        // Apply balancing coefficient
        const balancedVolume = volume * (VOICE_BALANCE[part as keyof typeof VOICE_BALANCE] ?? 1);
        gainNode.gain.value = balancedVolume;
        console.log(`[AudioEngine] Volume change`, { part, raw: volume, balanced: balancedVolume });
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


'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useToast } from "@/hooks/use-toast";
import type { WorkerSettings, Score, Note, DrumsScore, InstrumentPart, BassInstrument, MelodyInstrument, AccompanimentInstrument, BassTechnique, TextureSettings } from '@/types/music';
import { DrumMachine } from '@/lib/drum-machine';
import { AccompanimentSynthManager } from '@/lib/accompaniment-synth-manager';
import { BassSynthManager } from '@/lib/bass-synth-manager';
import { SparklePlayer } from '@/lib/sparkle-player';
import { PadPlayer } from '@/lib/pad-player';
import { getPresetParams } from '@/lib/presets';

// --- Type Definitions ---
type WorkerMessage = {
    type: 'score' | 'error' | 'debug' | 'sparkle' | 'pad';
    score?: Score;
    error?: string;
    message?: string;
    data?: any;
    padName?: string;
    time?: number;
};

// --- Constants ---
const VOICE_BALANCE = {
  bass: 1.0,
  melody: 0.5,
  accompaniment: 0.6,
  drums: 0.8,
  effects: 0.6,
  sparkles: 0.7,
  pads: 0.9,
};

const EQ_FREQUENCIES = [60, 125, 250, 500, 1000, 2000, 4000];


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
  setBassTechnique: (technique: BassTechnique) => void;
  setTextureSettings: (settings: TextureSettings) => void;
  setEQGain: (bandIndex: number, gain: number) => void;
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
  const sparklePlayerRef = useRef<SparklePlayer | null>(null);
  const padPlayerRef = useRef<PadPlayer | null>(null);

  const gainNodesRef = useRef<Record<InstrumentPart, GainNode | null>>({
    bass: null,
    melody: null,
    accompaniment: null,
    drums: null,
    effects: null,
    sparkles: null,
    pads: null,
  });

  const eqNodesRef = useRef<BiquadFilterNode[]>([]);
  
  const { toast } = useToast();
  
  const initialize = useCallback(async () => {
    if (isInitialized || isInitializing) return true;
    
    setIsInitializing(true);
    
    try {
        if (!audioContextRef.current) {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
                 sampleRate: isMobile() ? 44100 : 44100,
            });
        }

        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }

        // --- EQ Chain Setup ---
        if (eqNodesRef.current.length === 0) {
            const context = audioContextRef.current;
            const eqChain: BiquadFilterNode[] = EQ_FREQUENCIES.map((freq, i) => {
                const filter = context.createBiquadFilter();
                if (i === 0) filter.type = 'lowshelf';
                else if (i === EQ_FREQUENCIES.length - 1) filter.type = 'highshelf';
                else filter.type = 'peaking';
                filter.frequency.value = freq;
                filter.Q.value = 1.0;
                filter.gain.value = 0;
                return filter;
            });

            for (let i = 0; i < eqChain.length - 1; i++) {
                eqChain[i].connect(eqChain[i + 1]);
            }
            eqChain[eqChain.length - 1].connect(context.destination);
            eqNodesRef.current = eqChain;
        }

        const eqInput = eqNodesRef.current[0];

        if (!gainNodesRef.current.bass) {
            const context = audioContextRef.current;
            const parts: InstrumentPart[] = ['bass', 'melody', 'accompaniment', 'effects', 'drums', 'sparkles', 'pads'];
            parts.forEach(part => {
                if (!gainNodesRef.current[part]) {
                    const gainNode = context.createGain();
                    gainNode.connect(eqInput); // Connect to EQ chain instead of destination
                    gainNodesRef.current[part] = gainNode;
                }
            });
        }

        if (!drumMachineRef.current) {
            drumMachineRef.current = new DrumMachine(audioContextRef.current, gainNodesRef.current.drums!);
            await drumMachineRef.current.init();
        }
        
        if (!accompanimentManagerRef.current) {
            accompanimentManagerRef.current = new AccompanimentSynthManager(audioContextRef.current, gainNodesRef.current.accompaniment!);
            await accompanimentManagerRef.current.init();
        }
        
        if (!bassManagerRef.current) {
            bassManagerRef.current = new BassSynthManager(audioContextRef.current, gainNodesRef.current.bass!);
            await bassManagerRef.current.init();
        }

        if (!sparklePlayerRef.current) {
            sparklePlayerRef.current = new SparklePlayer(audioContextRef.current, gainNodesRef.current.sparkles!);
            await sparklePlayerRef.current.init();
        }
        
        if (!padPlayerRef.current) {
            padPlayerRef.current = new PadPlayer(audioContextRef.current, gainNodesRef.current.pads!);
            await padPlayerRef.current.init();
        }

        if (!workerRef.current) {
            const worker = new Worker(new URL('../lib/ambient.worker.ts', import.meta.url), { type: 'module' });
            worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
                console.log('[AudioEngine] Received message from worker:', event.data);
                const now = audioContextRef.current?.currentTime ?? 0;
                const scheduleTime = event.data.time ? now + event.data.time : now;

                if (event.data.type === 'score' && event.data.score) {
                    if (audioContextRef.current) {
                        scheduleScore(event.data.score, audioContextRef.current);
                    }
                } else if (event.data.type === 'sparkle') {
                     sparklePlayerRef.current?.playRandomSparkle(scheduleTime);
                } else if (event.data.type === 'pad' && event.data.padName) {
                     padPlayerRef.current?.setPad(event.data.padName, scheduleTime);
                } else if (event.data.type === 'error') {
                    toast({ variant: "destructive", title: "Worker Error", description: event.data.error });
                } else if (event.data.type === 'debug') {
                    // console.log(`[Worker DBG] ${event.data.message}`, event.data.data);
                }
            };
            workerRef.current = worker;
        }
        
        if(synthPoolRef.current.length === 0) {
            await audioContextRef.current.audioWorklet.addModule('/worklets/synth-processor.js');
            const numVoices = isMobile() ? 4 : 8;
            for(let i = 0; i < numVoices; i++) {
                const node = new AudioWorkletNode(audioContextRef.current, 'synth-processor');
                synthPoolRef.current.push(node);
            }
        }
        
        setIsInitialized(true);
        setIsInitializing(false);
        return true;

    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        toast({ variant: "destructive", title: "Audio Initialization Error", description: `Could not start audio: ${errorMessage}`});
        console.error(e);
        setIsInitializing(false);
        return false;
    }
  }, [isInitialized, isInitializing, toast]);

  const scheduleScore = (score: Score, audioContext: AudioContext) => {
    console.log('[AudioEngine] Scheduling score:', score);
    const now = audioContext.currentTime;
    const currentSettings = settingsRef.current;
    
    const bassScore = score.bass || [];
    if (bassScore.length > 0 && bassManagerRef.current && currentSettings?.instrumentSettings.bass.name !== 'none') {
        bassManagerRef.current.schedule(bassScore, now);
    }
    
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
    
    const accompanimentScore = score.accompaniment || [];
    if (accompanimentScore.length > 0 && accompanimentManagerRef.current && currentSettings?.instrumentSettings.accompaniment.name !== 'none') {
        accompanimentManagerRef.current.schedule(accompanimentScore, now);
    }

    const drumScore = score.drums || [];
    if (drumScore.length > 0 && drumMachineRef.current) {
        if (currentSettings?.drumSettings.enabled) {
            drumMachineRef.current.schedule(drumScore, now);
        }
    }
  };

  const stopAllSounds = useCallback(() => {
    accompanimentManagerRef.current?.allNotesOff();
    bassManagerRef.current?.allNotesOff();
    padPlayerRef.current?.stop();
  }, []);


  const setIsPlayingCallback = useCallback(async (playing: boolean) => {
    if (!isInitialized || !workerRef.current || !audioContextRef.current) return;
    
    if (playing) {
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        workerRef.current.postMessage({ command: 'start' });
        setIsPlaying(true);
    } else {
        stopAllSounds();
        workerRef.current.postMessage({ command: 'stop' });
        setIsPlaying(false);
    }

  }, [isInitialized, stopAllSounds]);

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

  const setBassTechniqueCallback = useCallback((technique: BassTechnique) => {
    if (bassManagerRef.current) {
      bassManagerRef.current.setTechnique(technique);
    }
     if (settingsRef.current) {
      const newSettings = {
        ...settingsRef.current,
        instrumentSettings: {
          ...settingsRef.current.instrumentSettings,
          bass: {
            ...settingsRef.current.instrumentSettings.bass,
            technique,
          }
        }
      };
      updateSettingsCallback(newSettings);
    }
  }, [updateSettingsCallback]);

  const setTextureSettingsCallback = useCallback((settings: TextureSettings) => {
    if (sparklePlayerRef.current) {
        sparklePlayerRef.current.setVolume(settings.sparkles.volume);
    }
    if (padPlayerRef.current) {
        padPlayerRef.current.setVolume(settings.pads.volume);
    }
    
    if (settingsRef.current) {
        const newSettings = {
            ...settingsRef.current,
            textureSettings: {
                sparkles: { enabled: settings.sparkles.enabled },
                pads: { enabled: settings.pads.enabled },
            }
        };
        updateSettingsCallback(newSettings);
    }
  }, [updateSettingsCallback]);

  const setEQGainCallback = useCallback((bandIndex: number, gain: number) => {
      const filterNode = eqNodesRef.current[bandIndex];
      if (filterNode && audioContextRef.current) {
          filterNode.gain.setTargetAtTime(gain, audioContextRef.current.currentTime, 0.01);
      }
  }, []);

  useEffect(() => {
    return () => {
        workerRef.current?.terminate();
        accompanimentManagerRef.current?.dispose();
        bassManagerRef.current?.dispose();
        padPlayerRef.current?.dispose();
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
        setBassTechnique: setBassTechniqueCallback,
        setTextureSettings: setTextureSettingsCallback,
        setEQGain: setEQGainCallback,
    }}>
      {children}
    </AudioEngineContext.Provider>
  );
};

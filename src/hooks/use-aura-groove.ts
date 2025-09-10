
'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DrumSettings, InstrumentSettings, ScoreName, WorkerSettings, BassInstrument, InstrumentPart, MelodyInstrument, AccompanimentInstrument, BassTechnique, TextureSettings, TimerSettings } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";

const FADE_OUT_DURATION = 120; // 2 minutes

/**
 * Облегченная версия хука для стартового экрана.
 * Не содержит логики управления музыкой, только инициализация и состояния.
 */
export const useAuraGrooveLite = () => {
  const { isInitialized, isInitializing, initialize } = useAudioEngine();
  const [loadingText, setLoadingText] = useState('Click to initialize audio');
  const router = useRouter();

  const handleStart = useCallback(async () => {
    if (isInitialized) {
      router.push('/aura-groove');
      return;
    }
    if (isInitializing) return;

    setLoadingText('Initializing Audio Engine...');
    const success = await initialize();
    if (success) {
      router.push('/aura-groove');
    } else {
      setLoadingText('Failed to initialize. Please try again.');
    }
  }, [isInitialized, isInitializing, initialize, router]);

  const buttonText = isInitializing ? 'Initializing...' : (isInitialized ? 'Enter' : 'Start AuraGroove');
  
  const infoText = isInitializing 
    ? 'Please wait, the audio engine is initializing...' 
    : (isInitialized 
        ? 'Audio engine is ready.' 
        : 'Click the button below to initialize the audio engine.');

  return {
    isInitializing,
    isInitialized,
    handleStart,
    buttonText,
    infoText
  };
};


/**
 * Полная версия хука для основного UI управления музыкой.
 */
export const useAuraGroove = () => {
  const { 
    isInitialized,
    isInitializing,
    isPlaying, 
    initialize, 
    setIsPlaying: setEngineIsPlaying, 
    updateSettings, 
    setVolume, 
    setInstrument, 
    setBassTechnique,
    setTextureSettings: setEngineTextureSettings,
    setEQGain,
    startMasterFadeOut,
    cancelMasterFadeOut,
  } = useAudioEngine();
  
  const router = useRouter();
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'composer', volume: 0.5 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    bass: { name: "glideBass", volume: 0.7, technique: 'arpeggio' },
    melody: { name: "synth", volume: 0.6 },
    accompaniment: { name: "synth", volume: 0.5 },
  });
  const [textureSettings, setTextureSettings] = useState<TextureSettings>({
      sparkles: { enabled: true, volume: 0.35 },
      pads: { enabled: true, volume: 0.4 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('multeity');
  const [density, setDensity] = useState(0.5);

  const [isEqModalOpen, setIsEqModalOpen] = useState(false);
  const [eqSettings, setEqSettings] = useState<number[]>(Array(7).fill(0));
  
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    duration: 0, // in seconds
    timeLeft: 0,
    isActive: false
  });
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);


  const getFullSettings = useCallback((): WorkerSettings => {
    return {
      bpm,
      score,
      instrumentSettings,
      drumSettings: { ...drumSettings, enabled: drumSettings.pattern !== 'none' },
      textureSettings: {
          sparkles: { enabled: textureSettings.sparkles.enabled },
          pads: { enabled: textureSettings.pads.enabled },
      },
      density,
    };
  }, [bpm, score, instrumentSettings, drumSettings, textureSettings, density]);

  // Initial settings sync
  useEffect(() => {
    if (isInitialized) {
        updateSettings(getFullSettings());
        
        Object.entries(instrumentSettings).forEach(([part, settings]) => {
            setVolume(part as InstrumentPart, settings.volume);
        });
        setVolume('drums', drumSettings.volume);
        setEngineTextureSettings(textureSettings);
        
        setInstrument('bass', instrumentSettings.bass.name);
        setInstrument('melody', instrumentSettings.melody.name);
        setInstrument('accompaniment', instrumentSettings.accompaniment.name);
        
        setBassTechnique(instrumentSettings.bass.technique);
    }
  }, [isInitialized]);

  // Sync settings with engine whenever they change
  useEffect(() => {
      if (isInitialized) {
          const fullSettings = getFullSettings();
          updateSettings(fullSettings);
      }
  }, [bpm, score, density, drumSettings, instrumentSettings, textureSettings, isInitialized, updateSettings, getFullSettings]);

  // Timer logic
  useEffect(() => {
    if (timerSettings.isActive && timerSettings.timeLeft > 0) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSettings(prev => {
          const newTimeLeft = prev.timeLeft - 1;
          if (newTimeLeft === FADE_OUT_DURATION) {
            startMasterFadeOut(FADE_OUT_DURATION);
          }
          if (newTimeLeft <= 0) {
            clearInterval(timerIntervalRef.current!);
            setEngineIsPlaying(false);
            return { ...prev, timeLeft: 0, isActive: false };
          }
          return { ...prev, timeLeft: newTimeLeft };
        });
      }, 1000);
    } else if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
    }
    
    return () => {
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
    };
  }, [timerSettings.isActive, timerSettings.timeLeft, setEngineIsPlaying, startMasterFadeOut]);
  
  const handleTogglePlay = useCallback(async () => {
    if (!isInitialized) {
      await initialize();
    }
    setEngineIsPlaying(!isPlaying);
  }, [isInitialized, isPlaying, initialize, setEngineIsPlaying]);

  const handleInstrumentChange = (part: keyof InstrumentSettings, name: BassInstrument | MelodyInstrument | AccompanimentInstrument) => {
    setInstrumentSettings(prev => ({
      ...prev,
      [part]: { ...prev[part], name }
    }));
    setInstrument(part as 'bass' | 'melody' | 'accompaniment', name);
  };
  
  const handleBassTechniqueChange = (technique: BassTechnique) => {
      setInstrumentSettings(prev => ({
        ...prev,
        bass: { ...prev.bass, technique }
      }));
      setBassTechnique(technique);
  };

  const handleVolumeChange = (part: InstrumentPart, value: number) => {
    if (part === 'bass' || part === 'melody' || part === 'accompaniment') {
      setInstrumentSettings(prev => ({ ...prev, [part]: { ...prev[part], volume: value }}));
    } else if (part === 'drums') {
        setDrumSettings(prev => ({ ...prev, volume: value }));
    } else if (part === 'sparkles' || part === 'pads') {
        setTextureSettings(prev => ({ ...prev, [part]: { ...prev[part], volume: value }}));
    }
    setVolume(part, value);
  };

  const handleTextureEnabledChange = (part: 'sparkles' | 'pads', enabled: boolean) => {
      setTextureSettings(prev => {
          const newSettings = { ...prev, [part]: { ...prev[part], enabled }};
          setEngineTextureSettings(newSettings);
          return newSettings;
      });
  };

  const handleDrumSettingsChange = (settings: React.SetStateAction<DrumSettings>) => {
    const newSettings = typeof settings === 'function' ? settings(drumSettings) : settings;
    setDrumSettings(newSettings);
    setVolume('drums', newSettings.volume);
  };

  const handleEqChange = (bandIndex: number, gain: number) => {
      setEqSettings(prev => {
          const newSettings = [...prev];
          newSettings[bandIndex] = gain;
          setEQGain(bandIndex, gain);
          return newSettings;
      });
  };

  const handleTimerDurationChange = (minutes: number) => {
      setTimerSettings(prev => ({...prev, duration: minutes * 60, timeLeft: minutes * 60 }));
  };

  const handleToggleTimer = () => {
    setTimerSettings(prev => {
        const newIsActive = !prev.isActive;
        if (newIsActive) {
            return { ...prev, timeLeft: prev.duration, isActive: true };
        } else { // Stopping timer
            cancelMasterFadeOut();
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            return { ...prev, timeLeft: prev.duration, isActive: false };
        }
    });
  };


  const handleExit = () => {
    setEngineIsPlaying(false);
    window.location.href = '/';
  };

  const handleGoHome = () => {
    handleExit();
  };


  return {
    isInitializing,
    isPlaying,
    loadingText: isInitializing ? 'Initializing...' : (isInitialized ? 'Ready' : 'Click to initialize audio'),
    handleTogglePlay,
    drumSettings,
    setDrumSettings: handleDrumSettingsChange,
    instrumentSettings,
    setInstrumentSettings: handleInstrumentChange,
    handleBassTechniqueChange,
    handleVolumeChange,
    textureSettings,
    handleTextureEnabledChange,
    bpm,
    handleBpmChange: setBpm,
    score,
    handleScoreChange: setScore,
    density,
    setDensity,
    handleGoHome,
    handleExit,
    isEqModalOpen,
    setIsEqModalOpen,
    eqSettings,
    handleEqChange,
    timerSettings,
    handleTimerDurationChange,
    handleToggleTimer,
  };
};

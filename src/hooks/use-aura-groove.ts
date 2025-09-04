
'use client';

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { DrumSettings, InstrumentSettings, ScoreName, WorkerSettings, BassInstrument, InstrumentPart, MelodyInstrument, AccompanimentInstrument, BassTechnique } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";

export const useAuraGroove = () => {
  const { isInitialized, isPlaying, initialize, setIsPlaying: setEngineIsPlaying, updateSettings, setVolume, setInstrument, setBassTechnique } = useAudioEngine();
  const router = useRouter();
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'composer', volume: 0.5 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    bass: { name: "glideBass", volume: 0.7, technique: 'arpeggio' },
    melody: { name: "synth", volume: 0.6 },
    accompaniment: { name: "synth", volume: 0.5 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('dreamtales');
  const [density, setDensity] = useState(0.5);

  const getFullSettings = useCallback((): WorkerSettings => {
    return {
      bpm,
      score,
      instrumentSettings,
      drumSettings: { ...drumSettings, enabled: drumSettings.pattern !== 'none' },
      density,
    };
  }, [bpm, score, instrumentSettings, drumSettings, density]);

  // Initial settings sync
  useEffect(() => {
    if (isInitialized) {
        updateSettings(getFullSettings());
        
        // Set initial volumes
        Object.entries(instrumentSettings).forEach(([part, settings]) => {
            setVolume(part as InstrumentPart, settings.volume);
        });
        setVolume('drums', drumSettings.volume);
        
        // Set initial instruments
        setInstrument('bass', instrumentSettings.bass.name);
        setInstrument('melody', instrumentSettings.melody.name);
        setInstrument('accompaniment', instrumentSettings.accompaniment.name);
        
        // Set initial bass technique
        setBassTechnique(instrumentSettings.bass.technique);
    }
  }, [isInitialized]);

  // Sync settings with engine whenever they change
  useEffect(() => {
      if (isInitialized) {
          updateSettings(getFullSettings());
      }
  }, [bpm, score, density, drumSettings, instrumentSettings, isInitialized, updateSettings, getFullSettings]);

  
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
      setInstrumentSettings(prev => ({
        ...prev,
        [part]: { ...prev[part], volume: value }
      }));
    } else if (part === 'drums') {
        setDrumSettings(prev => ({ ...prev, volume: value }));
    }
    setVolume(part, value);
  };

  const handleDrumSettingsChange = (settings: React.SetStateAction<DrumSettings>) => {
    const newSettings = typeof settings === 'function' ? settings(drumSettings) : settings;
    setDrumSettings(newSettings);
    setVolume('drums', newSettings.volume);
  };

  const handleExit = () => {
    setEngineIsPlaying(false);
    // Directly setting the href is the most reliable way to navigate and force a full page reload.
    window.location.href = '/';
  };

  const handleGoHome = () => {
    handleExit();
  };


  return {
    isInitializing: !isInitialized,
    isPlaying,
    loadingText: !isInitialized ? 'Click to initialize audio' : 'Ready',
    handleTogglePlay,
    drumSettings,
    setDrumSettings: handleDrumSettingsChange,
    instrumentSettings,
    setInstrumentSettings: handleInstrumentChange,
    handleBassTechniqueChange,
    handleVolumeChange,
    effectsSettings: { enabled: false }, // Placeholder
    handleToggleEffects: () => {}, // Placeholder
    bpm,
    handleBpmChange: setBpm,
    score,
    handleScoreChange: setScore,
    density,
    setDensity,
    handleGoHome,
    handleExit,
  };
};

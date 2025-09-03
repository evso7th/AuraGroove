
'use client';

import { useState, useEffect, useCallback } from "react";
import type { DrumSettings, InstrumentSettings, ScoreName, WorkerSettings, BassInstrument, InstrumentPart } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";

export const useAuraGroove = () => {
  const { isInitialized, isPlaying, initialize, setIsPlaying: setEngineIsPlaying, updateSettings, setVolume } = useAudioEngine();
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'none', volume: 0.5 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    bass: { name: "portamento", volume: 0.7 },
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
        console.log('[UI] Initializing settings for worker');
        updateSettings(getFullSettings());
    }
  }, [isInitialized]);

  // Sync settings with engine whenever they change
  useEffect(() => {
      if (isInitialized) {
          updateSettings(getFullSettings());
      }
  }, [bpm, score, density, drumSettings, instrumentSettings, isInitialized, updateSettings, getFullSettings]);

  
  const handleTogglePlay = useCallback(async () => {
    console.log('[UI] Play button pressed', { currentIsPlaying: isPlaying });
    if (!isInitialized) {
      await initialize();
    }
    setEngineIsPlaying(!isPlaying);
  }, [isInitialized, isPlaying, initialize, setEngineIsPlaying]);

  const handleInstrumentChange = (part: keyof InstrumentSettings, name: BassInstrument) => {
    setInstrumentSettings(prev => ({
      ...prev,
      [part]: { ...prev[part], name }
    }));
  };

  const handleVolumeChange = (part: InstrumentPart, value: number) => {
    console.log(`[UI] Volume slider changed`, { part, volume: value });
    if (part === 'bass') {
      setInstrumentSettings(prev => ({
        ...prev,
        bass: { ...prev.bass, volume: value }
      }));
    }
    setVolume(part, value);
  };


  return {
    isInitializing: !isInitialized, // Simplified loading state
    isPlaying,
    loadingText: !isInitialized ? 'Click to initialize audio' : 'Ready',
    handleTogglePlay,
    drumSettings,
    setDrumSettings,
    instrumentSettings,
    setInstrumentSettings: handleInstrumentChange,
    handleVolumeChange,
    effectsSettings: { enabled: false }, // Placeholder
    handleToggleEffects: () => {}, // Placeholder
    bpm,
    handleBpmChange: setBpm,
    score,
    handleScoreChange: setScore,
    density,
    setDensity,
  };
};

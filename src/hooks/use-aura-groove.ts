
'use client';

import { useState, useEffect, useCallback } from "react";
import type { DrumSettings, InstrumentSettings, ScoreName, WorkerSettings } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";

export const useAuraGroove = () => {
  const { isInitialized, isPlaying, initialize, setIsPlaying: setEngineIsPlaying, updateSettings } = useAudioEngine();
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'none', volume: 0.5 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    bass: { name: "portamento", volume: 0.45 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('evolve');

  const getFullSettings = useCallback((): WorkerSettings => {
    return {
      bpm,
      score,
      instrumentSettings,
      drumSettings: { ...drumSettings, enabled: drumSettings.pattern !== 'none' }
    };
  }, [bpm, score, instrumentSettings, drumSettings]);

  // Update settings in the worker
  useEffect(() => {
    if (isInitialized) {
        updateSettings(getFullSettings());
    }
  }, [bpm, drumSettings, instrumentSettings, score, isInitialized, updateSettings, getFullSettings]);
  
  const handleTogglePlay = useCallback(async () => {
    if (!isInitialized) {
      await initialize();
    }
    setEngineIsPlaying(!isPlaying);
  }, [isInitialized, isPlaying, initialize, setEngineIsPlaying]);

  return {
    isInitializing: !isInitialized, // Simplified loading state
    isPlaying,
    loadingText: !isInitialized ? 'Click to initialize audio' : 'Ready',
    handleTogglePlay,
    drumSettings,
    setDrumSettings,
    instrumentSettings,
    setInstrumentSettings,
    effectsSettings: { enabled: false }, // Placeholder
    handleToggleEffects: () => {}, // Placeholder
    bpm,
    handleBpmChange: setBpm,
    score,
    handleScoreChange: setScore,
  };
};

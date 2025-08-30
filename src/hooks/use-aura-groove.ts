
'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import type { DrumSettings, InstrumentSettings, ScoreName, WorkerSettings } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";

export const useAuraGroove = () => {
  const { isInitializing, isInitialized, engine, loadingText: engineLoadingText } = useAudioEngine();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'ambient_beat', volume: 0.7 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    solo: { name: "none", volume: 0.8 },
    accompaniment: { name: "synthesizer", volume: 0.7 },
    bass: { name: "bass_synth", volume: 0.9 },
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

  // Update instrument presets in managers when they change
  useEffect(() => {
      if (engine && isInitialized) {
          engine.accompanimentManager.setInstrument(instrumentSettings.accompaniment.name);
          // Add calls for other managers here when they support setInstrument
          // engine.soloManager.setInstrument(instrumentSettings.solo.name);
          // engine.bassManager.setInstrument(instrumentSettings.bass.name);
      }
  }, [instrumentSettings.accompaniment.name, instrumentSettings.solo.name, instrumentSettings.bass.name, engine, isInitialized]);


  // Update settings in the worker in realtime
  useEffect(() => {
    if (engine && isInitialized) {
        console.log("[useAuraGroove] Syncing settings with worker");
        engine.updateSettings(getFullSettings());
    }
  }, [bpm, drumSettings, instrumentSettings, score, engine, isInitialized, getFullSettings]);

  const handleTogglePlay = useCallback(async () => {
    if (!isInitialized || !engine) return;
    
    const newIsPlaying = !isPlaying;
    engine.setIsPlaying(newIsPlaying);
    setIsPlaying(newIsPlaying);
    
  }, [isInitialized, engine, isPlaying]);

  const isLoading = isInitializing || !isInitialized;

  return {
    isInitializing: isLoading,
    isPlaying,
    loadingText: isLoading ? engineLoadingText : 'Ready',
    handleTogglePlay,
    drumSettings,
    setDrumSettings,
    instrumentSettings,
    setInstrumentSettings,
    bpm,
    handleBpmChange: setBpm,
    score,
    handleScoreChange: (newScore: ScoreName) => {
      setScore(newScore);
    },
  };
};

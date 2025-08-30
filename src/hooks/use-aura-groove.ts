
'use client';

import { useState, useEffect, useCallback } from "react";
import type { DrumSettings, InstrumentSettings, ScoreName, WorkerSettings } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";

export const useAuraGroove = () => {
  const { isInitializing, isInitialized, engine, loadingText: engineLoadingText } = useAudioEngine();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'ambient_beat', volume: 0.7 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    solo: { name: "none", volume: 0.8 },
    accompaniment: { name: "synthesizer", volume: 0.7 },
    bass: { name: "none", volume: 0.9 },
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

  const handleTogglePlay = useCallback(async () => {
    if (!isInitialized || !engine) return;
    
    const newIsPlaying = !isPlaying;
    setIsPlaying(newIsPlaying);
    
    if (newIsPlaying) {
        // Pass all current settings to the engine when starting
        engine.updateSettings(getFullSettings());
        engine.setIsPlaying(true);
    } else {
        engine.setIsPlaying(false);
    }
  }, [isInitialized, engine, isPlaying, getFullSettings]);

  // Update settings in the worker in realtime
  useEffect(() => {
    if (engine) {
        engine.updateSettings({ bpm, drumSettings, instrumentSettings });
    }
  }, [bpm, drumSettings, instrumentSettings, engine]);


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
      if (isPlaying) {
        alert("Please stop the music before changing the style.");
        return;
      }
      setScore(newScore);
      if(engine) {
        engine.updateSettings({ score: newScore });
      }
    },
  };
};

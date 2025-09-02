
'use client';

import { useState, useEffect, useCallback } from "react";
import type { DrumSettings, InstrumentSettings, ScoreName, WorkerSettings, EffectsSettings, MelodyInstrument, MelodyTechnique, BassInstrument } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";

export const useAuraGroove = () => {
  const { isInitializing, isInitialized, engine, loadingText: engineLoadingText } = useAudioEngine();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'none', volume: 0.5 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    bass: { name: "none", volume: 0.45 },
    melody: { name: "none", volume: 0.45, technique: 'arpeggio' },
  });
  const [effectsSettings, setEffectsSettings] = useState<EffectsSettings>({ enabled: false });
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


  // Update settings in the worker/frames in realtime
  useEffect(() => {
    if (engine && isInitialized) {
        engine.updateSettings(getFullSettings());
    }
  }, [bpm, drumSettings, instrumentSettings, score, engine, isInitialized, getFullSettings]);
  
  const handleToggleEffects = useCallback(() => {
    // This will be re-implemented when the melody frame is added
    console.log("Effects toggled");
  }, []);

  const handleTogglePlay = useCallback(async () => {
    if (!isInitialized || !engine) return;
    
    const newIsPlaying = !isPlaying;
    engine.setIsPlaying(newIsPlaying);
    setIsPlaying(newIsPlaying);
    
  }, [isInitialized, engine, isPlaying]);

  const isLoading = isInitializing;

  return {
    isInitializing: isLoading,
    isPlaying,
    loadingText: isLoading ? engineLoadingText : 'Ready',
    handleTogglePlay,
    drumSettings,
    setDrumSettings,
    instrumentSettings,
    setInstrumentSettings,
    effectsSettings,
    handleToggleEffects,
    bpm,
    handleBpmChange: setBpm,
    score,
    handleScoreChange: (newScore: ScoreName) => {
      setScore(newScore);
    },
  };
};

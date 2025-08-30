
'use client';

import { useState, useEffect, useCallback } from "react";
import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";

export const useAuraGroove = () => {
  const { isInitialized, isInitializing, engine } = useAudioEngine();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'none', volume: 0.7 });
  const [effectsSettings, setEffectsSettings] = useState<EffectsSettings>({ mode: 'none', volume: 0.7 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    solo: { name: "none", volume: 0.8 },
    accompaniment: { name: "synthesizer", volume: 0.7 },
    bass: { name: "none", volume: 0.9 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('evolve');

  useEffect(() => {
    if (engine) {
      engine.setIsPlaying(isPlaying);
    }
  }, [isPlaying, engine]);

  const handleTogglePlay = useCallback(async () => {
    if (!isInitialized || !engine) return;
    setIsPlaying(prev => !prev);
  }, [isInitialized, engine]);

  const handleBpmChange = useCallback((newBpm: number) => {
    setBpm(newBpm);
  }, []);

  const handleScoreChange = useCallback((newScore: ScoreName) => {
    setScore(newScore);
  }, []);
  
  useEffect(() => {
    if (engine && isInitialized) {
        engine.updateSettings({ instrumentSettings, drumSettings, effectsSettings, bpm, score });
    }
  }, [instrumentSettings, drumSettings, effectsSettings, bpm, score, engine, isInitialized]);

  return {
    isInitializing: !isInitialized,
    isPlaying,
    loadingText: isInitializing ? 'Audio Engine is warming up...' : '',
    handleTogglePlay,
    drumSettings,
    setDrumSettings,
    instrumentSettings,
    setInstrumentSettings,
    bpm,
    handleBpmChange,
    score,
    handleScoreChange,
  };
};

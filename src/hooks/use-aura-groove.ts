
'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import type { DrumSettings, InstrumentSettings, ScoreName } from '@/types/music';
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

  const handleTogglePlay = useCallback(async () => {
    if (!isInitialized || !engine) return;
    
    const newIsPlaying = !isPlaying;
    console.log("[PLAYER_TRACE] handleTogglePlay called. Setting isPlaying to:", newIsPlaying);
    setIsPlaying(newIsPlaying);
    
    const settings = {
        bpm,
        score,
        instrumentSettings,
        drumSettings: { ...drumSettings, enabled: drumSettings.pattern !== 'none' }
    };

    if (newIsPlaying) {
        engine.updateSettings(settings); // Update before starting
        engine.setIsPlaying(true);
    } else {
        engine.setIsPlaying(false);
    }
  }, [isInitialized, engine, isPlaying, bpm, score, instrumentSettings, drumSettings]);

  // Update BPM in realtime
  useEffect(() => {
    if (engine) {
        engine.updateSettings({ bpm });
    }
  }, [bpm, engine]);
  
  // Update settings when they change while playing
  useEffect(() => {
    if (isPlaying && engine) {
        engine.updateSettings({ drumSettings: {...drumSettings, enabled: drumSettings.pattern !== 'none'} });
    }
  }, [drumSettings, isPlaying, engine]);

  useEffect(() => {
    if (isPlaying && engine) {
        engine.updateSettings({ instrumentSettings });
    }
  }, [instrumentSettings, isPlaying, engine]);

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
      // Logic to change score, might require stopping and starting the worker
      if (isPlaying) {
        // For simplicity, we ask the user to stop first.
        alert("Please stop the music before changing the style.");
        return;
      }
      setScore(newScore);
    },
  };
};

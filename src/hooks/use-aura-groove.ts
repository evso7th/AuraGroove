

'use client';

import { useState, useEffect, useCallback, useMemo } from "react";
import type { DrumSettings, InstrumentSettings, ScoreName, WorkerSettings, AudioProfile } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";
import { useIsMobile } from "@/hooks/use-mobile";
import * as Tone from 'tone';


export const useAuraGroove = () => {
  const { isInitializing, isInitialized, engine, loadingText: engineLoadingText } = useAudioEngine();
  const [isPlaying, setIsPlaying] = useState(false);
  
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'composer', volume: 0.5 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    bass: { name: "portamento", volume: 0.45 },
    melody: { name: "synth", volume: 0.45 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('evolve');
  const isMobile = useIsMobile();
  const [audioProfile, setAudioProfile] = useState<AudioProfile>(isMobile ? 'mobile' : 'desktop');


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
          engine.bassManager.setInstrument(instrumentSettings.bass.name);
          engine.melodyManager.setInstrument(instrumentSettings.melody.name);
      }
  }, [instrumentSettings.bass.name, instrumentSettings.melody.name, engine, isInitialized]);

  // Update drum volume
  useEffect(() => {
      if(engine && isInitialized) {
          // We use gainToDb for a more natural volume curve.
          engine.drumMachine.channel.volume.value = Tone.gainToDb(drumSettings.volume);
      }
  }, [drumSettings.volume, engine, isInitialized]);


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


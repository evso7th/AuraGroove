
'use client';

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { DrumSettings, InstrumentSettings, ScoreName, WorkerSettings, BassInstrument, InstrumentPart, MelodyInstrument, AccompanimentInstrument, BassTechnique, TextureSettings, TimerSettings, EQPreset, UIPreset } from '@/types/music';
import { useAudioEngine } from "@/contexts/audio-engine-context";
import { useToast } from "./use-toast";

const FADE_OUT_DURATION = 120; // 2 minutes

const EQ_PRESETS: Record<EQPreset, number[]> = {
  'mobile': [0, 0, 0, 0, 0, 0, 0],
  'acoustic': [-8.5, -6.0, -5.0, 0, 0, 0, 0],
};

const PRESETS_STORAGE_KEY = 'auraGroovePresets-v2';

const OMEGA_SAMPLE_PRESET: UIPreset = {
  name: "Omega Sample Preset",
  score: "omega",
  bpm: 75,
  density: 0.5,
  instrumentSettings: {
    bass: { name: "hypnoticDrone", technique: "arpeggio", volume: 0.4 },
    melody: { name: "mellotron", volume: 0.6 },
    accompaniment: { name: "organ", volume: 0.5 },
  },
  drumSettings: { pattern: "composer", volume: 0.5 },
  textureSettings: {
    sparkles: { enabled: true, volume: 0.15 },
    pads: { enabled: true, volume: 0.2 },
  },
  eqSettings: Array(7).fill(0),
};


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
  const { toast } = useToast();
  
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
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [eqSettings, setEqSettings] = useState<number[]>(Array(7).fill(0));
  
  const [timerSettings, setTimerSettings] = useState<TimerSettings>({
    duration: 0, // in seconds
    timeLeft: 0,
    isActive: false
  });
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [presets, setPresets] = useState<UIPreset[]>([OMEGA_SAMPLE_PRESET]);

  const [isVisualizerOpen, setIsVisualizerOpen] = useState(false);
  const [visualizerColors, setVisualizerColors] = useState<string[]>(['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--background))']);

  // Load user presets from localStorage on mount
  useEffect(() => {
    try {
      const savedPresetsJSON = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (savedPresetsJSON) {
        const savedUserPresets = JSON.parse(savedPresetsJSON) as UIPreset[];
        // Combine default preset with user presets, ensuring no duplicates by name
        const userPresets = savedUserPresets.filter(p => p.name !== OMEGA_SAMPLE_PRESET.name);
        setPresets([OMEGA_SAMPLE_PRESET, ...userPresets]);
      }
    } catch (error) {
      console.error("Failed to load presets from localStorage", error);
    }
  }, []);

  // Update visualizer colors
  useEffect(() => {
    // This function will derive colors from score and density
    const getColors = () => {
        let hue1 = 270; // primary
        let hue2 = 215; // accent
        let bgLightness = 7;

        switch(score) {
            case 'dreamtales': hue1=270; hue2=215; break;
            case 'evolve': hue1=150; hue2=200; break;
            case 'omega': hue1=340; hue2=280; break;
            case 'journey': hue1=25; hue2=180; break;
            case 'multeity': hue1=210; hue2=30; break;
            case 'slow_blues': hue1=220; hue2=25; break;
            case 'celtic_ballad': hue1=100; hue2=160; break;
        }

        const saturation = 50 + (density * 30);
        const lightness1 = 50 + (density * 15);
        const lightness2 = 60 - (density * 20);
        bgLightness = Math.max(3, 7 - (density * 4));

        setVisualizerColors([
            `hsl(${hue1}, ${saturation}%, ${lightness1}%)`,
            `hsl(${hue2}, ${saturation}%, ${lightness2}%)`,
            `hsl(0, 0%, ${bgLightness}%)`,
        ]);
    };
    getColors();
  }, [score, density]);

  const savePresetsToLocalStorage = (newPresets: UIPreset[]) => {
    try {
      // Don't save the default preset to localStorage
      const userPresets = newPresets.filter(p => p.name !== OMEGA_SAMPLE_PRESET.name);
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(userPresets));
    } catch (error) {
      console.error("Failed to save presets to localStorage", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save presets.' });
    }
  };

  const handleSavePreset = () => {
    const presetName = window.prompt("Enter a name for your preset:");
    if (presetName && presetName.trim() !== '') {
      if (presetName.trim() === OMEGA_SAMPLE_PRESET.name) {
        toast({ variant: 'destructive', title: 'Error', description: 'Cannot overwrite the default sample preset.' });
        return;
      }

      const newPreset: UIPreset = {
        name: presetName.trim(),
        score,
        bpm,
        density,
        instrumentSettings,
        drumSettings,
        textureSettings,
        eqSettings,
      };
      
      const newPresets = [
        OMEGA_SAMPLE_PRESET,
        ...presets.filter(p => p.name !== newPreset.name && p.name !== OMEGA_SAMPLE_PRESET.name), 
        newPreset
      ];

      setPresets(newPresets);
      savePresetsToLocalStorage(newPresets);
      toast({ title: 'Preset Saved', description: `"${newPreset.name}" has been saved.` });
    }
  };

  const handleLoadPreset = (presetName: string) => {
    const preset = presets.find(p => p.name === presetName);
    if (preset) {
      // Create a full settings object from the preset
      const fullSettings: WorkerSettings = {
        bpm: preset.bpm,
        score: preset.score,
        instrumentSettings: preset.instrumentSettings,
        drumSettings: { ...preset.drumSettings, enabled: preset.drumSettings.pattern !== 'none' },
        textureSettings: {
          sparkles: { enabled: preset.textureSettings.sparkles.enabled },
          pads: { enabled: preset.textureSettings.pads.enabled },
        },
        density: preset.density,
      };
      
      // Update UI state first
      setScore(preset.score);
      setBpm(preset.bpm);
      setDensity(preset.density);
      setInstrumentSettings(preset.instrumentSettings);
      setDrumSettings(preset.drumSettings);
      setTextureSettings(preset.textureSettings);
      setEqSettings(preset.eqSettings);
      
      // Then apply all settings to the audio engine at once
      updateSettings(fullSettings);
      
      Object.entries(preset.instrumentSettings).forEach(([part, settings]) => {
        setVolume(part as InstrumentPart, settings.volume);
        setInstrument(part as keyof InstrumentSettings, settings.name as any);
        if (part === 'bass') {
          setBassTechnique(settings.technique);
        }
      });
      setVolume('drums', preset.drumSettings.volume);
      handleTextureEnabledChange('sparkles', preset.textureSettings.sparkles.enabled);
      handleTextureEnabledChange('pads', preset.textureSettings.pads.enabled);
      setVolume('sparkles', preset.textureSettings.sparkles.volume);
      setVolume('pads', preset.textureSettings.pads.volume);
      
      preset.eqSettings.forEach((gain, index) => setEQGain(index, gain));

      toast({ title: 'Preset Loaded', description: `"${presetName}" has been loaded.` });
      setIsPresetModalOpen(false); // Close modal after loading
    }
  };


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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleEqPresetChange = (preset: EQPreset) => {
    const newSettings = EQ_PRESETS[preset];
    setEqSettings(newSettings);
    newSettings.forEach((gain, index) => {
        setEQGain(index, gain);
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
    handleEqPresetChange,
    timerSettings,
    handleTimerDurationChange,
    handleToggleTimer,
    presets,
    handleSavePreset,
    handleLoadPreset,
    isPresetModalOpen,
    setIsPresetModalOpen,
    isVisualizerOpen,
    setIsVisualizerOpen,
    visualizerColors
  };
};

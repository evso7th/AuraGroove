
"use client";

import type { DrumSettings, InstrumentSettings, ScoreName, BassInstrument, InstrumentPart, MelodyInstrument, AccompanimentInstrument, BassTechnique, TextureSettings, TimerSettings, EQPreset, UIPreset } from '@/types/music';

// This is the V1 component, now considered legacy and will be deleted.
// The new component is aura-groove-v2.tsx
// This file is kept temporarily for reference during transition.

export type AuraGrooveProps = {
  isPlaying: boolean;
  isInitializing: boolean;
  handleTogglePlay: () => void;
  drumSettings: DrumSettings;
  setDrumSettings: (settings: React.SetStateAction<DrumSettings>) => void;
  instrumentSettings: InstrumentSettings;
  setInstrumentSettings: (part: keyof InstrumentSettings, name: BassInstrument | MelodyInstrument | AccompanimentInstrument) => void;
  handleBassTechniqueChange: (technique: BassTechnique) => void;
  handleVolumeChange: (part: InstrumentPart, value: number) => void;
  textureSettings: TextureSettings;
  handleTextureEnabledChange: (part: 'sparkles' | 'pads', enabled: boolean) => void;
  bpm: number;
  handleBpmChange: (value: number) => void;
  score: ScoreName;
  handleScoreChange: (value: ScoreName) => void;
  density: number;
  setDensity: (value: number) => void;
  handleGoHome: () => void;
  handleExit: () => void;
  isEqModalOpen: boolean;
  setIsEqModalOpen: (isOpen: boolean) => void;
  eqSettings: number[];
  handleEqChange: (bandIndex: number, gain: number) => void;
  handleEqPresetChange: (preset: EQPreset) => void;
  timerSettings: TimerSettings;
  handleTimerDurationChange: (minutes: number) => void;
  handleToggleTimer: () => void;
  presets: UIPreset[];
  handleSavePreset: () => void;
  handleLoadPreset: (name: string) => void;
  isPresetModalOpen: boolean;
  setIsPresetModalOpen: (isOpen: boolean) => void;
  isVisualizerOpen: boolean;
  setIsVisualizerOpen: (isOpen: boolean) => void;
  visualizerColors: string[];
};

export function AuraGroove(props: AuraGrooveProps) {
  // This component is now deprecated and its contents have been moved to aura-groove-v2.tsx
  // It will be deleted in the next step.
  return null;
}

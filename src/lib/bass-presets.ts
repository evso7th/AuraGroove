
export type BassPreset = {
  // Layer 1
  wave1: 'sine' | 'triangle' | 'sawtooth';
  attack1: number;      
  release1: number;     
  portamento1?: number; 
  
  // Layer 2 (optional)
  wave2?: 'sine' | 'triangle' | 'sawtooth';
  attack2?: number;      
  release2?: number;     
  portamento2?: number; 
  
  // Shared
  cutoff: number;       
  distortion?: number;  
  filterQ?: number;     
  stagger?: number; // ms delay for layer 2

  // UI
  color: string;        
  description: string;  
};

export const BASS_PRESETS: Record<string, BassPreset> = {
  classicBass: {
    wave1: 'sawtooth',
    attack1: 0.01,
    release1: 0.3,
    cutoff: 400,
    distortion: 0.05,
    filterQ: 0.7,
    color: '#8B4513',
    description: 'Чёткий, ритмичный, как настоящая бас-гитара'
  },
  glideBass: {
    wave1: 'triangle',
    attack1: 0.05,
    release1: 1.5,
    portamento1: 0.03,
    cutoff: 300,
    filterQ: 0.5,
    color: '#4169E1',
    description: 'Плавный, как скольжение по струне'
  },
  ambientDrone: {
    wave1: 'sine',
    attack1: 0.2,
    release1: 3.0,
    portamento1: 0.08,
    cutoff: 120,
    filterQ: 1.2,
    color: '#1A0033',
    description: 'Тёмный, плотный, как вибрация под землёй'
  },
  resonantGliss: {
    wave1: 'sawtooth',
    attack1: 0.02,
    release1: 1.0,
    portamento1: 0.06,
    cutoff: 500,
    filterQ: 1.4,
    distortion: 0.1,
    color: '#8B008B',
    description: 'Резонирующий, с "пением", идеален для глиссандо'
  },
  hypnoticDrone: {
    wave1: 'sine',
    attack1: 0.2,
    release1: 3.0,
    wave2: 'triangle',
    attack2: 0.1,
    release2: 2.0,
    cutoff: 150,
    stagger: 0.015,
    color: '#483D8B',
    description: 'Вибрация земли со стерео-движением'
  },
  livingRiff: {
    wave1: 'sine',
    attack1: 0.01,
    release1: 1.0,
    wave2: 'sawtooth',
    attack2: 0.05,
    release2: 1.5,
    distortion: 0.1,
    cutoff: 350,
    stagger: 0.005,
    color: '#FF4500',
    description: 'Живой, дышащий рифф с характером'
  }
};


export type BassPreset = {
  wave: 'sine' | 'triangle' | 'sawtooth';
  attack: number;       // 0.001 – 2.0
  release: number;      // 0.1 – 5.0
  cutoff: number;       // 50 – 800 Hz
  portamento?: number;  // 0.01 – 0.1
  distortion?: number;  // 0.0 – 0.3
  filterQ?: number;     // 0.5 – 1.5
  color: string;        // для UI
  description: string;  // для пользователя
};

export const BASS_PRESETS: Record<string, BassPreset> = {
  /**
   * 🎸 1. Classic Bass Guitar
   * Как настоящая бас-гитара: чёткий attack, короткий sustain, идеален для ритма
   */
  classicBass: {
    wave: 'sawtooth',
    attack: 0.01,
    release: 0.3,
    cutoff: 400,
    distortion: 0.05,
    filterQ: 0.7,
    color: '#8B4513', // Ржаво-коричневый
    description: 'Чёткий, ритмичный, как настоящая бас-гитара'
  },

  /**
   * 🌀 2. Smooth Glide Bass
   * Плавный, с длинным release, идеален для портаменто и глиссандо
   */
  glideBass: {
    wave: 'triangle',
    attack: 0.05,
    release: 1.5,
    cutoff: 300,
    portamento: 0.03,
    filterQ: 0.5,
    color: '#4169E1', // Королевский синий
    description: 'Плавный, как скольжение по струне'
  },

  /**
   * 🌑 3. Deep Ambient Drone
   * Очень длинный, плотный, с мягким фильтром — как вибрация земли
   */
  ambientDrone: {
    wave: 'sine',
    attack: 0.2,
    release: 3.0,
    cutoff: 120,
    portamento: 0.08,
    filterQ: 1.2,
    color: '#1A0033', // Глубокий фиолетовый
    description: 'Тёмный, плотный, как вибрация под землёй'
  },

  /**
   * 🌀 4. Resonant Glissando Bass
   * С акцентом на обертоны, с фильтром и медленным глиссандо — как электронный виолончель
   */
  resonantGliss: {
    wave: 'sawtooth',
    attack: 0.02,
    release: 1.0,
    cutoff: 500,
    portamento: 0.06,
    filterQ: 1.4,
    distortion: 0.1,
    color: '#8B008B', // Темно-пурпурный
    description: 'Резонирующий, с "пением", идеален для глиссандо'
  }
};

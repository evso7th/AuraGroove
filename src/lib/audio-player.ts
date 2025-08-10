"use client";

import * as Tone from 'tone';

export type InstrumentType = 'synthesizer' | 'organ' | 'piano' | 'bass guitar';
export type Part = 'solo' | 'accompaniment' | 'bass';

export interface Instruments {
  solo: InstrumentType;
  accompaniment: InstrumentType;
  bass: InstrumentType;
}

class AudioPlayer {
  private isInitialized = false;
  private synths: {
    solo?: Tone.PolySynth;
    accompaniment?: Tone.PolySynth;
    bass?: Tone.MonoSynth;
  } = {};
  
  private masterVolume?: Tone.Volume;
  private reverb?: Tone.Reverb;
  private delay?: Tone.FeedbackDelay;

  constructor() {}

  public async initialize(instruments: Instruments) {
    if (this.isInitialized) {
      this.stop();
    }
    await Tone.start();
    
    this.masterVolume = new Tone.Volume(-12).toDestination();
    this.reverb = new Tone.Reverb({ decay: 8, wet: 0.5 }).connect(this.masterVolume);
    this.delay = new Tone.FeedbackDelay("8n", 0.4).connect(this.reverb);

    this.setInstrument('solo', instruments.solo);
    this.setInstrument('accompaniment', instruments.accompaniment);
    this.setInstrument('bass', instruments.bass);

    Tone.Transport.start();
    this.isInitialized = true;
  }

  private createSynth(instrument: InstrumentType): Tone.PolySynth {
    let synthOptions;
    const commonOptions = { volume: -14 };

    switch (instrument) {
      case 'piano':
        synthOptions = { oscillator: { type: 'fmsine4', harmonicity: 0.5 }, envelope: { attack: 0.01, decay: 1.2, sustain: 0.1, release: 2.0 } };
        break;
      case 'organ':
        synthOptions = { oscillator: { type: 'fatsawtooth', count: 3, spread: 20 }, envelope: { attack: 0.2, decay: 0.1, sustain: 0.9, release: 0.8 } };
        break;
      default: // synthesizer
        synthOptions = { oscillator: { type: 'pulse', width: 0.6 }, envelope: { attack: 0.1, decay: 0.5, sustain: 0.4, release: 1.5 } };
    }
    const synth = new Tone.PolySynth(Tone.Synth, { ...commonOptions, ...synthOptions });
    synth.connect(this.delay!);
    return synth;
  }
  
  private createBassSynth(): Tone.MonoSynth {
    const bassSynth = new Tone.MonoSynth({
      volume: -8,
      oscillator: { type: 'fmsine' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 1, release: 2.5 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.7,
        sustain: 0.4,
        release: 2,
        baseFrequency: 40,
        octaves: 4
      }
    });
    bassSynth.connect(this.masterVolume!);
    return bassSynth;
  }

  public setInstrument(part: Part, instrument: InstrumentType) {
    if (!this.masterVolume) return;

    this.synths[part]?.dispose();

    if (part === 'bass') {
        this.synths.bass = this.createBassSynth();
    } else {
        this.synths[part] = this.createSynth(instrument);
    }
  }

  public playNote(part: Part, note: string | string[]) {
    if (!this.isInitialized) return;
    
    const synth = this.synths[part];
    if (synth) {
      try {
        const duration = part === 'accompaniment' ? '1m' : part === 'bass' ? '1m' : '8n';
        synth.triggerAttackRelease(note, duration, Tone.now());
      } catch (e) {
        console.error(`Error playing note on part ${part}:`, e);
      }
    }
  }

  public stop() {
    if (!this.isInitialized) return;

    Object.values(this.synths).forEach(synth => {
      if (synth) {
        synth.releaseAll();
        synth.dispose();
      }
    });
    this.synths = {};
    
    this.delay?.dispose();
    this.reverb?.dispose();
    this.masterVolume?.dispose();
    
    this.isInitialized = false;
    
    if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
    }
    Tone.Transport.cancel(0);
  }
}

export const audioPlayer = new AudioPlayer();

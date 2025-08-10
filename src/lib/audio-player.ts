"use client";

import * as Tone from 'tone';

export type InstrumentType = 'synthesizer' | 'organ' | 'piano' | 'bass guitar';
export type Part = 'solo' | 'accompaniment' | 'bass';

export interface Instruments {
  solo: InstrumentType;
  accompaniment: InstrumentType;
  bass: InstrumentType;
}

export interface Note {
  time: number;
  note: number; // MIDI note number
  duration: number; // in seconds
  part: Part;
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
  private nextPartStartTime = 0;

  constructor() {}

  public async initialize(instruments: Instruments) {
    if (this.isInitialized) {
      return;
    }
    await Tone.start();
    
    this.masterVolume = new Tone.Volume(-12).toDestination();
    this.reverb = new Tone.Reverb({ decay: 8, wet: 0.5 }).connect(this.masterVolume);
    this.delay = new Tone.FeedbackDelay("8n", 0.4).connect(this.reverb);

    this.setInstruments(instruments);

    Tone.Transport.bpm.value = 120;
    this.isInitialized = true;
  }
  
  public get context() {
    return Tone.context;
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

  public setInstruments(instruments: Instruments) {
    if (!this.masterVolume) return;

    Object.values(this.synths).forEach(synth => synth?.dispose());
    
    this.synths.solo = this.createSynth(instruments.solo);
    this.synths.accompaniment = this.createSynth(instruments.accompaniment);
    this.synths.bass = this.createBassSynth();
  }

  public schedulePart(
    partDuration: number, 
    times: Float32Array, 
    pitches: Float32Array, 
    durations: Float32Array, 
    parts: Uint8Array
  ) {
      if (!this.isInitialized) return;
      
      const startTime = this.nextPartStartTime;

      for (let i = 0; i < pitches.length; i++) {
        const part = parts[i] === 0 ? 'solo' : parts[i] === 1 ? 'accompaniment' : 'bass';
        const synth = this.synths[part];

        if(synth) {
            const frequency = Tone.Frequency(pitches[i], "midi").toFrequency();
            synth.triggerAttackRelease(frequency, durations[i], startTime + times[i]);
        }
      }
      
      this.nextPartStartTime += partDuration;
  }

  public start() {
      if (!this.isInitialized) return;
      this.nextPartStartTime = this.context.currentTime + 0.2; // Add small buffer
      if (Tone.Transport.state !== 'started') {
          Tone.Transport.start();
      }
  }

  public stop() {
    if (!this.isInitialized) return;

    if (Tone.Transport.state === 'started') {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
    }
    
    Object.values(this.synths).forEach(synth => {
      if (synth && typeof synth.releaseAll === 'function') {
        synth.releaseAll();
      }
    });
    this.nextPartStartTime = 0;
  }
}

export const audioPlayer = new AudioPlayer();

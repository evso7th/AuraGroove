"use client";

import * as Tone from 'tone';

export interface MusicData {
  soloPart: string[];
  accompanimentPart: string[];
  bassPart: string[];
}

export interface Instruments {
  soloInstrument: 'synthesizer' | 'organ' | 'piano';
  accompanimentInstrument: 'synthesizer' | 'organ' | 'piano';
  bassInstrument: 'bass guitar';
}

class AudioPlayer {
  private isInitialized = false;
  private isPlaying = false;
  private synths: {
    solo?: Tone.PolySynth;
    accompaniment?: Tone.PolySynth;
    bass?: Tone.MonoSynth;
  } = {};
  private sequences: {
    solo?: Tone.Sequence;
    accompaniment?: Tone.Sequence;
    bass?: Tone.Sequence;
  } = {};
  private masterVolume?: Tone.Volume;
  private lfo?: Tone.LFO;
  private reverb?: Tone.Reverb;
  private delay?: Tone.FeedbackDelay;

  constructor() {
    // Defer initialization to user interaction
  }

  private async initialize() {
    if (this.isInitialized) return;
    await Tone.start();
    
    this.masterVolume = new Tone.Volume(-12).toDestination();
    this.reverb = new Tone.Reverb({ decay: 10, wet: 0.6 }).connect(this.masterVolume);
    this.delay = new Tone.FeedbackDelay("4n", 0.5).connect(this.reverb);

    Tone.Transport.bpm.value = 60;
    Tone.Transport.timeSignature = [4, 4];
    this.isInitialized = true;
  }

  private createSynth(instrument: 'synthesizer' | 'organ' | 'piano'): Tone.PolySynth {
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
    return new Tone.PolySynth(Tone.Synth, { ...commonOptions, ...synthOptions }).connect(this.delay!);
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
    }).connect(this.masterVolume!);

    this.lfo = new Tone.LFO("2n", -6, 0).start();
    this.lfo.connect(bassSynth.volume);
    
    return bassSynth;
  }
  
  public async play(musicData: MusicData, instruments: Instruments) {
    await this.initialize();

    if (this.isPlaying) {
      this.stop();
    }
    
    await Tone.start();

    this.synths.solo = this.createSynth(instruments.soloInstrument);
    this.synths.accompaniment = this.createSynth(instruments.accompanimentInstrument);
    this.synths.bass = this.createBassSynth();

    const { soloPart, accompanimentPart, bassPart } = musicData;
    
    if (soloPart.length > 0) {
        this.sequences.solo = new Tone.Sequence((time, note) => {
            this.synths.solo?.triggerAttackRelease(note, '2n', time);
        }, soloPart, '4n').start(0);
        this.sequences.solo.loop = true;
    }
    
    if (accompanimentPart.length > 0) {
        this.sequences.accompaniment = new Tone.Sequence((time, note) => {
            this.synths.accompaniment?.triggerAttackRelease(note, '1n', time);
        }, accompanimentPart, '1m').start(0);
        this.sequences.accompaniment.loop = true;
    }
    
    if (bassPart.length > 0) {
        this.sequences.bass = new Tone.Sequence((time, note) => {
            this.synths.bass?.triggerAttackRelease(note, '1n', time);
        }, bassPart, '1m').start(0);
        this.sequences.bass.loop = true;
    }

    Tone.Transport.start();
    this.isPlaying = true;
  }

  public stop() {
    if (!this.isPlaying) return;

    Tone.Transport.stop();
    Tone.Transport.cancel(0);

    Object.values(this.sequences).forEach(seq => {
        if (seq) {
            seq.stop();
            seq.dispose();
        }
    });
    this.sequences = {};

    Object.values(this.synths).forEach(synth => synth?.dispose());
    this.synths = {};
    
    this.lfo?.dispose();
    this.delay?.dispose();
    this.reverb?.dispose();
    
    this.lfo = undefined;
    this.delay = undefined;
    this.reverb = undefined;
    
    this.isPlaying = false;
  }
}

export const audioPlayer = new AudioPlayer();

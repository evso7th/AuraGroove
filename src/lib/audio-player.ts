"use client";

import * as Tone from 'tone';

export interface MusicData {
  soloPart: string;
  accompanimentPart: string;
  bassPart: string;
}

export type Instrument = 'synthesizer' | 'organ' | 'piano';
export type BassInstrument = 'bass guitar';

export interface Instruments {
  soloInstrument: Instrument;
  accompanimentInstrument: Instrument;
  bassInstrument: BassInstrument;
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

  constructor() {
    // Defer volume creation to initialize method
  }

  private async initialize() {
    if (this.isInitialized) return;
    await Tone.start();
    if (!this.masterVolume) {
        this.masterVolume = new Tone.Volume(-6).toDestination();
    }
    Tone.Transport.bpm.value = 70;
    Tone.Transport.timeSignature = [4, 4];
    this.isInitialized = true;
    console.log("AudioContext started");
  }

  private createSynth(instrument: Instrument): Tone.PolySynth {
    let synthOptions;
    const commonOptions = { maxPolyphony: 4, volume: -10 };

    switch (instrument) {
      case 'piano':
        synthOptions = { oscillator: { type: 'fmsine4', harmonicity: 0.5 }, envelope: { attack: 0.01, decay: 0.8, sustain: 0.1, release: 1.5 } };
        break;
      case 'organ':
        synthOptions = { oscillator: { type: 'fatsawtooth', count: 3, spread: 20 }, envelope: { attack: 0.1, decay: 0.1, sustain: 0.9, release: 0.7 } };
        break;
      default:
        synthOptions = { oscillator: { type: 'pulse', width: 0.6 }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 1 } };
    }
    return new Tone.PolySynth(Tone.Synth, { ...commonOptions, ...synthOptions }).connect(this.masterVolume!);
  }

  private createBassSynth(): Tone.MonoSynth {
    const bassSynth = new Tone.MonoSynth({
      volume: -2,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.1, decay: 0.3, sustain: 1, release: 1.5 },
      filterEnvelope: {
        attack: 0.01,
        decay: 0.7,
        sustain: 0.4,
        release: 2,
        baseFrequency: 40,
        octaves: 3
      }
    }).connect(this.masterVolume!);

    this.lfo = new Tone.LFO("4n", -4, 0).start();
    this.lfo.connect(bassSynth.volume);
    
    return bassSynth;
  }

  private parseNotes(noteString: string): string[] {
    if(!noteString) return [];
    return noteString.trim().split(/\s+/).filter(n => n.match(/^[A-G][#b]?[0-9]$/));
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

    const soloNotes = this.parseNotes(musicData.soloPart);
    const accompanimentNotes = this.parseNotes(musicData.accompanimentPart);
    const bassNotes = this.parseNotes(musicData.bassPart);
    
    if (soloNotes.length > 0) {
        this.sequences.solo = new Tone.Sequence((time, note) => {
            this.synths.solo?.triggerAttackRelease(note, '4n', time);
        }, soloNotes, '4n').start(0);
        this.sequences.solo.loop = true;
    }
    
    if (accompanimentNotes.length > 0) {
        this.sequences.accompaniment = new Tone.Sequence((time, note) => {
            this.synths.accompaniment?.triggerAttackRelease(note, '2n', time);
        }, accompanimentNotes, '1m').start(0);
        this.sequences.accompaniment.loop = true;
    }
    
    if (bassNotes.length > 0) {
        this.sequences.bass = new Tone.Sequence((time, note) => {
            this.synths.bass?.triggerAttackRelease(note, '1n', time);
        }, bassNotes, '1m').start(0);
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
    this.lfo = undefined;
    
    this.isPlaying = false;
  }
}

export const audioPlayer = new AudioPlayer();

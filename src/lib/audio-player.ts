"use client";

import * as Tone from 'tone';

export type InstrumentType = 'synthesizer' | 'organ' | 'piano' | 'bass guitar';

export interface Instruments {
  solo: InstrumentType;
  accompaniment: InstrumentType;
  bass: InstrumentType;
}

class AudioPlayer {
  private isInitialized = false;
  private audioContext: AudioContext | null = null;
  private nextPartStartTime = 0;
  private bufferQueue: { buffer: AudioBuffer, time: number }[] = [];
  private isPlaying = false;
  private scheduleTimeout: number | null = null;

  constructor() {}

  public async initialize() {
    if (this.isInitialized) return;
    await Tone.start();
    this.audioContext = Tone.context.rawContext as AudioContext;
    this.isInitialized = true;
    this.isPlaying = false;
  }
  
  private scheduleBuffers() {
    if (!this.isPlaying || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    
    while(this.bufferQueue.length > 0 && this.bufferQueue[0].time < now + 0.5) {
      const { buffer, time } = this.bufferQueue.shift()!;
      
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      
      const startTime = Math.max(now, time);
      source.start(startTime);
    }

    if (this.isPlaying) {
       this.scheduleTimeout = window.setTimeout(() => this.scheduleBuffers(), 100);
    }
  }

  public schedulePart(bufferData: Float32Array, duration: number) {
      if (!this.isInitialized || !this.audioContext) return;

      const buffer = this.audioContext.createBuffer(1, bufferData.length, this.audioContext.sampleRate);
      buffer.copyToChannel(bufferData, 0);
      
      this.bufferQueue.push({ buffer, time: this.nextPartStartTime });
      
      this.nextPartStartTime += duration;
  }

  public start() {
    if (!this.isInitialized || !this.audioContext || this.isPlaying) return;
    this.isPlaying = true;
    this.nextPartStartTime = this.audioContext.currentTime + 0.1;
    this.bufferQueue = [];
    this.scheduleBuffers();
  }

  public stop() {
    if (!this.isInitialized || !this.isPlaying) return;
    this.isPlaying = false;
    if (this.scheduleTimeout) {
      clearTimeout(this.scheduleTimeout);
      this.scheduleTimeout = null;
    }
    this.bufferQueue = [];
    this.nextPartStartTime = 0;
  }
}

export const audioPlayer = new AudioPlayer();

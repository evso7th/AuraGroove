
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
    // Tone.start() returns a promise that resolves when the audio context is started
    await Tone.start(); 
    this.audioContext = Tone.context.rawContext as AudioContext;
    this.isInitialized = true;
    this.isPlaying = false;
    console.log("AudioPlayer initialized");
  }
  
  private scheduleBuffers() {
    if (!this.isPlaying || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    
    // Schedule buffers that should start in the next 0.5 seconds
    while(this.bufferQueue.length > 0 && this.bufferQueue[0].time < now + 0.5) {
      const { buffer, time } = this.bufferQueue.shift()!;
      
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      
      // Ensure the start time is not in the past
      const startTime = Math.max(now, time);
      source.start(startTime);
    }

    if (this.isPlaying) {
       // Check for new buffers to schedule every 100ms
       this.scheduleTimeout = window.setTimeout(() => this.scheduleBuffers(), 100);
    }
  }

  public schedulePart(bufferData: Float32Array, duration: number) {
      if (!this.isInitialized || !this.audioContext) {
          console.error("AudioPlayer not initialized, cannot schedule part.");
          return;
      }

      // Create an AudioBuffer from the raw Float32Array data
      const buffer = this.audioContext.createBuffer(1, bufferData.length, this.audioContext.sampleRate);
      buffer.copyToChannel(bufferData, 0);
      
      this.bufferQueue.push({ buffer, time: this.nextPartStartTime });
      
      // Increment the start time for the next part
      this.nextPartStartTime += duration;
  }

  public start() {
    if (!this.isInitialized || !this.audioContext || this.isPlaying) return;
    this.isPlaying = true;
    // Start playing a little bit in the future to avoid initial glitches
    this.nextPartStartTime = this.audioContext.currentTime + 0.1;
    this.bufferQueue = [];
    this.scheduleBuffers();
    console.log("AudioPlayer started");
  }

  public stop() {
    if (!this.isInitialized || !this.isPlaying) return;
    this.isPlaying = false;
    // Stop the scheduling loop
    if (this.scheduleTimeout) {
      clearTimeout(this.scheduleTimeout);
      this.scheduleTimeout = null;
    }
    // Clear any pending buffers
    this.bufferQueue = [];
    this.nextPartStartTime = 0; // Reset start time
    console.log("AudioPlayer stopped");
  }
}

export const audioPlayer = new AudioPlayer();

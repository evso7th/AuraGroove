
"use client";

class AudioPlayer {
  private isInitialized = false;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private nextPartStartTime = 0;
  private bufferQueue: { buffer: AudioBuffer, time: number }[] = [];
  private _isPlaying = false;
  private scheduleTimeoutId: number | null = null;

  constructor() {}

  public getIsPlaying(): boolean {
    return this._isPlaying;
  }
  
  public getAudioContext(): AudioContext | null {
      return this.audioContext;
  }

  public async initialize() {
    if (this.isInitialized) return;
    
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Resume is essential for browsers that suspend the context by default.
    // This should be called after a user gesture.
    if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
    }

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.7; // Set a reasonable default volume
    this.masterGain.connect(this.audioContext.destination);
    
    this.isInitialized = true;
    this._isPlaying = false;
    console.log("AudioPlayer initialized with sample rate:", this.audioContext.sampleRate);
  }
  
  private scheduleBuffers() {
    if (!this._isPlaying || !this.audioContext || !this.masterGain) return;
    
    const now = this.audioContext.currentTime;
    
    // Schedule buffers that are due in the next 100ms
    while(this.bufferQueue.length > 0 && this.bufferQueue[0].time < now + 0.1) {
      const { buffer, time } = this.bufferQueue.shift()!;
      
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);
      
      // Ensure we don't schedule in the past
      const startTime = Math.max(now, time);
      source.start(startTime);
    }
    
    // Check again in 50ms
    this.scheduleTimeoutId = window.setTimeout(() => this.scheduleBuffers(), 50);
  }

  public schedulePart(bufferData: Float32Array, duration: number) {
      if (!this.isInitialized || !this.audioContext) {
          console.error("AudioPlayer not initialized, cannot schedule part.");
          return;
      }
      
      if (bufferData.length === 0) {
        return;
      }
      
      const audioBuffer = this.audioContext.createBuffer(1, bufferData.length, this.audioContext.sampleRate);
      audioBuffer.copyToChannel(bufferData, 0);
      
      this.bufferQueue.push({ buffer: audioBuffer, time: this.nextPartStartTime });
      
      this.nextPartStartTime += duration;
  }

  public start() {
    if (!this.isInitialized || !this.audioContext || this._isPlaying) return;
    this._isPlaying = true;
    // Add a small delay to prevent jerky start
    this.nextPartStartTime = this.audioContext.currentTime + 0.2;
    this.scheduleBuffers();
    console.log("AudioPlayer started");
  }

  public stop() {
    if (!this.isInitialized) return;
    this._isPlaying = false;
    if (this.scheduleTimeoutId) {
      clearTimeout(this.scheduleTimeoutId);
      this.scheduleTimeoutId = null;
    }
    // Clear any scheduled sources and the queue
    this.audioContext?.close().then(() => {
        this.isInitialized = false;
        this.audioContext = null;
        console.log("AudioContext closed and reset.");
    });
    this.bufferQueue = [];
    this.nextPartStartTime = 0;
    console.log("AudioPlayer stopped");
  }
}

export const audioPlayer = new AudioPlayer();

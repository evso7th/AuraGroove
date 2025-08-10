
"use client";

class AudioPlayer {
  private isInitialized = false;
  private audioContext: AudioContext | null = null;
  private nextPartStartTime = 0;
  private bufferQueue: { buffer: AudioBuffer, time: number }[] = [];
  private isPlaying = false;
  private scheduleTimeoutId: number | null = null;

  constructor() {}

  public async initialize() {
    if (this.isInitialized) return;
    
    // Create a new AudioContext
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    // Resume context if it's in a suspended state (required by modern browsers)
    if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
    }
    
    this.isInitialized = true;
    this.isPlaying = false;
    console.log("AudioPlayer initialized with sample rate:", this.audioContext.sampleRate);
  }
  
  private scheduleBuffers() {
    if (!this.isPlaying || !this.audioContext) return;
    
    const now = this.audioContext.currentTime;
    
    // Schedule all buffers that should have started by now + a small lookahead window
    while(this.bufferQueue.length > 0 && this.bufferQueue[0].time < now + 0.1) {
      const { buffer, time } = this.bufferQueue.shift()!;
      
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioContext.destination);
      
      // If the scheduled time is in the past, play it immediately. Otherwise, play it at the scheduled time.
      const startTime = Math.max(now, time);
      source.start(startTime);
    }
    
    // Continue scheduling
    this.scheduleTimeoutId = window.setTimeout(() => this.scheduleBuffers(), 50);
  }

  public schedulePart(bufferData: Float32Array, duration: number) {
      if (!this.isInitialized || !this.audioContext) {
          console.error("AudioPlayer not initialized, cannot schedule part.");
          return;
      }

      // Create an AudioBuffer from the raw Float32Array data
      const audioBuffer = this.audioContext.createBuffer(1, bufferData.length, this.audioContext.sampleRate);
      audioBuffer.copyToChannel(bufferData, 0);
      
      this.bufferQueue.push({ buffer: audioBuffer, time: this.nextPartStartTime });
      
      // Increment the start time for the next part
      this.nextPartStartTime += duration;
  }

  public start() {
    if (!this.isInitialized || !this.audioContext || this.isPlaying) return;
    this.isPlaying = true;
    // Start playing a little bit in the future to ensure the first buffer is ready
    this.nextPartStartTime = this.audioContext.currentTime + 0.2;
    this.scheduleBuffers();
    console.log("AudioPlayer started");
  }

  public stop() {
    if (!this.isInitialized || !this.isPlaying) return;
    this.isPlaying = false;
    if (this.scheduleTimeoutId) {
      clearTimeout(this.scheduleTimeoutId);
      this.scheduleTimeoutId = null;
    }
    // Clear any pending buffers
    this.bufferQueue = [];
    this.nextPartStartTime = 0; // Reset start time
    console.log("AudioPlayer stopped");
  }
}

export const audioPlayer = new AudioPlayer();

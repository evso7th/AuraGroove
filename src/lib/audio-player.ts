
"use client";

class AudioPlayer {
  public isInitialized = false;
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
    if (this.isInitialized && this.audioContext?.state !== 'closed') {
        if(this.audioContext?.state === 'suspended') {
            await this.audioContext.resume();
        }
        return;
    }
    
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
    }

    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0.7;
    this.masterGain.connect(this.audioContext.destination);
    
    this.isInitialized = true;
    // Do not set isPlaying to false here, let start/stop handle it.
    console.log("AudioPlayer initialized with sample rate:", this.audioContext.sampleRate);
  }
  
  private scheduleBuffers() {
    if (!this._isPlaying || !this.audioContext || !this.masterGain) return;
    
    const now = this.audioContext.currentTime;
    
    while(this.bufferQueue.length > 0 && this.bufferQueue[0].time < now + 0.2) {
      const { buffer, time } = this.bufferQueue.shift()!;
      
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(this.masterGain);
      
      const startTime = Math.max(now, time);
      source.start(startTime);
    }
    
    // Keep the scheduler running
    this.scheduleTimeoutId = window.setTimeout(() => this.scheduleBuffers(), 50);
  }

  public schedulePart(bufferData: Float32Array, duration: number) {
      if (!this.isInitialized || !this.audioContext) {
          console.error("AudioPlayer not initialized, cannot schedule part.");
          return;
      }
      
      if (bufferData.length === 0) {
        // If we receive an empty buffer, we still need to advance the timeline
        // to avoid a gap and prevent future parts from being scheduled in the past.
        this.nextPartStartTime += duration;
        return;
      }
      
      const audioBuffer = this.audioContext.createBuffer(1, bufferData.length, this.audioContext.sampleRate);
      audioBuffer.copyToChannel(bufferData, 0);
      
      this.bufferQueue.push({ buffer: audioBuffer, time: this.nextPartStartTime });
      
      this.nextPartStartTime += duration;
  }

  public start() {
    if (!this.isInitialized || !this.audioContext || this._isPlaying) return;

    if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
    }

    this._isPlaying = true;
    // Set the initial start time slightly in the future to allow for buffering.
    this.nextPartStartTime = this.audioContext.currentTime + 0.1;
    this.scheduleBuffers();
    console.log("AudioPlayer started");
  }

  public stop() {
    if (!this.isInitialized || !this.audioContext) return;
    
    this._isPlaying = false;
    
    if (this.scheduleTimeoutId) {
      clearTimeout(this.scheduleTimeoutId);
      this.scheduleTimeoutId = null;
    }

    // Clear the queue and reset time to prevent old notes from playing on restart.
    this.bufferQueue = [];
    this.nextPartStartTime = 0;
    
    // Suspend the context to save resources. It will be resumed on next start.
    if (this.audioContext.state === 'running') {
       this.audioContext.suspend();
    }
    console.log("AudioPlayer stopped (suspended)");
  }
}

export const audioPlayer = new AudioPlayer();

  
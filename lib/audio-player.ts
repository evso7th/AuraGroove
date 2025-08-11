
"use client";

/**
 * A simple audio player to handle seamless playback of audio chunks from a worker.
 * It uses a double-buffer approach to minimize gaps.
 */
export class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private nextStartTime: number = 0;
    private isRunning: boolean = false;
    private bufferQueue: { chunk: Float32Array; sampleRate: number }[] = [];
    private scheduleTimeout: any = null;

    constructor() {}

    public async init() {
        if (!this.audioContext) {
            try {
                this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
                this.nextStartTime = this.audioContext.currentTime;
                this.isRunning = false;
            } catch (e) {
                console.error("Failed to initialize AudioContext:", e);
                throw e; // re-throw to be caught by the caller
            }
        }
    }
    
    public isInitialized(): boolean {
        return !!this.audioContext;
    }

    public getSampleRate(): number | null {
        return this.audioContext?.sampleRate ?? null;
    }

    public start() {
        if (this.audioContext && !this.isRunning) {
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.isRunning = true;
            this.nextStartTime = this.audioContext.currentTime + 0.2; // Add a small latency buffer
            this.scheduleNextBuffer();
        }
    }

    public stop() {
        this.isRunning = false;
        if(this.scheduleTimeout) {
            clearTimeout(this.scheduleTimeout);
            this.scheduleTimeout = null;
        }
        this.bufferQueue = [];
        // Don't close the context, just stop scheduling
    }

    public scheduleChunk(chunk: Float32Array, sampleRate: number) {
        if (!this.audioContext || chunk.length === 0) return;
        this.bufferQueue.push({ chunk, sampleRate });
        // If playback has started and we weren't already scheduling, start now
        if (this.isRunning && this.scheduleTimeout === null) {
            this.scheduleNextBuffer();
        }
    }

    private scheduleNextBuffer() {
        if (!this.audioContext || !this.isRunning) {
            this.scheduleTimeout = null;
            return;
        }

        // Schedule buffers that should start in the near future.
        const scheduleAheadTime = 0.5; // seconds

        while (this.bufferQueue.length > 0 && this.nextStartTime < this.audioContext.currentTime + scheduleAheadTime) {
            const { chunk, sampleRate } = this.bufferQueue.shift()!;

            const audioBuffer = this.audioContext.createBuffer(
                1, // number of channels
                chunk.length,
                sampleRate
            );

            audioBuffer.copyToChannel(chunk, 0);

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.audioContext.destination);
            
            // If the calculated start time is in the past, start immediately
            const scheduleTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
            source.start(scheduleTime);
            
            this.nextStartTime = scheduleTime + audioBuffer.duration;
        }

        // Check back in a bit to see if we need to schedule more.
        this.scheduleTimeout = setTimeout(() => this.scheduleNextBuffer(), 50);
    }
}

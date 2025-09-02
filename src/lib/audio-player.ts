
"use client";

import type { AudioChunk } from '@/types/music';

/**
 * A simple audio player to handle seamless playback of audio chunks from a worker.
 * It uses a double-buffer approach to minimize gaps.
 */
export class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private nextStartTime: number = 0;
    private isRunning: boolean = false;
    private bufferQueue: { chunk: Float32Array; duration: number }[] = [];
    private scheduleTimeout: any = null;
    private masterGain: GainNode | null = null;


    constructor() {}

    public async init(): Promise<void> {
        if (this.audioContext) return;
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);

            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }
            console.log('[AudioPlayer] Initialized successfully.');
        } catch (e) {
            console.error("[AudioPlayer] Failed to initialize AudioContext:", e);
            throw e; 
        }
    }
    
    public getSampleRate(): number {
        if (!this.audioContext) {
            throw new Error("AudioPlayer not initialized. Cannot get sample rate.");
        }
        return this.audioContext.sampleRate;
    }

    public start() {
        if (!this.audioContext || this.isRunning) return;
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        this.isRunning = true;
        this.nextStartTime = this.audioContext.currentTime + 0.2; // Add a small latency buffer
        this.scheduleNextBuffer();
        console.log('[AudioPlayer] Started playback.');
    }

    public stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if(this.scheduleTimeout) {
            clearTimeout(this.scheduleTimeout);
            this.scheduleTimeout = null;
        }
        this.bufferQueue = [];
        console.log('[AudioPlayer] Stopped playback.');
    }

    public scheduleChunk(chunk: Float32Array, duration: number) {
        if (!this.audioContext || chunk.length === 0) return;
        this.bufferQueue.push({ chunk, duration });
    }

    private scheduleNextBuffer() {
        if (!this.audioContext || !this.isRunning) {
            this.scheduleTimeout = null;
            return;
        }

        // Schedule buffers that should start in the near future.
        const scheduleAheadTime = 0.5; // seconds

        while (this.bufferQueue.length > 0 && this.nextStartTime < this.audioContext.currentTime + scheduleAheadTime) {
            const data = this.bufferQueue.shift();
            if (!data) continue;

            const { chunk, duration } = data;

            const audioBuffer = this.audioContext.createBuffer(
                1, // number of channels
                chunk.length,
                this.audioContext.sampleRate
            );

            audioBuffer.copyToChannel(chunk, 0);

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.masterGain!);
            
            // If the calculated start time is in the past, start immediately
            const scheduleTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
            source.start(scheduleTime);
            
            this.nextStartTime = scheduleTime + duration;
        }

        // Check back in a bit to see if we need to schedule more.
        this.scheduleTimeout = setTimeout(() => this.scheduleNextBuffer(), 50);
    }
}

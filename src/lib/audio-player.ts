
"use client";

import type { AudioChunk } from '@/types/music';

/**
 * A simple audio player to handle seamless playback of audio chunks from a worker.
 * It uses a double-buffer approach to minimize gaps.
 */
export class AudioPlayer {
    private audioContext: AudioContext;
    private bufferQueue: AudioChunk[] = [];
    private scheduleTimeout: any = null;
    private isRunning = false;
    private masterGain: GainNode;

    constructor(audioContext: AudioContext) {
        this.audioContext = audioContext;
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
    }
    
    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.scheduleNextBuffer();
        console.log('[AudioPlayer] Started.');
    }

    public stop() {
        this.isRunning = false;
        if(this.scheduleTimeout) {
            clearTimeout(this.scheduleTimeout);
            this.scheduleTimeout = null;
        }
        this.bufferQueue = [];
        console.log('[AudioPlayer] Stopped.');
    }

    public scheduleChunk(chunk: AudioChunk) {
        if (chunk.chunk.length === 0) return;

        this.bufferQueue.push(chunk);

        // If playback has started and we weren't already scheduling, start now
        if (this.isRunning && this.scheduleTimeout === null) {
            this.scheduleNextBuffer();
        }
    }

    private scheduleNextBuffer() {
        if (!this.isRunning) {
            this.scheduleTimeout = null;
            return;
        }
        
        const scheduleAheadTime = 0.5; // seconds

        while (this.bufferQueue.length > 0 && this.bufferQueue[0].startTime < this.audioContext.currentTime + scheduleAheadTime) {
            const data = this.bufferQueue.shift();
            if (!data) continue;

            const { chunk, startTime } = data;

            const audioBuffer = this.audioContext.createBuffer(
                1, // number of channels
                chunk.length,
                this.audioContext.sampleRate
            );

            audioBuffer.copyToChannel(chunk, 0);

            const source = this.audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.masterGain);
            
            // If the calculated start time is in the past, start immediately
            const scheduleTime = Math.max(startTime, this.audioContext.currentTime);
            source.start(scheduleTime);
        }

        // Check back in a bit to see if we need to schedule more.
        this.scheduleTimeout = setTimeout(() => this.scheduleNextBuffer(), 100);
    }
}


"use client";

/**
 * A simple audio player to handle seamless playback of audio chunks from a worker.
 * It uses a double-buffer approach to minimize gaps.
 */
export class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private nextStartTime: number = 0;
    private isRunning: boolean = false;

    constructor() {}

    public init() {
        if (!this.audioContext) {
            this.audioContext = new AudioContext();
            this.nextStartTime = this.audioContext.currentTime;
            this.isRunning = false;
        }
    }

    public start() {
        if (this.audioContext && !this.isRunning) {
            // If context was suspended, resume it
            if(this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            this.isRunning = true;
            this.nextStartTime = this.audioContext.currentTime;
        }
    }

    public stop() {
        if (this.audioContext) {
            this.isRunning = false;
            // Best practice to close the context when done
            this.audioContext.close().then(() => {
                this.audioContext = null;
            });
        }
    }

    public scheduleChunk(chunkData: Float32Array, sampleRate: number) {
        if (!this.audioContext || !this.isRunning) {
            return;
        }

        const audioBuffer = this.audioContext.createBuffer(
            1, // number of channels
            chunkData.length,
            sampleRate
        );

        audioBuffer.copyToChannel(chunkData, 0);

        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);

        // Schedule the chunk to play.
        // If the next start time is in the past, schedule it to play immediately.
        const scheduleTime = Math.max(this.nextStartTime, this.audioContext.currentTime);
        source.start(scheduleTime);
        
        // Update the start time for the next chunk
        this.nextStartTime = scheduleTime + audioBuffer.duration;
    }
}

    
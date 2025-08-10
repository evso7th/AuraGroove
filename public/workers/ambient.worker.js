
"use strict";

// --- Утилиты и полифиллы ---

// Полифилл для requestAnimationFrame в воркере
if (!self.requestAnimationFrame) {
    let lastTime = 0;
    self.requestAnimationFrame = (callback) => {
        const currTime = new Date().getTime();
        const timeToCall = Math.max(0, 16 - (currTime - lastTime));
        const id = self.setTimeout(() => {
            callback(currTime + timeToCall);
        }, timeToCall);
        lastTime = currTime + timeToCall;
        return id;
    };
}
if (!self.cancelAnimationFrame) {
    self.cancelAnimationFrame = (id) => {
        clearTimeout(id);
    };
}

// --- Основной класс воркера ---

class MusicWorker {
    constructor() {
        this.isRunning = false;
        this.animationFrameId = null;
        this.scheduleAheadTime = 0.1; // 100ms
        this.nextNoteTime = 0.0;
        this.current16thNote = 0;
        this.tempoBPM = 60;
        
        // Настройки инструментов
        this.instruments = {
            solo: "none",
            accompaniment: "none",
            bass: "none"
        };
        this.drumsEnabled = true;

        // Звуковые данные (сэмплы)
        this.samples = {};
        this.sampleRate = 44100;
        this.isSamplesLoaded = false;
    }

    // --- Обработка команд из основного потока ---
    
    handleCommand(command, data) {
        switch (command) {
            case 'load_samples':
                this.loadSamples(data);
                break;
            case 'start':
                this.start(data);
                break;
            case 'stop':
                this.stop();
                break;
            case 'set_instruments':
                this.setInstruments(data);
                break;
            case 'toggle_drums':
                this.toggleDrums(data.enabled);
                break;
            default:
                console.warn(`[Worker] Unknown command: ${command}`);
        }
    }
    
    loadSamples(samples) {
        this.samples = samples;
        this.isSamplesLoaded = true;
        self.postMessage({ type: 'samples_loaded' });
    }

    start(config) {
        if (this.isRunning) return;

        this.isRunning = true;
        this.current16thNote = 0;
        this.nextNoteTime = 0.0; // Будет установлено в первом цикле scheduler
        this.sampleRate = config.sampleRate || 44100;
        this.setInstruments(config.instruments);
        this.toggleDrums(config.drumsEnabled);
        
        // Запускаем планировщик
        this.animationFrameId = self.requestAnimationFrame(this.scheduler.bind(this));
        
        console.log("[Worker] Music generation started.");
    }

    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;
        if (this.animationFrameId) {
            self.cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        console.log("[Worker] Music generation stopped.");
    }

    setInstruments(instruments) {
        this.instruments = instruments;
        console.log("[Worker] Instruments updated:", this.instruments);
    }
    
    toggleDrums(enabled) {
        this.drumsEnabled = enabled;
        console.log(`[Worker] Drums ${enabled ? 'enabled' : 'disabled'}.`);
    }

    // --- Планировщик и генерация музыки ---
    
    scheduler(currentTime) {
        if (!this.isRunning) return;

        if (this.nextNoteTime === 0.0) {
             this.nextNoteTime = currentTime / 1000;
        }
        
        const secondsPerBeat = 60.0 / this.tempoBPM;
        const noteDuration = secondsPerBeat / 4.0; // 16-е ноты

        while (this.nextNoteTime < (currentTime / 1000) + this.scheduleAheadTime) {
            const chunk = this.createAudioChunk(noteDuration);
            
            // Отправляем чанк в основной поток для воспроизведения
            if (chunk.length > 0) {
                 self.postMessage({
                    type: 'chunk',
                    data: {
                        chunk: chunk,
                        duration: noteDuration
                    }
                }, [chunk.buffer]);
            }

            this.nextNoteTime += noteDuration;
            this.current16thNote = (this.current16thNote + 1) % 16;
        }

        this.animationFrameId = self.requestAnimationFrame(this.scheduler.bind(this));
    }
    
    createAudioChunk(duration) {
        const bufferSize = Math.floor(this.sampleRate * duration);
        const chunkBuffer = new Float32Array(bufferSize).fill(0);
        
        // --- Генерация ударных ---
        if (this.drumsEnabled) {
             // Бочка (Kick) - на 1-ю долю (пропускаем самый первый удар)
            if (this.current16thNote === 0 && this.nextNoteTime > 0) {
                this.mixSample(chunkBuffer, this.samples.kick, 0.4); 
            }
            // Малый барабан (Snare) - на 2-ю и 4-ю доли
            if (this.current16thNote === 4 || this.current16thNote === 12) {
                this.mixSample(chunkBuffer, this.samples.snare, 1.0);
            }
            // Хай-хэт (Hi-hat) - на каждую 8-ю ноту
            if (this.current16thNote % 2 === 0) {
                this.mixSample(chunkBuffer, this.samples.hat, 0.6);
            }
            // Крэш (Crash) - в начале каждого 4-го такта
            if (this.current16thNote === 0 && Math.floor(this.nextNoteTime / (secondsPerBeat * 4)) % 4 === 0) {
                 const crashSample = this.applyFadeOut(this.samples.crash);
                 this.mixSample(chunkBuffer, crashSample, 0.8);
            }
            // Райд (Ride) - на каждую четвертную ноту
            if (this.current16thNote % 4 === 0) {
                this.mixSample(chunkBuffer, this.samples.ride, 1.0);
            }
             // Томы (Toms fill) - в конце каждого 4-го такта
            const barNumber = Math.floor(this.nextNoteTime / (60.0 / this.tempoBPM * 4));
            if (barNumber % 4 === 3) {
                 if (this.current16thNote === 13) this.mixSample(chunkBuffer, this.samples.tom1, 0.9);
                 if (this.current16thNote === 14) this.mixSample(chunkBuffer, this.samples.tom2, 0.9);
                 if (this.current16thNote === 15) this.mixSample(chunkBuffer, this.samples.tom3, 0.9);
            }
        }

        // --- Генерация баса ---
        if (this.instruments.bass === 'bass guitar') {
             // Играем бас вместе с бочкой
             if (this.current16thNote === 0) {
                const bassNote = this.createSineWave(220.0, duration, 0.15); // E2 note
                this.mixSample(chunkBuffer, bassNote);
             }
        }
        
        return chunkBuffer;
    }
    
    // --- Вспомогательные аудио-функции ---

    mixSample(outputBuffer, sample, gain = 1.0) {
        if (!sample) return;
        const mixLength = Math.min(outputBuffer.length, sample.length);
        for (let i = 0; i < mixLength; i++) {
            outputBuffer[i] += sample[i] * gain;
        }
    }
    
    applyFadeOut(sample) {
        if (!sample) return null;
        const newSample = new Float32Array(sample);
        for (let i = 0; i < newSample.length; i++) {
            const multiplier = 1.0 - (i / newSample.length);
            newSample[i] *= multiplier;
        }
        return newSample;
    }
    
    createSineWave(frequency, duration, gain = 1.0) {
        const bufferSize = Math.floor(this.sampleRate * duration);
        const buffer = new Float32Array(bufferSize);
        const angularFrequency = 2 * Math.PI * frequency / this.sampleRate;
        for (let i = 0; i < bufferSize; i++) {
            buffer[i] = Math.sin(i * angularFrequency) * gain;
        }
        // простое затухание для избежания щелчков
        for (let i = 0; i < Math.min(buffer.length, 500); i++) {
             buffer[buffer.length - 1 - i] *= (i / 500);
        }
        return buffer;
    }
}

// --- Инициализация воркера ---
const worker = new MusicWorker();

self.onmessage = (event) => {
    const { command, data } = event.data;
    try {
        worker.handleCommand(command, data);
    } catch(e) {
        self.postMessage({ type: 'error', error: e.message });
    }
};

    
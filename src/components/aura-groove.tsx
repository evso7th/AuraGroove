
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { Drum, Loader2, Music, Pause, Speaker } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Logo from "@/components/icons";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { AudioPlayer } from "@/lib/audio-player";
import { SoloSynthManager } from "@/lib/solo-synth-manager";


export type Instruments = {
  solo: 'synthesizer' | 'piano' | 'organ' | 'none';
  accompaniment: 'synthesizer' | 'piano' | 'organ' | 'none';
  bass: 'bass synth' | 'none';
};

export type DrumSettings = {
    enabled: boolean;
    pattern: 'basic' | 'breakbeat' | 'slow' | 'heavy';
    volume: number;
};

// Helper to decode audio data in the main thread
async function decodeSamples(samplePaths: Record<string, string>, toast: (options: any) => void) {
    const context = Tone.getContext();
    const promises = Object.entries(samplePaths).map(async ([key, path]) => {
        try {
            const response = await fetch(path);
            if (!response.ok) {
                throw new Error(`Failed to fetch sample: ${key} at ${path}`);
            }
            const arrayBuffer = await response.arrayBuffer();
             if (context.state === 'suspended') {
                await context.resume();
            }
            // Temporarily create a full AudioBuffer to get the channel data
            const audioBuffer = await context.decodeAudioData(arrayBuffer);
            // We only need the raw Float32Array for the worker, not the full ArrayBuffer
            // so we extract the channel data and let the rest be garbage collected.
            return { [key]: audioBuffer.getChannelData(0) };
        } catch (e) {
            console.error(`Error decoding sample ${key}:`, e);
            toast({
                variant: "destructive",
                title: "Sample Decoding Error",
                description: `Failed to decode ${key}. Please check the file path and format.`,
            });
            return { [key]: new Float32Array(0) };
        }
    });
    const decodedPairs = await Promise.all(promises);
    // Combine the array of {key: value} pairs into a single object
    return decodedPairs.reduce((acc, pair) => ({ ...acc, ...pair }), {});
}

type BassNote = {
    note: string;
    time: number;
    duration: number;
    velocity: number;
}

type SoloNote = {
    notes: string | string[];
    time: number;
    duration: Tone.Unit.Time;
    velocity: number;
}


export function AuraGroove() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({
      enabled: true,
      pattern: 'basic',
      volume: 0.7,
  });
  const [instruments, setInstruments] = useState<Instruments>({
    solo: "organ",
    accompaniment: "none",
    bass: "bass synth",
  });
  const [bpm, setBpm] = useState(100);
  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  const audioPlayerRef = useRef<AudioPlayer>();
  const bassSynthRef = useRef<Tone.PolySynth | null>(null);
  const soloSynthManagerRef = useRef<SoloSynthManager | null>(null);
  const isWorkerInitialized = useRef(false);
  
  if (!audioPlayerRef.current) {
    audioPlayerRef.current = new AudioPlayer();
  }
  
   if (!soloSynthManagerRef.current) {
    soloSynthManagerRef.current = new SoloSynthManager();
  }

   useEffect(() => {
    // We create a new worker, which will be responsible for all music generation logic.
    // This keeps the main thread free for UI updates.
    if (!musicWorkerRef.current) {
        musicWorkerRef.current = new Worker('/workers/ambient.worker.js');

        const handleMessage = (event: MessageEvent) => {
          const { type, data, error } = event.data;
          
          switch(type) {
            case 'initialized':
              isWorkerInitialized.current = true;
              setLoadingText("Starting playback...");
               if (musicWorkerRef.current) {
                    musicWorkerRef.current.postMessage({
                        command: 'start',
                        data: { drumSettings, instruments, bpm }
                    });
                }
              break;
            
            case 'started':
                 setIsInitializing(false);
                 setLoadingText("");
                 setIsPlaying(true);
                 audioPlayerRef.current?.start();
                 Tone.Transport.start();
                 break;

            case 'chunk':
              if (data && audioPlayerRef.current && data.chunk && data.duration) {
                 audioPlayerRef.current.scheduleChunk(data.chunk, data.duration);
              }
              break;
            
            case 'bass_score':
                if (bassSynthRef.current && data.score && data.score.length > 0) {
                    const now = Tone.now();
                    data.score.forEach((note: BassNote) => {
                        bassSynthRef.current?.triggerAttackRelease(
                            note.note,
                            note.duration,
                            now + note.time,
                            note.velocity
                        );
                    });
                }
                break;
            
            case 'solo_score':
                if (soloSynthManagerRef.current && data.score && data.score.length > 0) {
                    const now = Tone.now();
                    data.score.forEach((note: SoloNote) => {
                        soloSynthManagerRef.current?.triggerAttackRelease(
                            note.notes,
                            note.duration,
                            now + note.time
                        );
                    });
                }
                break;

            case 'stopped':
                setIsPlaying(false);
                setLoadingText("");
                audioPlayerRef.current?.stop();
                break;

            case 'error':
              toast({
                variant: "destructive",
                title: "Worker Error",
                description: error,
              });
              setIsPlaying(false);
              setIsInitializing(false);
              setLoadingText("");
              break;
          }
        };

        musicWorkerRef.current.onmessage = handleMessage;
    }
    
    // Cleanup function to terminate the worker when the component unmounts.
    return () => {
      if (musicWorkerRef.current) {
        musicWorkerRef.current.terminate();
        musicWorkerRef.current = undefined;
      }
      audioPlayerRef.current?.stop();
      bassSynthRef.current?.dispose();
      soloSynthManagerRef.current?.dispose();
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, []); // Empty dependency array ensures this effect runs only once.
  
  // This effect listens for changes in any of the music settings (instruments, drums, BPM)
  // and sends them to the worker if playback is active.
  const updateWorkerSettings = useCallback(() => {
    if (musicWorkerRef.current && (isPlaying || isInitializing)) {
        musicWorkerRef.current?.postMessage({
            command: 'update_settings',
            data: { instruments, drumSettings, bpm },
        });
    }
  }, [instruments, drumSettings, bpm, isPlaying, isInitializing]);

  useEffect(() => {
    updateWorkerSettings();
  }, [drumSettings, instruments, bpm, updateWorkerSettings]);
  
  // This effect updates the synth's parameters whenever they change in the UI
  useEffect(() => {
    if (bassSynthRef.current) {
        // The synth is now a PolySynth and effects need to be chained.
        // For simplicity, we re-create it on play.
    }
  }, []);

  // Handle solo instrument changes
  useEffect(() => {
    if (soloSynthManagerRef.current) {
        soloSynthManagerRef.current.setInstrument(instruments.solo);
    }
  }, [instruments.solo]);


  const handlePlay = useCallback(async () => {
    if (!audioPlayerRef.current || !musicWorkerRef.current) return;

    setIsInitializing(true);

    try {
        await Tone.start();
        
        if (bassSynthRef.current) {
            bassSynthRef.current.dispose();
        }

        const distortion = new Tone.Distortion(0.4).toDestination();
        bassSynthRef.current = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: "fmsquare", harmonicity: 1.2 },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.1, release: 1.4 },
            filter: { Q: 2, type: "lowpass", rolloff: -24 },
            filterEnvelope: { attack: 0.06, decay: 0.2, sustain: 0.5, release: 1, baseFrequency: 80, octaves: 4 }
        }).connect(distortion);
        
        if (soloSynthManagerRef.current) {
            soloSynthManagerRef.current.setInstrument(instruments.solo);
        }

        if (!audioPlayerRef.current.isInitialized()) {
            setLoadingText("Preparing audio engine...");
            await audioPlayerRef.current.init();
        }
        
        const sampleRate = audioPlayerRef.current.getSampleRate();
        if (!sampleRate) {
            throw new Error("AudioContext not initialized or sample rate not available.");
        }
        
        if (isWorkerInitialized.current) {
            setLoadingText("Starting playback...");
            musicWorkerRef.current.postMessage({
                command: 'start',
                data: { drumSettings, instruments, bpm }
            });
        } else {
             setLoadingText("Loading audio samples...");
             const samplePaths = {
                kick: '/assets/drums/kick_drum6.wav',
                snare: '/assets/drums/snare.wav',
                hat: '/assets/drums/closed_hi_hat_accented.wav',
                crash: '/assets/drums/crash1.wav',
                ride: '/assets/drums/cymbal1.wav',
            };
            
            // Fetch and decode samples directly on the client.
            const decodedSamples = await decodeSamples(samplePaths, toast);
            // Create an array of transferable objects to send to the worker.
            // This is more efficient than copying the data.
            const transferableObjects = Object.values(decodedSamples).map(s => s.buffer);
            
            musicWorkerRef.current.postMessage({
                command: 'init',
                data: { 
                    sampleRate: sampleRate, 
                    samples: decodedSamples 
                }
            }, transferableObjects);
        }

    } catch (error) {
        console.error("Failed to prepare audio:", error);
        toast({
            variant: "destructive",
            title: "Audio Error",
            description: `Could not start audio. ${error instanceof Error ? error.message : ''}`,
        });
        setIsInitializing(false);
        setLoadingText("");
    }
  }, [drumSettings, instruments, bpm, toast]);

  const handleStop = useCallback(() => {
    soloSynthManagerRef.current?.releaseAll();
    Tone.Transport.stop();
    Tone.Transport.cancel();
    musicWorkerRef.current?.postMessage({ command: 'stop' });
  }, []);
  
  const handleTogglePlay = useCallback(() => {
    if (!audioPlayerRef.current) return;
    
    if (isPlaying) {
      handleStop();
    } else {
      handlePlay();
    }
  }, [isPlaying, handleStop, handlePlay]);
  
  const isBusy = isInitializing;

  return (
    <Card className="w-full max-w-lg shadow-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
            <Logo className="h-16 w-16" />
        </div>
        <CardTitle className="font-headline text-3xl">AuraGroove</CardTitle>
        <CardDescription>AI-powered ambient music generator</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 rounded-lg border p-4">
           <h3 className="text-lg font-medium text-primary">Instruments</h3>
           <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="solo-instrument" className="text-right">Solo</Label>
            <Select
              value={instruments.solo}
              onValueChange={(v) => setInstruments(i => ({...i, solo: v as Instruments['solo']}))}
              disabled={isBusy}
            >
              <SelectTrigger id="solo-instrument" className="col-span-2">
                <SelectValue placeholder="Select instrument" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="synthesizer" disabled>Synthesizer</SelectItem>
                <SelectItem value="piano" disabled>Piano</SelectItem>
                <SelectItem value="organ">Organ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="accompaniment-instrument" className="text-right">Accompaniment</Label>
             <Select
              value={instruments.accompaniment}
              onValueChange={(v) => setInstruments(i => ({...i, accompaniment: v as Instruments['accompaniment']}))}
              disabled={isBusy}
            >
              <SelectTrigger id="accompaniment-instrument" className="col-span-2">
                <SelectValue placeholder="Select instrument" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="synthesizer" disabled>Synthesizer</SelectItem>
                <SelectItem value="piano" disabled>Piano</SelectItem>
                <SelectItem value="organ" disabled>Organ</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="bass-instrument" className="text-right">Bass</Label>
             <div className="col-span-2 flex items-center gap-2">
                <Select
                    value={instruments.bass}
                    onValueChange={(v) => setInstruments(i => ({...i, bass: v as Instruments['bass']}))}
                    disabled={isBusy}
                    >
                    <SelectTrigger id="bass-instrument" className="w-full">
                        <SelectValue placeholder="Select instrument" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="bass synth">Bass Synth</SelectItem>
                    </SelectContent>
                </Select>
             </div>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
             <h3 className="text-lg font-medium text-primary flex items-center gap-2"><Drum className="h-5 w-5"/> Drums</h3>
             <div className="flex items-center justify-between pt-2">
                <Label htmlFor="drums-enabled">Enable Drums</Label>
                <Switch
                    id="drums-enabled"
                    checked={drumSettings.enabled}
                    onCheckedChange={(c) => setDrumSettings(d => ({ ...d, enabled: c }))}
                    disabled={isBusy}
                />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="drum-pattern" className="text-right">Pattern</Label>
                <Select
                    value={drumSettings.pattern}
                    onValueChange={(v) => setDrumSettings(d => ({ ...d, pattern: v as DrumSettings['pattern'] }))}
                    disabled={isBusy || !drumSettings.enabled}
                >
                    <SelectTrigger id="drum-pattern" className="col-span-2">
                        <SelectValue placeholder="Select pattern" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="breakbeat">Breakbeat</SelectItem>
                        <SelectItem value="slow">Slow</SelectItem>
                        <SelectItem value="heavy">Heavy</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right flex items-center gap-1.5"><Music className="h-4 w-4"/> BPM</Label>
                <Slider
                    value={[bpm]}
                    min={60}
                    max={160}
                    step={5}
                    onValueChange={(v) => setBpm(v[0])}
                    className="col-span-2"
                    disabled={isBusy}
                />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                <Slider
                    value={[drumSettings.volume]}
                    max={1}
                    step={0.05}
                    onValueChange={(v) => setDrumSettings(d => ({ ...d, volume: v[0] }))}
                    className="col-span-2"
                    disabled={isBusy || !drumSettings.enabled}
                />
            </div>
        </div>
         
         {isBusy && (
            <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 min-h-[40px]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p>{loadingText || "Loading..."}</p>
            </div>
        )}
         {!isBusy && !isPlaying && (
            <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Press play to start the music.
            </p>
        )}
        {!isBusy && isPlaying && (
             <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Playing at {bpm} BPM...
            </p>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <Button
          type="button"
          onClick={handleTogglePlay}
          disabled={isBusy}
          className="w-full text-lg py-6"
        >
          {isBusy ? (
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="mr-2 h-6 w-6" />
          ) : (
            <Music className="mr-2 h-6 w-6" />
          )}
          {isBusy ? loadingText : isPlaying ? "Stop" : "Play"}
        </Button>
      </CardFooter>
    </Card>
  );
}

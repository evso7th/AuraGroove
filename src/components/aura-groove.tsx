
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { Drum, Loader2, Music, Pause, Settings, Speaker } from "lucide-react";
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
import { BassSynthControls, type BassSynthParams } from "./bass-synth-controls";

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

// Helper function to decode audio data in the main thread
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
            // Use Tone.context.decodeAudioData for consistency
            const audioBuffer = await context.decodeAudioData(arrayBuffer);
            // We only need the raw channel data for the worker
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
    return decodedPairs.reduce((acc, pair) => ({ ...acc, ...pair }), {});
}

type BassNote = {
    note: string;
    time: number;
    duration: number;
    velocity: number;
}

const initialBassParams: BassSynthParams = {
    oscillator: {
        harmonicity: 1.5,
    },
    envelope: {
        attack: 0.05,
        decay: 0.3,
        sustain: 0.4,
        release: 1.4,
    },
    filter: {
        Q: 2,
    },
    filterEnvelope: {
        attack: 0.06,
        decay: 0.2,
        sustain: 0,
        release: 1,
        baseFrequency: 200,
        octaves: 4,
    },
};


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
    solo: "none",
    accompaniment: "none",
    bass: "bass synth",
  });
  const [bpm, setBpm] = useState(100);
   const [bassParams, setBassParams] = useState<BassSynthParams>(initialBassParams);
  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  const audioPlayerRef = useRef<AudioPlayer>();
  const bassSynthRef = useRef<Tone.MonoSynth | null>(null);
  const isWorkerInitialized = useRef(false);
  
  if (!audioPlayerRef.current) {
    audioPlayerRef.current = new AudioPlayer();
  }

   useEffect(() => {
    // Make sure to create the worker only once.
    if (!musicWorkerRef.current) {
        musicWorkerRef.current = new Worker(new URL('../../public/workers/ambient.worker.js', import.meta.url));

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
                 // The worker now sends the correct sample rate
                 audioPlayerRef.current.scheduleChunk(data.chunk, data.duration);
              }
              break;
            
            case 'bass_score':
                if (bassSynthRef.current && data.score && data.score.length > 0) {
                    const now = Tone.now();
                    const synth = bassSynthRef.current;
                    synth.toDestination(); // Connect before playing

                    let lastNoteTime = 0;
                    data.score.forEach((note: BassNote) => {
                        synth.triggerAttackRelease(
                            note.note,
                            note.duration,
                            now + note.time,
                            note.velocity
                        );
                        if ((now + note.time + note.duration) > lastNoteTime) {
                            lastNoteTime = now + note.time + note.duration;
                        }
                    });

                    // Schedule disconnection after the last note has finished
                    Tone.Transport.scheduleOnce(() => {
                        synth.disconnect();
                    }, lastNoteTime);
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
    
    return () => {
      // Terminate worker on component unmount
      if (musicWorkerRef.current) {
        musicWorkerRef.current.terminate();
        musicWorkerRef.current = undefined;
      }
      audioPlayerRef.current?.stop();
      bassSynthRef.current?.dispose();
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, []); // Keep dependencies empty to run only once.
  
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
        bassSynthRef.current.set({
            oscillator: {
                type: "amsine",
                harmonicity: bassParams.oscillator.harmonicity,
            },
            envelope: bassParams.envelope,
            filter: {
                ...bassParams.filter,
                 type: "lowpass", // Keep type fixed
                 rolloff: -24
            },
            filterEnvelope: bassParams.filterEnvelope
        });
    }
  }, [bassParams]);


  const handlePlay = useCallback(async () => {
    if (!audioPlayerRef.current || !musicWorkerRef.current) return;

    setIsInitializing(true);

    try {
        await Tone.start();
        
        if (!bassSynthRef.current) {
             bassSynthRef.current = new Tone.MonoSynth({
                oscillator: { type: "amsine", harmonicity: bassParams.oscillator.harmonicity },
                envelope: bassParams.envelope,
                filter: { ...bassParams.filter, type: "lowpass", rolloff: -24 },
                filterEnvelope: bassParams.filterEnvelope
            }); // Do NOT connect to destination here
        }

        if (!audioPlayerRef.current.isInitialized()) {
            setLoadingText("Preparing audio engine...");
            await audioPlayerRef.current.init();
        }
        
        const sampleRate = audioPlayerRef.current.getSampleRate();
        if (!sampleRate) {
            throw new Error("AudioContext not initialized or sample rate not available.");
        }
        
        // This check ensures we only initialize the worker with samples once.
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
            
            const decodedSamples = await decodeSamples(samplePaths, toast);
            
            const transferableObjects = Object.values(decodedSamples).map(s => (s as Float32Array).buffer);
            
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
  }, [drumSettings, instruments, bpm, toast, bassParams]);

  const handleStop = useCallback(() => {
    // Immediately trigger the release phase for all synth notes.
    if (bassSynthRef.current?.connected) {
        bassSynthRef.current.disconnect();
    }
    // Stop the transport and cancel all scheduled events.
    Tone.Transport.stop();
    Tone.Transport.cancel();
    // Use the worker to manage its own state.
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
                <SelectItem value="organ" disabled>Organ</SelectItem>
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
                <BassSynthControls 
                    params={bassParams}
                    setParams={setBassParams}
                    disabled={isBusy || instruments.bass === 'none'}
                />
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

    

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Drum, Loader2, Music, Pause, Speaker } from "lucide-react";
import * as Tone from 'tone';

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


export type Instruments = {
  solo: 'synthesizer' | 'piano' | 'organ' | 'none';
  accompaniment: 'synthesizer' | 'piano' | 'organ' | 'none';
  bass: 'bass guitar' | 'none';
};

export type DrumSettings = {
    enabled: boolean;
    pattern: 'basic' | 'breakbeat' | 'slow' | 'heavy';
    volume: number;
};

const sampleUrls = {
    kick: '/assets/drums/kick_drum6.wav',
    snare: '/assets/drums/snare.wav',
    hat: '/assets/drums/closed_hi_hat_accented.wav',
    crash: '/assets/drums/crash1.wav',
    ride: '/assets/drums/cymbal1.wav',
    tom1: '/assets/drums/hightom.wav',
    tom2: '/assets/drums/midtom.wav',
    tom3: '/assets/drums/lowtom.wav',
};


export function AuraGroove() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({
      enabled: true,
      pattern: 'basic',
      volume: 0.7, // Volume is now 0-1
  });
  const [instruments, setInstruments] = useState<Instruments>({
    solo: "none",
    accompaniment: "none",
    bass: "none",
  });
  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  const audioPlayerRef = useRef<AudioPlayer>();
  const isWorkerInitialized = useRef(false);

  // This function now starts the worker with current settings
  const startWorker = useCallback(() => {
      if (!isWorkerInitialized.current) return;
      setLoadingText("Generating music...");
      setIsInitializing(true);
      musicWorkerRef.current?.postMessage({
          command: 'start',
          data: {
              instruments,
              drumSettings
          }
      });
  }, [instruments, drumSettings]);

  // Main effect for worker communication
  useEffect(() => {
    const worker = new Worker(new URL('../app/ambient.worker.ts', import.meta.url));
    musicWorkerRef.current = worker;
    audioPlayerRef.current = new AudioPlayer();


    const handleMessage = (event: MessageEvent) => {
      const { type, data, error } = event.data;
      
      switch(type) {
        case 'started':
          setIsInitializing(false);
          setLoadingText("");
          setIsPlaying(true);
          audioPlayerRef.current?.start();
          break;

        case 'initialized':
          isWorkerInitialized.current = true;
          // Now that worker is initialized, we can start it if user already hit play
          if (isInitializing) {
            startWorker();
          }
          break;

        case 'chunk':
          audioPlayerRef.current?.scheduleChunk(data.chunk, data.sampleRate);
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

    worker.onmessage = handleMessage;
    
    return () => {
      worker.postMessage({ command: 'stop' });
      worker.terminate();
      audioPlayerRef.current?.stop();
    };
  }, [toast, startWorker, isInitializing]); 
  
  const handleInstrumentChange = useCallback((part: keyof Instruments, value: Instruments[keyof Instruments]) => {
    const newInstruments = { ...instruments, [part]: value };
    setInstruments(newInstruments);
     musicWorkerRef.current?.postMessage({
        command: 'set_instruments',
        data: newInstruments,
      });
  }, [instruments]);

 const handleDrumsSettingChange = useCallback((key: keyof DrumSettings, value: any) => {
    const newDrumSettings = { ...drumSettings, [key]: value };
    setDrumSettings(newDrumSettings);
    
    musicWorkerRef.current?.postMessage({
        command: 'set_drums',
        data: newDrumSettings,
    });
  }, [drumSettings]);


  const handlePlay = useCallback(async () => {
    setIsInitializing(true);
    setLoadingText("Preparing audio engine...");

    try {
        await Tone.start();
        audioPlayerRef.current?.init();
        setLoadingText("Initializing worker...");
        
        if (isWorkerInitialized.current) {
            startWorker();
        } else {
            musicWorkerRef.current?.postMessage({
                command: 'init',
                data: { sampleUrls }
            });
        }

    } catch (error) {
        console.error("Failed to prepare audio:", error);
        toast({
            variant: "destructive",
            title: "Audio Error",
            description: `Could not start audio context. Please interact with the page first. ${error instanceof Error ? error.message : ''}`,
        });
        setIsInitializing(false);
    }
  }, [toast, startWorker]);

  const handleStop = useCallback(() => {
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    audioPlayerRef.current?.stop();
    setIsPlaying(false);
    setIsInitializing(false);
    setLoadingText("");
  }, []);
  
  const handleTogglePlay = useCallback(() => {
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
              onValueChange={(v) => handleInstrumentChange('solo', v as Instruments['solo'])}
              disabled={isBusy || isPlaying}
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
              onValueChange={(v) => handleInstrumentChange('accompaniment', v as Instruments['accompaniment'])}
              disabled={isBusy || isPlaying}
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
             <Select
              value={instruments.bass}
              onValueChange={(v) => handleInstrumentChange('bass', v as Instruments['bass'])}
              disabled={isBusy || isPlaying}
            >
              <SelectTrigger id="bass-instrument" className="col-span-2">
                <SelectValue placeholder="Select instrument" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="bass guitar">Bass Guitar</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-4 rounded-lg border p-4">
             <h3 className="text-lg font-medium text-primary flex items-center gap-2"><Drum className="h-5 w-5"/> Drums</h3>
             <div className="flex items-center justify-between pt-2">
                <Label htmlFor="drums-enabled">Enable Drums</Label>
                <Switch
                    id="drums-enabled"
                    checked={drumSettings.enabled}
                    onCheckedChange={(c) => handleDrumsSettingChange('enabled', c)}
                    disabled={isBusy || isPlaying}
                />
            </div>
            <div className="grid grid-cols-3 items-center gap-4">
                <Label htmlFor="drum-pattern" className="text-right">Pattern</Label>
                <Select
                    value={drumSettings.pattern}
                    onValueChange={(v) => handleDrumsSettingChange('pattern', v as DrumSettings['pattern'])}
                    disabled={isBusy || isPlaying || !drumSettings.enabled}
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
                <Label className="text-right flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                <Slider
                    value={[drumSettings.volume]}
                    max={1}
                    step={0.05}
                    onValueChange={(v) => handleDrumsSettingChange('volume', v[0])}
                    className="col-span-2"
                    disabled={isBusy || isPlaying}
                />
            </div>
        </div>
         
         {(isBusy || (isPlaying && loadingText)) && (
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
        {!isBusy && isPlaying && !loadingText && (
             <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Playing...
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

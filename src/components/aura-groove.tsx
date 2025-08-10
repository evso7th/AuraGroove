
"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Music, Pause } from "lucide-react";
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
import { Logo } from "@/components/icons";
import { Switch } from "@/components/ui/switch";
import { audioPlayer } from "@/lib/audio-player";

export type Instruments = {
  solo: 'synthesizer' | 'piano' | 'organ' | 'none';
  accompaniment: 'synthesizer' | 'piano' | 'organ' | 'none';
  bass: 'bass guitar' | 'none';
};

const sampleUrls = {
    kick: '/samples/drums/kick.wav',
    snare: '/samples/drums/snare.wav',
    hat: '/samples/drums/hat.wav'
};

export function AuraGroove() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Loading...");
  const [drumsEnabled, setDrumsEnabled] = useState(true);
  const [instruments, setInstruments] = useState<Instruments>({
    solo: "none",
    accompaniment: "none",
    bass: "none",
  });
  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  const isAudioInitialized = useRef(false);

  useEffect(() => {
    musicWorkerRef.current = new Worker('/workers/ambient.worker.js');

    const handleMessage = (event: MessageEvent) => {
      const { type, data, error } = event.data;
      
      if (type === 'chunk') {
        audioPlayer.schedulePart(data.chunk, data.duration);
      } else if (type === 'generation_started') {
        setIsLoading(false);
        setIsPlaying(true);
        audioPlayer.start();
      } else if (type === 'error') {
        toast({
          variant: "destructive",
          title: "Worker Error",
          description: error,
        });
        handleStop();
      }
    };

    musicWorkerRef.current.onmessage = handleMessage;
    
    return () => {
      musicWorkerRef.current?.terminate();
      if (audioPlayer.getIsPlaying()) {
        audioPlayer.stop();
      }
    };
  }, [toast]);
  
  const handleInstrumentChange = (part: keyof Instruments) => (value: Instruments[keyof Instruments]) => {
    const newInstruments = { ...instruments, [part]: value };
    setInstruments(newInstruments);
    musicWorkerRef.current?.postMessage({
      command: 'set_instruments',
      data: newInstruments,
    });
  };

  const handleDrumsToggle = (checked: boolean) => {
    setDrumsEnabled(checked);
    musicWorkerRef.current?.postMessage({
        command: 'toggle_drums',
        data: { enabled: checked }
    });
  }
  
  const loadAndSendSamples = async () => {
    if (!audioPlayer.getAudioContext()) return;
    
    setLoadingText("Loading samples...");
    try {
        const audioContext = audioPlayer.getAudioContext()!;
        const sampleEntries = Object.entries(sampleUrls);
        
        const decodedSamples: { [key: string]: Float32Array } = {};
        const transferableObjects: Transferable[] = [];

        for (const [key, url] of sampleEntries) {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            const float32Array = audioBuffer.getChannelData(0);
            decodedSamples[key] = float32Array;
            transferableObjects.push(float32Array.buffer);
        }

        musicWorkerRef.current?.postMessage({
            command: 'load_samples',
            data: decodedSamples
        }, transferableObjects);

    } catch (error) {
        console.error("Failed to load samples:", error);
        toast({
            variant: "destructive",
            title: "Sample Error",
            description: "Could not load drum samples. Please check the file paths and network.",
        });
        throw error;
    }
  };


  const handlePlay = async () => {
    setIsLoading(true);

    if (!isAudioInitialized.current) {
        setLoadingText("Initializing audio...");
        await audioPlayer.initialize();
        isAudioInitialized.current = true;
    }

    try {
        await loadAndSendSamples();

        setLoadingText("Generating music...");
        const sampleRate = audioPlayer.getAudioContext()?.sampleRate || 44100;
    
        musicWorkerRef.current?.postMessage({
            command: 'start',
            data: {
                instruments,
                drumsEnabled,
                sampleRate
            }
        });
    } catch(error) {
        handleStop();
    }
  };

  const handleStop = () => {
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    audioPlayer.stop();
    setIsPlaying(false);
    setIsLoading(false);
  };
  
  const handleTogglePlay = () => {
    if (isPlaying || isLoading) {
      handleStop();
    } else {
      handlePlay();
    }
  };

  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4">
            <Logo className="h-16 w-16" />
        </div>
        <CardTitle className="font-headline text-3xl">AuraGroove</CardTitle>
        <CardDescription>AI-powered ambient music generator</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4">
           <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="solo-instrument" className="text-right">Solo</Label>
            <Select
              value={instruments.solo}
              onValueChange={handleInstrumentChange('solo')}
              disabled={isPlaying || isLoading}
            >
              <SelectTrigger id="solo-instrument" className="col-span-2">
                <SelectValue placeholder="Select instrument" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="synthesizer">Synthesizer</SelectItem>
                <SelectItem value="piano">Piano</SelectItem>
                <SelectItem value="organ">Organ</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="accompaniment-instrument" className="text-right">Accompaniment</Label>
             <Select
              value={instruments.accompaniment}
              onValueChange={handleInstrumentChange('accompaniment')}
              disabled={isPlaying || isLoading}
            >
              <SelectTrigger id="accompaniment-instrument" className="col-span-2">
                <SelectValue placeholder="Select instrument" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="synthesizer">Synthesizer</SelectItem>
                <SelectItem value="piano">Piano</SelectItem>
                <SelectItem value="organ">Organ</SelectItem>
              </SelectContent>
            </Select>
          </div>
           <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="bass-instrument" className="text-right">Bass</Label>
             <Select
              value={instruments.bass}
              onValueChange={handleInstrumentChange('bass')}
              disabled={isPlaying || isLoading}
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
           
           <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
                <Switch
                id="drums-enabled"
                checked={drumsEnabled}
                onCheckedChange={handleDrumsToggle}
                disabled={isPlaying || isLoading}
                />
                <Label htmlFor="drums-enabled">Drums</Label>
            </div>
          </div>
          
        </div>
         {isLoading && (
            <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 min-h-[40px]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p>{loadingText}</p>
            </div>
        )}
         {!isLoading && !isPlaying && (
            <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Press play to start the music.
            </p>
        )}
        {!isLoading && isPlaying && (
             <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Playing...
            </p>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <Button
          type="button"
          onClick={handleTogglePlay}
          disabled={isLoading}
          className="w-full text-lg py-6"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="mr-2 h-6 w-6" />
          ) : (
            <Music className="mr-2 h-6 w-6" />
          )}
          {isLoading ? loadingText : isPlaying ? "Stop" : "Play"}
        </Button>
      </CardFooter>
    </Card>
  );
}

    
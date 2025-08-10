
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Loading samples...");
  const [drumsEnabled, setDrumsEnabled] = useState(true);
  const [instruments, setInstruments] = useState<Instruments>({
    solo: "none",
    accompaniment: "none",
    bass: "bass guitar",
  });
  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  const sampleArrayBuffers = useRef<Record<string, ArrayBuffer>>({});
  const areSamplesLoadedOnMount = useRef(false);

  useEffect(() => {
    musicWorkerRef.current = new Worker('/workers/ambient.worker.js', { type: 'module' });

    const handleMessage = (event: MessageEvent) => {
      const { type, data, error } = event.data;
      
      if (type === 'chunk') {
        audioPlayer.schedulePart(data.chunk, data.duration);
      } else if (type === 'samples_loaded') {
        // Now that worker has samples, we can start generation
        setLoadingText("Generating music...");
        audioPlayer.start();
        musicWorkerRef.current?.postMessage({
            command: 'start',
            data: {
                instruments,
                drumsEnabled,
                sampleRate: audioPlayer.getAudioContext()?.sampleRate || 44100
            }
        });
        setIsLoading(false);
        setIsPlaying(true);
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
    
    const fetchSamples = async () => {
        try {
            const sampleEntries = Object.entries(sampleUrls);
            for (const [key, url] of sampleEntries) {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
                }
                sampleArrayBuffers.current[key] = await response.arrayBuffer();
            }
            areSamplesLoadedOnMount.current = true;
            setIsLoading(false);
            setLoadingText("");
        } catch (error) {
            console.error("Failed to fetch samples:", error);
            toast({
                variant: "destructive",
                title: "Sample Error",
                description: `Could not load drum samples. Please check file paths and network. ${error instanceof Error ? error.message : ''}`,
            });
            setIsLoading(false);
        }
    };

    fetchSamples();
    
    return () => {
      musicWorkerRef.current?.terminate();
      if (audioPlayer.getIsPlaying()) {
        audioPlayer.stop();
      }
    };
  }, []);
  
  const handleInstrumentChange = (part: keyof Instruments) => (value: Instruments[keyof Instruments]) => {
    const newInstruments = { ...instruments, [part]: value };
    setInstruments(newInstruments);
     if (isPlaying) {
      musicWorkerRef.current?.postMessage({
        command: 'set_instruments',
        data: newInstruments,
      });
    }
  };

  const handleDrumsToggle = (checked: boolean) => {
    setDrumsEnabled(checked);
    if (isPlaying) {
        musicWorkerRef.current?.postMessage({
            command: 'toggle_drums',
            data: { enabled: checked }
        });
    }
  }
  
  const prepareAudioAndSendSamples = async () => {
    setIsLoading(true);
    setLoadingText("Preparing audio engine...");

    try {
      await audioPlayer.initialize();
      const audioContext = audioPlayer.getAudioContext();
      if (!audioContext) {
        throw new Error("Could not initialize AudioContext.");
      }
      
      setLoadingText("Decoding samples...");
      const decodedSamples: { [key: string]: Float32Array } = {};
      const transferableObjects: Transferable[] = [];
      const sampleEntries = Object.entries(sampleArrayBuffers.current);

      for (const [key, arrayBuffer] of sampleEntries) {
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0)); 
          const float32Array = audioBuffer.getChannelData(0);
          decodedSamples[key] = float32Array;
          transferableObjects.push(float32Array.buffer);
      }
      
      setLoadingText("Loading instruments...");
      musicWorkerRef.current?.postMessage({
          command: 'load_samples',
          data: decodedSamples
      }, transferableObjects);
      
      return true;

    } catch (error) {
        console.error("Failed to prepare audio:", error);
        toast({
            variant: "destructive",
            title: "Audio Error",
            description: `Could not prepare audio. ${error instanceof Error ? error.message : ''}`,
        });
        setIsLoading(false);
        return false;
    }
  };

  const handlePlay = async () => {
    if (!areSamplesLoadedOnMount.current) {
        toast({
            title: "Samples not loaded",
            description: "Please wait for samples to finish loading.",
        });
        return;
    }
    
    // This is the main entry point now. It will init audio, decode, and send to worker.
    // The worker will then respond with 'samples_loaded', which triggers the start command.
    if (!await prepareAudioAndSendSamples()) {
        handleStop(); // Clean up if preparation failed
        return;
    }
  };

  const handleStop = () => {
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    audioPlayer.stop();
    setIsPlaying(false);
    setIsLoading(false);
  };
  
  const handleTogglePlay = () => {
    if (isPlaying || (isLoading && isPlaying)) {
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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
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
                disabled={isLoading}
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
          disabled={isLoading && !isPlaying}
          className="w-full text-lg py-6"
        >
          {isLoading && !isPlaying ? (
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
          ) : isPlaying ? (
            <Pause className="mr-2 h-6 w-6" />
          ) : (
            <Music className="mr-2 h-6 w-6" />
          )}
          {isLoading && !isPlaying ? loadingText : isPlaying ? "Stop" : "Play"}
        </Button>
      </CardFooter>
    </Card>
  );
}

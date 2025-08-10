
"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { audioPlayer } from "@/lib/audio-player";
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

export type Instruments = {
  solo: 'synthesizer' | 'piano' | 'organ';
  accompaniment: 'synthesizer' | 'piano' | 'organ';
  bass: 'bass guitar';
};


export function AuraGroove() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Loading...");
  const [drumsEnabled, setDrumsEnabled] = useState(false);
  const [instruments, setInstruments] = useState<Instruments>({
    solo: "synthesizer",
    accompaniment: "piano",
    bass: "bass guitar",
  });
  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  const isInitializedRef = useRef(false);

  useEffect(() => {
    musicWorkerRef.current = new Worker(new URL('../lib/workers/ambient.worker.ts', import.meta.url));

    const handleMessage = (event: MessageEvent) => {
      const { type, buffer, duration, message } = event.data;
      if (type === 'music_part') {
        audioPlayer.schedulePart(buffer, duration);
      } else if (type === 'error') {
         toast({
            variant: "destructive",
            title: "Worker Error",
            description: message,
         });
         handleStop();
      } else if (type === 'loading_start') {
        setLoadingText("Loading samples...");
        setIsLoading(true);
      }
      else if (type === 'loading_complete') {
        setIsLoading(false);
        setLoadingText("Loading...");
        if (!audioPlayer.getIsPlaying()) {
          audioPlayer.start();
          setIsPlaying(true);
        }
      }
    };

    musicWorkerRef.current.onmessage = handleMessage;
    
    return () => {
      musicWorkerRef.current?.terminate();
      audioPlayer.stop();
    };
  }, [toast]);
  
  const handleInstrumentChange = (part: keyof Instruments) => (value: Instruments[keyof Instruments]) => {
    const newInstruments = { ...instruments, [part]: value };
    setInstruments(newInstruments);
     if(isPlaying) {
      musicWorkerRef.current?.postMessage({ command: 'set_instruments', data: newInstruments });
    }
  };

  const handleDrumsToggle = (checked: boolean) => {
    setDrumsEnabled(checked);
    if(isPlaying) {
      musicWorkerRef.current?.postMessage({ command: 'toggle_drums', data: checked });
    }
  }
  
  const handlePlay = async () => {
    setIsLoading(true);
    try {
      if (!isInitializedRef.current) {
        await audioPlayer.initialize();
        isInitializedRef.current = true;
      }
      
      musicWorkerRef.current?.postMessage({ command: 'start', data: { instruments, drumsEnabled } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
      setIsPlaying(false);
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    audioPlayer.stop();
    setIsPlaying(false);
    setIsLoading(false);
  };
  
  const handleTogglePlay = () => {
    if (isPlaying) {
      handleStop();
    } else {
      handlePlay();
    }
  };
  
  // --- TEMPORARY FUNCTION TO ENCODE SAMPLES ---
  const handleLoadAndEncodeSamples = async () => {
    const sampleFiles = {
      kick: '/assets/drums/kickdrum.wav',
      snare: '/assets/drums/snare.wav',
      closedHat: '/assets/drums/closed hi hat accented.wav',
      openHat: '/assets/drums/Open HH (Top) (2).wav',
      crash: '/assets/drums/Crash (1).wav',
    };

    const dataUris: { [key: string]: string } = {};
    
    console.log("Starting sample encoding...");

    try {
      for (const [name, url] of Object.entries(sampleFiles)) {
        console.log(`Fetching ${url}...`);
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
        }
        const blob = await response.blob();
        const reader = new FileReader();
        const dataUri = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        dataUris[name] = dataUri;
        console.log(`Successfully encoded ${name}.`);
      }

      console.log("--- COPY THE OBJECT BELOW ---");
      console.log(JSON.stringify(dataUris, null, 2));
      console.log("--- PASTE IT IN THE CHAT ---");
      
      toast({
        title: "Encoding Successful",
        description: "Sample data has been logged to the console. Please copy it.",
      });

    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
       console.error("Error encoding samples:", errorMessage);
       toast({
          variant: "destructive",
          title: "Encoding Failed",
          description: errorMessage,
       });
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
                <SelectItem value="bass guitar">Bass Guitar</SelectItem>
              </SelectContent>
            </Select>
          </div>
           {/*
           <div className="flex items-center justify-between pt-2">
            <Label htmlFor="drums-enabled" className="text-right">Drums</Label>
            <Switch
              id="drums-enabled"
              checked={drumsEnabled}
              onCheckedChange={handleDrumsToggle}
              disabled={isLoading}
            />
          </div>
          */}
        </div>
         {isLoading && (
            <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 min-h-[40px]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p>{loadingText}</p>
            </div>
        )}
        {!isLoading && !isPlaying && (
            <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Select your instruments and press Start to generate an ever-evolving soundscape.
            </p>
        )}
        {isPlaying && (
             <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 min-h-[40px]">
                <p>Playing...</p>
            </div>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-4">
        {/* TEMPORARY BUTTON */}
        <Button
          type="button"
          onClick={handleLoadAndEncodeSamples}
          variant="outline"
          className="w-full"
        >
          Encode Samples
        </Button>
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
            <Play className="mr-2 h-6 w-6" />
          )}
          {isLoading ? "Loading..." : isPlaying ? "Stop" : "Start"}
        </Button>
      </CardFooter>
    </Card>
  );
}

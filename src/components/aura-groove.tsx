"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Pause, Play, Drum } from "lucide-react";
import { audioPlayer, Instruments } from "@/lib/audio-player";
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
import { Switch } from "@/components/ui/switch";
import { Logo } from "@/components/icons";

export function AuraGroove() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [drumsEnabled, setDrumsEnabled] = useState(true);
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
      } else if (type === 'loading_complete') {
        setIsLoading(false);
        audioPlayer.start();
        setIsPlaying(true);
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
    musicWorkerRef.current?.postMessage({ command: 'set_instruments', data: newInstruments });
  };
  
  const handleDrumsToggle = (enabled: boolean) => {
    setDrumsEnabled(enabled);
    musicWorkerRef.current?.postMessage({ command: 'toggle_drums', data: enabled });
  };

  const handlePlay = async () => {
    setIsLoading(true);
    try {
      if (!isInitializedRef.current) {
        await audioPlayer.initialize();
        isInitializedRef.current = true;
      }
      
      musicWorkerRef.current?.postMessage({ command: 'start', data: { instruments, drumsEnabled } });
      // We now wait for a 'loading_complete' message from the worker before starting the player
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
  };
  
  const handleTogglePlay = () => {
    if (isPlaying) {
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
              disabled={isLoading || isPlaying}
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
              disabled={isLoading || isPlaying}
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
              disabled={isLoading || isPlaying}
            >
              <SelectTrigger id="bass-instrument" className="col-span-2">
                <SelectValue placeholder="Select instrument" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bass guitar">Bass Guitar</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 items-center gap-4">
            <Label htmlFor="drums-toggle" className="text-right flex items-center gap-2">
                <Drum className="h-5 w-5" />
                Drums
            </Label>
            <div className="col-span-2">
                <Switch
                    id="drums-toggle"
                    checked={drumsEnabled}
                    onCheckedChange={handleDrumsToggle}
                    disabled={isLoading || isPlaying}
                />
            </div>
          </div>
        </div>
         {isLoading && (
            <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 min-h-[40px]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p>Loading samples...</p>
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
      <CardFooter>
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

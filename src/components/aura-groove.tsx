"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Pause, Play } from "lucide-react";
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
import { Logo } from "@/components/icons";

export function AuraGroove() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [instruments, setInstruments] = useState<Instruments>({
    solo: "synthesizer",
    accompaniment: "piano",
    bass: "bass guitar",
  });
  const { toast } = useToast();

  const soloWorkerRef = useRef<Worker>();
  const accompanimentWorkerRef = useRef<Worker>();
  const bassWorkerRef = useRef<Worker>();

  useEffect(() => {
    // Initialize workers
    soloWorkerRef.current = new Worker(new URL('../lib/workers/solo.worker.ts', import.meta.url));
    accompanimentWorkerRef.current = new Worker(new URL('../lib/workers/accompaniment.worker.ts', import.meta.url));
    bassWorkerRef.current = new Worker(new URL('../lib/workers/bass.worker.ts', import.meta.url));

    // Set up message handlers
    const handleMessage = (event: MessageEvent) => {
      const { type, note, part } = event.data;
      if (type === 'note' && part) {
        audioPlayer.playNote(part, note);
      }
    };

    soloWorkerRef.current.onmessage = handleMessage;
    accompanimentWorkerRef.current.onmessage = handleMessage;
    bassWorkerRef.current.onmessage = handleMessage;
    
    return () => {
      // Terminate workers on component unmount
      soloWorkerRef.current?.terminate();
      accompanimentWorkerRef.current?.terminate();
      bassWorkerRef.current?.terminate();
    };
  }, []);

  const handleInstrumentChange = (part: keyof Instruments) => (value: Instruments[keyof Instruments]) => {
    setInstruments(prev => ({ ...prev, [part]: value }));
    if (isPlaying) {
      audioPlayer.setInstrument(part, value);
    }
  };

  const handlePlay = async () => {
    setIsLoading(true);
    try {
      await audioPlayer.initialize(instruments);
      soloWorkerRef.current?.postMessage({ command: 'start' });
      accompanimentWorkerRef.current?.postMessage({ command: 'start' });
      bassWorkerRef.current?.postMessage({ command: 'start' });
      setIsPlaying(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      toast({
        variant: "destructive",
        title: "Error",
        description: errorMessage,
      });
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    soloWorkerRef.current?.postMessage({ command: 'stop' });
    accompanimentWorkerRef.current?.postMessage({ command: 'stop' });
    bassWorkerRef.current?.postMessage({ command: 'stop' });
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
  
  // Update instruments in the audio player when they change
  useEffect(() => {
    if (isPlaying) {
      audioPlayer.setInstrument('solo', instruments.solo);
      audioPlayer.setInstrument('accompaniment', instruments.accompaniment);
      audioPlayer.setInstrument('bass', instruments.bass);
    }
  }, [instruments, isPlaying]);

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
        </div>
         {isLoading && (
            <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 min-h-[40px]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p>Starting audio engine...</p>
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
          {isLoading ? "Starting..." : isPlaying ? "Stop" : "Start"}
        </Button>
      </CardFooter>
    </Card>
  );
}

    
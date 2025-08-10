
"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Pause, Play } from "lucide-react";
// import { audioPlayer } from "@/lib/audio-player";
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
  const [drumsEnabled, setDrumsEnabled] = useState(true);
  const [instruments, setInstruments] = useState<Instruments>({
    solo: "synthesizer",
    accompaniment: "piano",
    bass: "bass guitar",
  });
  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  // const isInitializedRef = useRef(false);

  useEffect(() => {
    musicWorkerRef.current = new Worker('/workers/ambient.worker.js');

    const handleMessage = (event: MessageEvent) => {
      const { type, message } = event.data;
      console.log('Message from worker:', event.data);
      
      if (type === 'decode_success') {
        toast({
            title: "Worker Test Successful",
            description: message,
        });
        setIsLoading(false);
        setIsPlaying(false);
      } else if (type === 'decode_error') {
         toast({
            variant: "destructive",
            title: "Worker Test Failed",
            description: message,
         });
         handleStop();
      }
    };

    musicWorkerRef.current.onmessage = handleMessage;
    
    return () => {
      musicWorkerRef.current?.terminate();
      // audioPlayer.stop();
    };
  }, [toast]);
  
  const handleInstrumentChange = (part: keyof Instruments) => (value: Instruments[keyof Instruments]) => {
    const newInstruments = { ...instruments, [part]: value };
    setInstruments(newInstruments);
  };


  const handleDrumsToggle = (checked: boolean) => {
    setDrumsEnabled(checked);
  }

  // This function now only serves to test the worker's decoding capability.
  const testWorkerDecode = async () => {
      setIsLoading(true);
      setLoadingText("Testing worker...");
      console.log('Starting worker test...');

      try {
        const sampleUrl = '/assets/drums/snare.wav';
        console.log(`Fetching sample from: ${sampleUrl}`);
        const response = await fetch(sampleUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${sampleUrl}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        console.log(`Sample fetched successfully. Size: ${arrayBuffer.byteLength} bytes.`);
        
        musicWorkerRef.current?.postMessage({
            command: 'test_decode',
            data: { arrayBuffer }
        }, [arrayBuffer]); // Transfer the ArrayBuffer
        console.log('Sent test_decode command to worker.');

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        console.error("Error in testWorkerDecode:", errorMessage);
        toast({
            variant: "destructive",
            title: "Test Error",
            description: errorMessage,
        });
        setIsLoading(false);
      }
  };


  const handlePlay = async () => {
    await testWorkerDecode();
  };

  const handleStop = () => {
    // musicWorkerRef.current?.postMessage({ command: 'stop' });
    // audioPlayer.stop();
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
              disabled={true}
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
              disabled={true}
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
              disabled={true}
            >
              <SelectTrigger id="bass-instrument" className="col-span-2">
                <SelectValue placeholder="Select instrument" />
              </SelectTrigger>
              <SelectContent>
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
                disabled={true}
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
         {!isLoading && (
            <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Ready to run worker test.
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
          ) : (
            <Play className="mr-2 h-6 w-6" />
          )}
          {isLoading ? loadingText : "Run Worker Test"}
        </Button>
      </CardFooter>
    </Card>
  );
}

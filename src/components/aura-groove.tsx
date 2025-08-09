"use client";

import { useState } from "react";
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
import { Logo } from "@/components/icons";
import { generateFractalMusic } from "@/lib/fractal-music-generator";

export function AuraGroove() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // We can keep this for potential future async operations
  const { toast } = useToast();

  const handlePlay = async () => {
    setIsLoading(true);
    try {
      // Generate music client-side
      const { musicData, instruments } = generateFractalMusic();
      
      await audioPlayer.play(musicData, instruments);
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
        <CardDescription>Fractal-powered ambient music generator</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 flex items-center justify-center min-h-[196px]">
        <p className="text-muted-foreground text-center">
          Press Start to generate an ever-evolving soundscape using mathematical patterns.
        </p>
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
          {isLoading ? "Generating..." : isPlaying ? "Stop" : "Start"}
        </Button>
      </CardFooter>
    </Card>
  );
}

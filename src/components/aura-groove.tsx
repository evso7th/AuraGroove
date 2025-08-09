"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Music, Pause, Play } from "lucide-react";
import { handleGenerateMusic } from "@/app/actions";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Logo } from "@/components/icons";

const FormSchema = z.object({
  soloInstrument: z.enum(['synthesizer', 'organ', 'piano']),
  accompanimentInstrument: z.enum(['synthesizer', 'organ', 'piano']),
  bassInstrument: z.enum(['bass guitar']),
});

type FormData = z.infer<typeof FormSchema>;

export function AuraGroove() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      soloInstrument: "synthesizer",
      accompanimentInstrument: "piano",
      bassInstrument: "bass guitar",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const result = await handleGenerateMusic(data);
      if (result.error) {
        throw new Error(result.error);
      }
      if (result.data) {
        await audioPlayer.play(result.data, data);
        setIsPlaying(true);
      }
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
      form.handleSubmit(onSubmit)();
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
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-6">
            <FormField
              control={form.control}
              name="soloInstrument"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Solo Instrument</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isPlaying || isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an instrument" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="synthesizer">Synthesizer</SelectItem>
                      <SelectItem value="organ">Organ</SelectItem>
                      <SelectItem value="piano">Piano</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="accompanimentInstrument"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Accompaniment Instrument</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isPlaying || isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an instrument" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="synthesizer">Synthesizer</SelectItem>
                      <SelectItem value="organ">Organ</SelectItem>
                      <SelectItem value="piano">Piano</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bassInstrument"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bass Instrument</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isPlaying || isLoading}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an instrument" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bass guitar">Bass Guitar</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
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
        </form>
      </Form>
    </Card>
  );
}

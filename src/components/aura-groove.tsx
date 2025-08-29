
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { Loader2, Music, Pause, Speaker, FileMusic, Waves, ChevronsRight, Sparkles, SlidersHorizontal, Drum } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Logo from "@/components/icons";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { DrumMachine } from "@/lib/drum-machine";
import type { DrumSettings, EffectsSettings, InstrumentSettings, ScoreName, WorkletNote, DrumNote } from '@/types/music';

// Architectural constants
const SCORE_CHUNK_DURATION_IN_BARS = 8; // Generate 8 bars of music at a time

export function AuraGroove() {
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); 
  const [loadingText, setLoadingText] = useState("Initializing...");

  // --- State for Music Settings ---
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({ pattern: 'none', volume: 0.7 });
  const [effectsSettings, setEffectsSettings] = useState<EffectsSettings>({ mode: 'none', volume: 0.7 });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    solo: { name: "none", volume: 0.8 },
    accompaniment: { name: "synthesizer", volume: 0.7 },
    bass: { name: "none", volume: 0.9 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('evolve');
  
  const { toast } = useToast();

  // --- Refs for Worker and Audio components ---
  const musicWorkerRef = useRef<Worker | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const drumMachineRef = useRef<DrumMachine | null>(null);
  const drumChannelRef = useRef<Tone.Channel | null>(null);
  const nextScheduleTimeRef = useRef<number>(0);
  const scoreRequestLoopIdRef = useRef<number | null>(null);

  const requestNewScoreFromWorker = useCallback(() => {
    console.log("[UI_TRACE] Requesting new score from worker.");
    if (musicWorkerRef.current) {
        musicWorkerRef.current.postMessage({ 
            command: 'request_new_score', 
            data: { chunkDurationInBars: SCORE_CHUNK_DURATION_IN_BARS } 
        });
    }
  }, []);

  const handlePlay = useCallback(async () => {
    console.log("[UI_TRACE] handlePlay called.");
    if (isInitializing || !isAudioReady || isPlaying) return;

    if (Tone.context.state !== 'running') {
        await Tone.start();
    }
    
    console.log("[UI_TRACE] Sending 'start' command to worker.");
    const settings = { drumSettings, instrumentSettings, effectsSettings, bpm, score };
    musicWorkerRef.current?.postMessage({ command: 'start', data: settings });

    if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
    }
    
    if (scoreRequestLoopIdRef.current !== null) {
      Tone.Transport.clear(scoreRequestLoopIdRef.current);
    }
    scoreRequestLoopIdRef.current = Tone.Transport.scheduleRepeat(() => {
        requestNewScoreFromWorker();
    }, `${SCORE_CHUNK_DURATION_IN_BARS}m`);

    setIsPlaying(true);
  }, [isInitializing, isAudioReady, isPlaying, drumSettings, instrumentSettings, effectsSettings, bpm, score, requestNewScoreFromWorker]);

  const handleStop = useCallback(() => {
    console.log("[UI_TRACE] handleStop called.");
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    workletNodeRef.current?.port.postMessage({ type: 'clear' });
    drumMachineRef.current?.stopAll();
    
    if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.pause();
    }
    if (scoreRequestLoopIdRef.current !== null) {
        Tone.Transport.clear(scoreRequestLoopIdRef.current);
        scoreRequestLoopIdRef.current = null;
    }
    nextScheduleTimeRef.current = 0;
    
    setIsPlaying(false);
  }, []);
  
  const handleTogglePlay = useCallback(() => {
    if (isInitializing) return;
    isPlaying ? handleStop() : handlePlay();
  }, [isInitializing, isPlaying, handleStop, handlePlay]);

  // --- Main Initialization Effect ---
  useEffect(() => {
    const initAudio = async () => {
      try {
        setIsInitializing(true);
        setLoadingText("Initializing Audio System...");
        
        await Tone.start();
        const context = Tone.getContext().rawContext;
        audioContextRef.current = context;
        
        setLoadingText("Loading Synthesis Engine...");
        await context.audioWorklet.addModule('/workers/synth.worklet.js');
        
        const workletNode = new AudioWorkletNode(context, 'synth-processor', {
            outputChannelCount: [2]
        });
        workletNode.connect(context.destination);
        workletNodeRef.current = workletNode;
        
        setLoadingText("Initializing Drum Machine...");
        const drumChannel = new Tone.Channel(Tone.gainToDb(drumSettings.volume)).toDestination();
        drumChannelRef.current = drumChannel;
        const drums = new DrumMachine(drumChannel);
        await drums.waitForReady();
        drumMachineRef.current = drums;


        setLoadingText("Waking up the Composer...");
        const worker = new Worker(new URL('../app/ambient.worker.ts', import.meta.url));
        musicWorkerRef.current = worker;
        worker.postMessage({ command: 'init' });


        worker.onmessage = (event: MessageEvent) => {
            const { type, synthScore, drumScore, error } = event.data;
            console.log(`[UI_TRACE] Received message from worker: ${type}`, event.data);
            
            if (type === 'started') {
                 nextScheduleTimeRef.current = Tone.context.currentTime + 0.1;
                 requestNewScoreFromWorker();
            }
            else if (type === 'score_ready') {
                if (!isPlaying) return;

                Tone.Transport.scheduleOnce((time) => {
                    if (workletNodeRef.current && synthScore) {
                        workletNodeRef.current.port.postMessage({ type: 'schedule', score: synthScore, startTime: time });
                    }
                    if (drumMachineRef.current && drumScore) {
                        drumMachineRef.current.scheduleDrumScore(drumScore, time);
                    }
                }, nextScheduleTimeRef.current);
                
                const chunkDuration = (SCORE_CHUNK_DURATION_IN_BARS * 4 * 60) / bpm;
                nextScheduleTimeRef.current += chunkDuration;
            } else if (type === 'error') {
                toast({ variant: "destructive", title: "Worker Error", description: error });
                handleStop();
            } else if (type === 'stopped') {
                setIsPlaying(false);
            }
        };

        setLoadingText("");
        setIsAudioReady(true);
        setIsInitializing(false);

      } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          toast({ variant: "destructive", title: "Initialization Failed", description: errorMsg });
          setIsInitializing(false);
      }
    };

    initAudio();

    return () => {
      handleStop();
      musicWorkerRef.current?.terminate();
      if (scoreRequestLoopIdRef.current !== null) {
          Tone.Transport.clear(scoreRequestLoopIdRef.current);
      }
      workletNodeRef.current?.disconnect();
      drumMachineRef.current?.stopAll();
      drumChannelRef.current?.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Worker Communication for Settings ---
  useEffect(() => {
      if (musicWorkerRef.current && isAudioReady && !isInitializing) {
          const settings = { instrumentSettings, drumSettings, effectsSettings, bpm, score };
          musicWorkerRef.current.postMessage({ command: 'update_settings', data: settings });
      }
  }, [instrumentSettings, drumSettings, effectsSettings, bpm, score, isAudioReady, isInitializing]);

  useEffect(() => {
    if (drumChannelRef.current) {
        drumChannelRef.current.volume.value = Tone.gainToDb(drumSettings.volume);
    }
  }, [drumSettings.volume]);
  
   useEffect(() => {
      if (isAudioReady) {
        Tone.Transport.bpm.value = bpm;
      }
  }, [bpm, isAudioReady]);


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
            <h3 className="text-lg font-medium text-primary flex items-center gap-2"><FileMusic className="h-5 w-5"/> Composition</h3>
            <div className="grid grid-cols-3 items-center gap-4">
                 <Label htmlFor="score-selector" className="text-right">Style</Label>
                 <Select
                    value={score}
                    onValueChange={(v) => setScore(v as ScoreName)}
                    disabled={isInitializing || isPlaying}
                    >
                    <SelectTrigger id="score-selector" className="col-span-2">
                        <SelectValue placeholder="Select score" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="evolve">Evolve (L-Logic)</SelectItem>
                        <SelectItem value="omega">Omega (Fractal)</SelectItem>
                        <SelectItem value="promenade">Promenade</SelectItem>
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
                    disabled={isInitializing}
                />
            </div>
        </div>
        
        <div className="space-y-4 rounded-lg border p-4">
           <h3 className="text-lg font-medium text-primary flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Instrument Channels</h3>
            {Object.entries(instrumentSettings).map(([part, settings]) => (
                 <div key={part} className="space-y-3 rounded-md border p-3">
                     <div className="flex justify-between items-center">
                        <Label htmlFor={`${part}-instrument`} className="font-semibold flex items-center gap-2 capitalize"><Music className="h-5 w-5" /> {part}</Label>
                         <Select
                          value={settings.name}
                          onValueChange={(v) => setInstrumentSettings(i => ({...i, [part]: {...i[part as keyof InstrumentSettings], name: v}}))}
                          disabled={isInitializing || isPlaying}
                        >
                          <SelectTrigger id={`${part}-instrument`} className="w-[150px]">
                            <SelectValue placeholder="Select instrument" />
                          </SelectTrigger>
                          <SelectContent>
                             <SelectItem value="none">None</SelectItem>
                             {part === 'bass' ? <>
                                <SelectItem value="bass_synth">Bass Synth</SelectItem>
                                <SelectItem value="bassGuitar">Bass Guitar</SelectItem>
                             </> : <>
                                <SelectItem value="synthesizer">Synthesizer</SelectItem>
                                <SelectItem value="piano">Piano</SelectItem>
                                <SelectItem value="organ">Organ</SelectItem>
                             </>}
                          </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-2 pt-2">
                         <div className="flex items-center justify-between">
                             <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                             <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.volume * 100)}</span>
                         </div>
                         <Slider value={[settings.volume]} max={1} step={0.05} onValueChange={(v) => setInstrumentSettings(s => ({...s, [part]: {...s[part as keyof InstrumentSettings], volume: v[0]}}))} disabled={isInitializing || isPlaying || settings.name === 'none'} />
                    </div>
                 </div>
            ))}
        </div>

        <div className="space-y-3 rounded-lg border p-4">
            <h3 className="text-lg font-medium text-primary flex items-center gap-2"><Drum className="h-5 w-5" /> Drums</h3>
             <div className="space-y-3 rounded-md border p-3">
                 <div className="flex justify-between items-center">
                    <Label htmlFor="drum-pattern" className="font-semibold flex items-center gap-2 capitalize">Pattern</Label>
                     <Select
                      value={drumSettings.pattern}
                      onValueChange={(v) => setDrumSettings(d => ({...d, pattern: v as 'ambient_beat' | 'composer' | 'none'}))}
                      disabled={isInitializing || isPlaying}
                    >
                      <SelectTrigger id="drum-pattern" className="w-[150px]">
                        <SelectValue placeholder="Select pattern" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="ambient_beat">Ambient Beat</SelectItem>
                        <SelectItem value="composer">Composer</SelectItem>
                      </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2 pt-2">
                     <div className="flex items-center justify-between">
                         <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                         <span className="text-xs font-mono text-muted-foreground">{Math.round(drumSettings.volume * 100)}</span>
                     </div>
                     <Slider value={[drumSettings.volume]} max={1} step={0.05} onValueChange={(v) => setDrumSettings(d => ({...d, volume: v[0]}))} disabled={isInitializing || isPlaying || drumSettings.pattern === 'none'} />
                </div>
             </div>
        </div>
         
         {isInitializing && (
            <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 min-h-[40px]">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p>{loadingText || "Loading..."}</p>
            </div>
        )}
         {!isInitializing && !isPlaying && (
            <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Press play to start the music.
            </p>
        )}
        {!isInitializing && isPlaying && (
             <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Playing at {bpm} BPM...
            </p>
        )}
      </CardContent>
      <CardFooter className="flex-col gap-4">
        <div className="flex gap-2 w-full">
          <Button
            type="button"
            onClick={handleTogglePlay}
            disabled={isInitializing}
            className="w-full text-lg py-6"
          >
            {isInitializing ? (
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            ) : isPlaying ? (
              <Pause className="mr-2 h-6 w-6" />
            ) : (
              <Music className="mr-2 h-6 w-6" />
            )}
            {isInitializing ? loadingText : isPlaying ? "Stop" : "Play"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

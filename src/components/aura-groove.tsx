
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { Drum, Loader2, Music, Pause, Speaker, FileMusic, Waves, Wind, ToyBrick, GitBranch, ChevronsRight, Sparkles } from "lucide-react";
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
import type { FxBus } from "@/lib/fx-bus";
import type { BassSynthManager } from "@/lib/bass-synth-manager";
import type { SoloSynthManager } from "@/lib/solo-synth-manager";
import type { AccompanimentSynthManager } from "@/lib/accompaniment-synth-manager";
import type { EffectsSynthManager } from "@/lib/effects-synth-manager";
import { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote } from '@/types/music';


export type Instruments = {
  solo: 'synthesizer' | 'piano' | 'organ' | 'none';
  accompaniment: 'synthesizer' | 'piano' | 'organ' | 'none';
  bass: 'bass synth' | 'none';
};

export type DrumSettings = {
    enabled: boolean;
    pattern: 'basic' | 'breakbeat' | 'slow' | 'heavy';
    volume: number;
};

export type ScoreName = 'generative' | 'promenade';

const samplePaths: Record<string, string> = {
    kick: '/assets/drums/kick_drum6.wav',
    snare: '/assets/drums/snare.wav',
    hat: '/assets/drums/closed_hi_hat_accented.wav',
    crash: '/assets/drums/crash1.wav',
    ride: '/assets/drums/cymbal1.wav',
};

export function AuraGroove() {
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); 
  const [loadingText, setLoadingText] = useState("Initializing...");
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({
      enabled: true,
      pattern: 'basic',
      volume: 0.85,
  });
  const [instruments, setInstruments] = useState<Instruments>({
    solo: "organ",
    accompaniment: "organ",
    bass: "bass synth",
  });
  const [bpm, setBpm] = useState(100);
  const [score, setScore] = useState<ScoreName>('generative');
  
  // Instrument FX States
  const [soloFx, setSoloFx] = useState({ distortion: { enabled: false, wet: 0.5 } });
  const [accompanimentFx, setAccompanimentFx] = useState({ chorus: { enabled: false, wet: 0.4, frequency: 1.5, depth: 0.7 } });

  // Master FX States
  const [masterReverbSettings, setMasterReverbSettings] = useState({ enabled: true, wet: 0.3, decay: 4.5 });
  const [masterDelaySettings, setMasterDelaySettings] = useState({ enabled: true, wet: 0.2, delayTime: 0.5, feedback: 0.3 });
  
  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  const fxBusRef = useRef<FxBus | null>(null);
  const bassSynthManagerRef = useRef<BassSynthManager | null>(null);
  const soloSynthManagerRef = useRef<SoloSynthManager | null>(null);
  const accompanimentSynthManagerRef = useRef<AccompanimentSynthManager | null>(null);
  const effectsSynthManagerRef = useRef<EffectsSynthManager | null>(null);
  const drumPlayersRef = useRef<Tone.Players | null>(null);

   useEffect(() => {
    setLoadingText("Initializing Worker...");
    
    const worker = new Worker(new URL('../app/ambient.worker.ts', import.meta.url));
    musicWorkerRef.current = worker;
    
    const initializeAudioEngine = async () => {
        setLoadingText("Initializing Audio Engine...");
        try {
            const { FxBus } = await import('@/lib/fx-bus');
            fxBusRef.current = new FxBus();
            
            const { BassSynthManager } = await import('@/lib/bass-synth-manager');
            bassSynthManagerRef.current = new BassSynthManager(fxBusRef.current);

            const { SoloSynthManager } = await import('@/lib/solo-synth-manager');
            soloSynthManagerRef.current = new SoloSynthManager(fxBusRef.current);
            
            const { AccompanimentSynthManager } = await import('@/lib/accompaniment-synth-manager');
            accompanimentSynthManagerRef.current = new AccompanimentSynthManager(fxBusRef.current);

            const { EffectsSynthManager } = await import('@/lib/effects-synth-manager');
            effectsSynthManagerRef.current = new EffectsSynthManager(fxBusRef.current);
            
            setLoadingText("Loading Samples...");
            await loadSamples(fxBusRef.current);

        } catch (error) {
             console.error("Audio initialization failed:", error);
             toast({
                variant: "destructive",
                title: "Failed to initialize audio components",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
            setLoadingText("Error initializing audio.");
            setIsInitializing(false);
        }
    };


    const handleMessage = (event: MessageEvent) => {
      const { type, data, error } = event.data;
      
      switch(type) {
        case 'initialized':
           initializeAudioEngine();
          break;
        
        case 'started':
             setIsInitializing(false);
             setLoadingText("");
             setIsPlaying(true);
             break;

        case 'drum_score':
            if (drumPlayersRef.current && data.score && data.score.length > 0) {
                 const now = Tone.now();
                 data.score.forEach((note: DrumNote) => {
                    const player = drumPlayersRef.current?.player(note.sample);
                    if (player && player.loaded) {
                        player.start(now + note.time, 0, undefined, note.velocity ? drumSettings.volume * note.velocity : drumSettings.volume);
                    }
                });
            }
            break;

        case 'bass_score':
             if (bassSynthManagerRef.current && data.score && data.score.length > 0) {
                const now = Tone.now();
                data.score.forEach((note: BassNote) => {
                    bassSynthManagerRef.current?.triggerAttackRelease(
                        note.note,
                        note.duration,
                        now + note.time,
                        note.velocity
                    );
                });
            }
            break;
        
        case 'solo_score':
            if (soloSynthManagerRef.current && data.score && data.score.length > 0) {
                const now = Tone.now();
                data.score.forEach((note: SoloNote) => {
                    soloSynthManagerRef.current?.triggerAttackRelease(
                        note.notes,
                        note.duration,
                        now + note.time
                    );
                });
            }
            break;
        
        case 'accompaniment_score':
            if (accompanimentSynthManagerRef.current && data.score && data.score.length > 0) {
                const now = Tone.now();
                data.score.forEach((note: AccompanimentNote) => {
                    accompanimentSynthManagerRef.current?.triggerAttackRelease(
                        note.notes,
                        note.duration,
                        now + note.time
                    );
                });
            }
            break;
        
        case 'effects_score':
            if (effectsSynthManagerRef.current && data.score && data.score.length > 0) {
                const now = Tone.now();
                data.score.forEach((note: EffectNote) => {
                    effectsSynthManagerRef.current?.trigger(
                        note,
                        now + note.time
                    );
                });
            }
            break;

        case 'stopped':
            setIsPlaying(false);
            setLoadingText("");
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
    
    const loadSamples = async (fxBus: FxBus) => {
        try {
            const fetchedSamples = await Promise.all(
                Object.entries(samplePaths).map(async ([name, url]) => {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch sample: ${name}`);
                    }
                    const buffer = await response.arrayBuffer();
                    return { name, buffer };
                })
            );

            const mainThreadSampleMap: Record<string, AudioBuffer> = {};
            
            await Promise.all(fetchedSamples.map(async ({ name, buffer }) => {
                const mainBuffer = await Tone.context.decodeAudioData(buffer.slice(0));
                mainThreadSampleMap[name] = mainBuffer;
            }));

            drumPlayersRef.current = new Tone.Players(mainThreadSampleMap).connect(fxBus.drumInput);

            setLoadingText("");
            setIsReady(true);
            setIsInitializing(false);

        } catch (error) {
            console.error("Sample loading failed:", error);
            toast({
                variant: "destructive",
                title: "Failed to load audio samples",
                description: error instanceof Error ? error.message : "An unknown error occurred.",
            });
            setLoadingText("Error loading samples.");
            setIsInitializing(false);
        }
    };
    
    musicWorkerRef.current?.postMessage({ command: 'init' });

    
    return () => {
      if (musicWorkerRef.current) {
        musicWorkerRef.current.terminate();
      }
      bassSynthManagerRef.current?.dispose();
      soloSynthManagerRef.current?.dispose();
      accompanimentSynthManagerRef.current?.dispose();
      effectsSynthManagerRef.current?.dispose();
      drumPlayersRef.current?.dispose();
      fxBusRef.current?.dispose();
      if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      }
    };
  }, [toast]); 
  
  const updateWorkerSettings = useCallback(() => {
    if (musicWorkerRef.current && (isPlaying || isInitializing)) {
        musicWorkerRef.current?.postMessage({
            command: 'update_settings',
            data: { instruments, drumSettings, bpm, score },
        });
    }
  }, [instruments, drumSettings, bpm, score, isPlaying, isInitializing]);

  useEffect(() => {
    if (isReady && isPlaying) { 
      updateWorkerSettings();
    }
  }, [drumSettings, instruments, bpm, score, isReady, isPlaying, updateWorkerSettings]);

   useEffect(() => {
        if (!isReady || !fxBusRef.current) return;
        fxBusRef.current.masterReverb.wet.value = masterReverbSettings.enabled ? masterReverbSettings.wet : 0;
        fxBusRef.current.masterReverb.decay = masterReverbSettings.decay;
    }, [masterReverbSettings, isReady]);

    useEffect(() => {
        if (!isReady || !fxBusRef.current) return;
        const fx = fxBusRef.current.masterDelay;
        fx.wet.value = masterDelaySettings.enabled ? masterDelaySettings.wet : 0;
        fx.delayTime.value = masterDelaySettings.delayTime;
        fx.feedback.value = masterDelaySettings.feedback;
    }, [masterDelaySettings, isReady]);

    useEffect(() => {
        if (!isReady || !fxBusRef.current?.soloDistortion) return;
        const fx = fxBusRef.current.soloDistortion;
        fx.wet.value = soloFx.distortion.enabled ? soloFx.distortion.wet : 0;
    }, [soloFx.distortion, isReady]);

    useEffect(() => {
        if (!isReady || !fxBusRef.current?.accompanimentChorus) return;
        const fx = fxBusRef.current.accompanimentChorus;
        fx.wet.value = accompanimentFx.chorus.enabled ? accompanimentFx.chorus.wet : 0;
        fx.frequency.value = accompanimentFx.chorus.frequency;
        fx.depth = accompanimentFx.chorus.depth;
    }, [accompanimentFx.chorus, isReady]);

  
  const handlePlay = useCallback(async () => {
    try {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }

        if (!musicWorkerRef.current || !fxBusRef.current || !bassSynthManagerRef.current || !soloSynthManagerRef.current || !accompanimentSynthManagerRef.current || !effectsSynthManagerRef.current) {
            setIsInitializing(true);
            setLoadingText("Waiting for audio engine...");
            return;
        }

        soloSynthManagerRef.current?.setInstrument(instruments.solo);
        accompanimentSynthManagerRef.current?.setInstrument(instruments.accompaniment);
        bassSynthManagerRef.current?.setInstrument(instruments.bass);

        setIsInitializing(true);
        setLoadingText("Starting playback...");
        
        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
        
        musicWorkerRef.current.postMessage({
            command: 'start',
            data: { drumSettings, instruments, bpm, score }
        });

    } catch (error) {
        console.error("Failed to prepare audio:", error);
        toast({
            variant: "destructive",
            title: "Audio Error",
            description: `Could not start audio. ${error instanceof Error ? error.message : ''}`,
        });
        setIsInitializing(false);
        setLoadingText("");
    }
  }, [drumSettings, instruments, bpm, score, toast]);

  const handleStop = useCallback(() => {
    soloSynthManagerRef.current?.fadeOut(1);
    accompanimentSynthManagerRef.current?.fadeOut(1);
    bassSynthManagerRef.current?.releaseAll();
    
    if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
        Tone.Transport.cancel();
    }
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    
  }, []);
  
  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      handleStop();
    } else {
      handlePlay();
    }
  }, [isPlaying, handleStop, handlePlay]);

  const handleTestMixer = useCallback(async () => {
    if(!fxBusRef.current) return;
    if (Tone.context.state !== 'running') {
        await Tone.start();
    }
    if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
    }

    const soloSynth = new Tone.Synth().connect(fxBusRef.current.soloInput);
    const accompSynth = new Tone.Synth().connect(fxBusRef.current.accompanimentInput);
    const bassSynth = new Tone.Synth().connect(fxBusRef.current.bassInput);
    const sfxSynth = new Tone.MetalSynth().connect(fxBusRef.current.effectsInput);

    const now = Tone.now();
    soloSynth.triggerAttackRelease("C5", "8n", now);
    accompSynth.triggerAttackRelease("E4", "8n", now + 0.5);
    bassSynth.triggerAttackRelease("G3", "8n", now + 1);
    drumPlayersRef.current?.player("kick").start(now + 1.5);
    sfxSynth.triggerAttackRelease("C6", "16n", now + 2);

    
    Tone.Transport.scheduleOnce((time) => {
        soloSynth.dispose();
        accompSynth.dispose();
        bassSynth.dispose();
        sfxSynth.dispose();
    }, now + 3);


  }, []);

  const isBusy = isInitializing || !isReady;
  const isGenerative = score === 'generative';

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
                 <Label htmlFor="score-selector" className="text-right">Score</Label>
                 <Select
                    value={score}
                    onValueChange={(v) => setScore(v as ScoreName)}
                    disabled={isBusy || isPlaying}
                    >
                    <SelectTrigger id="score-selector" className="col-span-2">
                        <SelectValue placeholder="Select score" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="generative">Smoke on the Water</SelectItem>
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
                    disabled={isBusy || isPlaying}
                />
            </div>
        </div>
        
        <div className="space-y-4 rounded-lg border p-4">
           <h3 className="text-lg font-medium text-primary flex items-center gap-2"><GitBranch className="h-5 w-5" /> Instrument Channels</h3>

           {/* Solo Channel */}
            <div className="space-y-3 rounded-md border p-3">
                <Label htmlFor="solo-instrument" className="font-semibold">Solo</Label>
                <Select
                  value={instruments.solo}
                  onValueChange={(v) => setInstruments(i => ({...i, solo: v as Instruments['solo']}))}
                  disabled={isBusy || isPlaying}
                >
                  <SelectTrigger id="solo-instrument">
                    <SelectValue placeholder="Select instrument" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="synthesizer" disabled>Synthesizer</SelectItem>
                    <SelectItem value="piano" disabled>Piano</SelectItem>
                    <SelectItem value="organ">Organ</SelectItem>
                  </SelectContent>
                </Select>
                 <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="solo-dist-enabled" className="flex items-center gap-1.5"><ChevronsRight className="h-4 w-4"/> Distortion</Label>
                        <Switch id="solo-dist-enabled" checked={soloFx.distortion.enabled} onCheckedChange={(c) => setSoloFx(s => ({...s, distortion: {...s.distortion, enabled: c}}))} disabled={isBusy || isPlaying} />
                    </div>
                    <Label className="text-xs text-muted-foreground">Amount</Label>
                    <Slider value={[soloFx.distortion.wet]} max={1} step={0.05} onValueChange={(v) => setSoloFx(s => ({...s, distortion: {...s.distortion, wet: v[0]}}))} disabled={isBusy || isPlaying || !soloFx.distortion.enabled} />
                </div>
            </div>

            {/* Accompaniment Channel */}
            <div className="space-y-3 rounded-md border p-3">
                <Label htmlFor="accompaniment-instrument" className="font-semibold">Accompaniment</Label>
                 <Select
                  value={instruments.accompaniment}
                  onValueChange={(v) => setInstruments(i => ({...i, accompaniment: v as Instruments['accompaniment']}))}
                  disabled={isBusy || isPlaying}
                >
                  <SelectTrigger id="accompaniment-instrument">
                    <SelectValue placeholder="Select instrument" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="synthesizer" disabled>Synthesizer</SelectItem>
                    <SelectItem value="piano" disabled>Piano</SelectItem>
                    <SelectItem value="organ">Organ</SelectItem>
                  </SelectContent>
                </Select>
                <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <Label htmlFor="accomp-chorus-enabled" className="flex items-center gap-1.5"><ChevronsRight className="h-4 w-4"/> Chorus</Label>
                        <Switch id="accomp-chorus-enabled" checked={accompanimentFx.chorus.enabled} onCheckedChange={(c) => setAccompanimentFx(s => ({...s, chorus: {...s.chorus, enabled: c}}))} disabled={isBusy || isPlaying} />
                    </div>
                    <Label className="text-xs text-muted-foreground">Wet</Label>
                    <Slider value={[accompanimentFx.chorus.wet]} max={1} step={0.05} onValueChange={(v) => setAccompanimentFx(s => ({...s, chorus: {...s.chorus, wet: v[0]}}))} disabled={isBusy || isPlaying || !accompanimentFx.chorus.enabled} />
                </div>
            </div>

            {/* Bass Channel */}
            <div className="space-y-3 rounded-md border p-3">
                <Label htmlFor="bass-instrument" className="font-semibold">Bass</Label>
                <Select
                    value={instruments.bass}
                    onValueChange={(v) => setInstruments(i => ({...i, bass: v as Instruments['bass']}))}
                    disabled={isBusy || isPlaying}
                    >
                    <SelectTrigger id="bass-instrument" className="w-full">
                        <SelectValue placeholder="Select instrument" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="bass synth">Bass Synth</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            {/* Drums Channel */}
            <div className="space-y-3 rounded-md border p-3">
                <Label className="font-semibold flex items-center gap-2"><Drum className="h-5 w-5"/> Drums</Label>
                <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="drums-enabled">Enable Drums</Label>
                    <Switch
                        id="drums-enabled"
                        checked={drumSettings.enabled}
                        onCheckedChange={(c) => setDrumSettings(d => ({ ...d, enabled: c }))}
                        disabled={isBusy || isPlaying || !isGenerative}
                    />
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="drum-pattern" className="text-right">Pattern</Label>
                    <Select
                        value={drumSettings.pattern}
                        onValueChange={(v) => setDrumSettings(d => ({ ...d, pattern: v as DrumSettings['pattern'] }))}
                        disabled={isBusy || isPlaying || !drumSettings.enabled || !isGenerative}
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
                        onValueChange={(v) => setDrumSettings(d => ({ ...d, volume: v[0] }))}
                        className="col-span-2"
                        disabled={isBusy || isPlaying || !drumSettings.enabled}
                    />
                </div>
            </div>

        </div>


        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-lg font-medium text-primary">Master Effects</h3>
            {/* Reverb Controls */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="reverb-enabled" className="flex items-center gap-1.5"><Wind className="h-4 w-4"/> Reverb</Label>
                    <Switch id="reverb-enabled" checked={masterReverbSettings.enabled} onCheckedChange={(c) => setMasterReverbSettings(s => ({...s, enabled: c}))} disabled={isBusy || isPlaying} />
                </div>
                <Label>Wet</Label>
                <Slider value={[masterReverbSettings.wet]} max={1} step={0.05} onValueChange={(v) => setMasterReverbSettings(s => ({...s, wet: v[0]}))} disabled={isBusy || isPlaying || !masterReverbSettings.enabled} />
                 <Label>Decay</Label>
                <Slider value={[masterReverbSettings.decay]} min={0.5} max={10} step={0.5} onValueChange={(v) => setMasterReverbSettings(s => ({...s, decay: v[0]}))} disabled={isBusy || isPlaying || !masterReverbSettings.enabled} />
            </div>
             {/* Delay Controls */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label htmlFor="delay-enabled" className="flex items-center gap-1.5"><Waves className="h-4 w-4"/> Delay</Label>
                    <Switch id="delay-enabled" checked={masterDelaySettings.enabled} onCheckedChange={(c) => setMasterDelaySettings(s => ({...s, enabled: c}))} disabled={isBusy || isPlaying} />
                </div>
                <Label>Wet</Label>
                <Slider value={[masterDelaySettings.wet]} max={1} step={0.05} onValueChange={(v) => setMasterDelaySettings(s => ({...s, wet: v[0]}))} disabled={isBusy || isPlaying || !masterDelaySettings.enabled} />
                <Label>Time</Label>
                <Slider value={[masterDelaySettings.delayTime]} max={1} step={0.1} onValueChange={(v) => setMasterDelaySettings(s => ({...s, delayTime: v[0]}))} disabled={isBusy || isPlaying || !masterDelaySettings.enabled} />
                <Label>Feedback</Label>
                <Slider value={[masterDelaySettings.feedback]} max={0.9} step={0.1} onValueChange={(v) => setMasterDelaySettings(s => ({...s, feedback: v[0]}))} disabled={isBusy || isPlaying || !masterDelaySettings.enabled} />
            </div>
             {/* Effects Channel Teaser */}
            <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-muted-foreground"><Sparkles className="h-4 w-4"/> Effects Channel</Label>
                     <Switch disabled={true} />
                </div>
                 <p className="text-xs text-muted-foreground">Control the new SFX channel here in the future.</p>
            </div>
        </div>
         
         {isBusy && (
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
        {!isBusy && isPlaying && (
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
          <Button
            type="button"
            onClick={handleTestMixer}
            disabled={isBusy || isPlaying}
            variant="outline"
          >
            Test Mixer
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

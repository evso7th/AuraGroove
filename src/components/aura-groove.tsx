
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { Drum, Loader2, Music, Pause, Speaker, FileMusic, Waves, ChevronsRight, Sparkles, SlidersHorizontal } from "lucide-react";
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
import { DrumMachine } from "@/lib/drum-machine";
import { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote, DrumSettings, EffectsSettings, InstrumentSettings, ScoreName } from '@/types/music';

const CONGESTION_THRESHOLD_MS = 50;

export function AuraGroove() {
  const [isReady, setIsReady] = useState(false);
  const [isDrumMachineReady, setIsDrumMachineReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); 
  const [loadingText, setLoadingText] = useState("Initializing...");
  const [drumSettings, setDrumSettings] = useState<DrumSettings>({
      pattern: 'ambient-beat',
      volume: 0.7,
  });
  const [effectsSettings, setEffectsSettings] = useState<EffectsSettings>({
    mode: 'none',
    volume: 0.7,
  });
  const [instrumentSettings, setInstrumentSettings] = useState<InstrumentSettings>({
    solo: { name: "synthesizer", volume: 0.8 },
    accompaniment: { name: "synthesizer", volume: 0.7 },
    bass: { name: "bassGuitar", volume: 0.5 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('evolve');
  
  // Instrument FX States
  const [soloFx, setSoloFx] = useState({ distortion: { enabled: false, wet: 0.5 } });
  const [accompanimentFx, setAccompanimentFx] = useState({ chorus: { enabled: false, wet: 0.4, frequency: 1.5, depth: 0.7 } });
  
  // Debug Panel State
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(true);

  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  const fxBusRef = useRef<FxBus | null>(null);
  const bassSynthManagerRef = useRef<BassSynthManager | null>(null);
  const soloSynthManagerRef = useRef<SoloSynthManager | null>(null);
  const accompanimentSynthManagerRef = useRef<AccompanimentSynthManager | null>(null);
  const effectsSynthManagerRef = useRef<EffectsSynthManager | null>(null);
  const drumMachineRef = useRef<DrumMachine | null>(null);
  const tickLoopRef = useRef<Tone.Loop | null>(null);
  
  // Refs for congestion tracking
  const lastWorkerResponseTimeRef = useRef<number>(0);
  const lastTickRequestTimeRef = useRef<number>(0);


   useEffect(() => {
    setLoadingText("Initializing Worker...");
    
    const worker = new Worker(new URL('../app/ambient.worker.ts', import.meta.url));
    musicWorkerRef.current = worker;
    
    setLoadingText("Loading audio modules...");
    import('@/lib/fx-bus').then(({ FxBus }) => {
        fxBusRef.current = new FxBus();
        setLoadingText("Mixer created.");
        
        drumMachineRef.current = new DrumMachine(fxBusRef.current, () => {
          setIsDrumMachineReady(true);
          setLoadingText("Drum samples loaded.");
        });

        import('@/lib/bass-synth-manager').then(({ BassSynthManager }) => {
            bassSynthManagerRef.current = new BassSynthManager(fxBusRef.current!);
            setLoadingText("Bass synth ready.");
        });
        import('@/lib/solo-synth-manager').then(({ SoloSynthManager }) => {
            soloSynthManagerRef.current = new SoloSynthManager(fxBusRef.current!);
             setLoadingText("Solo synth ready.");
        });
        import('@/lib/accompaniment-synth-manager').then(({ AccompanimentSynthManager }) => {
            accompanimentSynthManagerRef.current = new AccompanimentSynthManager(fxBusRef.current!);
             setLoadingText("Accompaniment synth ready.");
        });
         import('@/lib/effects-synth-manager').then(({ EffectsSynthManager }) => {
            effectsSynthManagerRef.current = new EffectsSynthManager(fxBusRef.current!);
             setLoadingText("Audio modules loaded.");
        });
    });

    const handleMessage = (event: MessageEvent) => {
      const { type, data, error } = event.data;

      switch(type) {
        case 'initialized':
           setIsReady(true);
           setLoadingText("");
          break;
        
        case 'started':
             setIsInitializing(false);
             setLoadingText("");
             setIsPlaying(true);
             break;

        case 'scores':
            const workerResponseTime = performance.now();
            lastWorkerResponseTimeRef.current = workerResponseTime;
            const delay = workerResponseTime - lastTickRequestTimeRef.current;
            
             const logMessage = delay > CONGESTION_THRESHOLD_MS
                    ? `CONGESTION: +${delay.toFixed(2)}ms`
                    : `OK: ${delay.toFixed(2)}ms`;

            if (showDebugPanel) {
                setDebugLog(prevLogs => [logMessage, ...prevLogs.slice(0, 4)]);
            }

            if (delay > CONGESTION_THRESHOLD_MS) {
                console.warn("[AURA_GROOVE_WORKER_CONGESTION]", {
                    delay: `${delay.toFixed(2)}ms`,
                    config: { instrumentSettings, drumSettings, effectsSettings, bpm, score }
                });
            } else {
                 console.log('[AURA_GROOVE_RECORDER] OK', { delay: `${delay.toFixed(2)}ms` });
            }


            const scheduledNow = Tone.now();
            if (data.drums && drumMachineRef.current && drumMachineRef.current.isReady()) {
                data.drums.forEach((note: DrumNote) => {
                    drumMachineRef.current!.trigger(note, scheduledNow + note.time);
                });
            }
            if (data.bass && bassSynthManagerRef.current) {
                data.bass.forEach((note: BassNote) => {
                    bassSynthManagerRef.current?.triggerAttackRelease(note.note, note.duration, scheduledNow + note.time, note.velocity);
                });
            }
            if (data.solo && soloSynthManagerRef.current) {
                data.solo.forEach((note: SoloNote) => {
                    soloSynthManagerRef.current?.triggerAttackRelease(note.notes, note.duration, scheduledNow + note.time);
                });
            }
            if (data.accompaniment && accompanimentSynthManagerRef.current) {
                data.accompaniment.forEach((note: AccompanimentNote) => {
                    accompanimentSynthManagerRef.current?.triggerAttackRelease(note.notes, note.duration, scheduledNow + note.time);
                });
            }
            if (data.effects && effectsSynthManagerRef.current) {
                 data.effects.forEach((note: EffectNote) => {
                    effectsSynthManagerRef.current?.trigger(note, scheduledNow + note.time);
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
    
    musicWorkerRef.current?.postMessage({ command: 'init' });
    
    tickLoopRef.current = new Tone.Loop(time => {
      lastTickRequestTimeRef.current = performance.now();
      musicWorkerRef.current?.postMessage({ command: 'tick' });
    }, '1m');


    return () => {
      if (musicWorkerRef.current) {
        musicWorkerRef.current.terminate();
      }
      tickLoopRef.current?.dispose();
      bassSynthManagerRef.current?.dispose();
      soloSynthManagerRef.current?.dispose();
      accompanimentSynthManagerRef.current?.dispose();
      effectsSynthManagerRef.current?.dispose();
      drumMachineRef.current?.dispose();
      fxBusRef.current?.dispose();
      if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); 
  
  useEffect(() => {
    if (isReady && isDrumMachineReady) {
      setIsInitializing(false);
    }
  }, [isReady, isDrumMachineReady]);

  const updateWorkerSettings = useCallback(() => {
    if (musicWorkerRef.current) {
        musicWorkerRef.current?.postMessage({
            command: 'update_settings',
            data: { instrumentSettings, drumSettings, effectsSettings, bpm, score },
        });
    }
  }, [instrumentSettings, drumSettings, effectsSettings, bpm, score]);
  
  const updateBpm = useCallback((newBpm: number) => {
      Tone.Transport.bpm.value = newBpm;
      if (musicWorkerRef.current) {
        musicWorkerRef.current.postMessage({ command: 'update_settings', data: { bpm: newBpm } });
      }
  }, []);

  useEffect(() => {
    if (isReady && isPlaying) { 
      updateWorkerSettings();
    }
  }, [drumSettings, instrumentSettings, effectsSettings, score, isReady, isPlaying, updateWorkerSettings]);
  
  useEffect(() => {
      if (isReady) {
          updateBpm(bpm);
      }
  }, [bpm, isReady, updateBpm]);

    useEffect(() => {
        if (!isReady || !fxBusRef.current?.soloDistortion) return;
        const fx = fxBusRef.current.soloDistortion;
        fx.wet.value = soloFx.distortion.enabled ? soloFx.distortion.wet : 0;
    }, [soloFx.distortion, isReady]);
    
    useEffect(() => {
        if (!isReady || !soloSynthManagerRef.current) return;
        soloSynthManagerRef.current.setVolume(instrumentSettings.solo.volume);
    }, [instrumentSettings.solo.volume, isReady]);

    useEffect(() => {
        if (!isReady || !accompanimentSynthManagerRef.current) return;
        accompanimentSynthManagerRef.current.setVolume(instrumentSettings.accompaniment.volume);
    }, [instrumentSettings.accompaniment.volume, isReady]);

    useEffect(() => {
        if (!isReady || !bassSynthManagerRef.current) return;
        bassSynthManagerRef.current.setVolume(instrumentSettings.bass.volume);
    }, [instrumentSettings.bass.volume, isReady]);

    useEffect(() => {
        if (!isReady || !fxBusRef.current?.accompanimentChorus) return;
        const fx = fxBusRef.current.accompanimentChorus;
        fx.wet.value = accompanimentFx.chorus.enabled ? accompanimentFx.chorus.wet : 0;
        fx.frequency.value = accompanimentFx.chorus.frequency;
        fx.depth = accompanimentFx.chorus.depth;
    }, [accompanimentFx.chorus, isReady]);

     useEffect(() => {
        if (!isReady || !effectsSynthManagerRef.current) return;
        effectsSynthManagerRef.current.setVolume(effectsSettings.volume);
        effectsSynthManagerRef.current.setMode(effectsSettings.mode);
    }, [effectsSettings, isReady]);

    useEffect(() => {
        if (!isReady || !drumMachineRef.current) return;
        drumMachineRef.current.setVolume(drumSettings.volume);
    }, [drumSettings.volume, isReady]);

  
  const handlePlay = useCallback(async () => {
    try {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        setIsInitializing(true);
        setLoadingText("Waiting for audio engine...");
        
        if (!musicWorkerRef.current || !fxBusRef.current || !bassSynthManagerRef.current || !soloSynthManagerRef.current || !accompanimentSynthManagerRef.current || !effectsSynthManagerRef.current || !drumMachineRef.current) {
            toast({ variant: "destructive", title: "Audio Error", description: "Audio engine not ready. Please refresh."});
            setIsInitializing(false);
            return;
        }

        soloSynthManagerRef.current?.setInstrument(instrumentSettings.solo.name);
        accompanimentSynthManagerRef.current?.setInstrument(instrumentSettings.accompaniment.name);
        bassSynthManagerRef.current?.setInstrument(instrumentSettings.bass.name);
        effectsSynthManagerRef.current?.setMode(effectsSettings.mode);
        
        setLoadingText("Starting playback...");

        musicWorkerRef.current?.postMessage({ 
            command: 'start',
            data: { drumSettings, instrumentSettings, effectsSettings, bpm, score }
        });

        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
        tickLoopRef.current?.start(0);
        
        soloSynthManagerRef.current?.fadeIn(0.5);
        accompanimentSynthManagerRef.current?.fadeIn(0.5);
        bassSynthManagerRef.current?.fadeIn(0.5);
        

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
  }, [drumSettings, instrumentSettings, effectsSettings, bpm, score, toast]);

  const handleStop = useCallback(() => {
    soloSynthManagerRef.current?.fadeOut(1);
    accompanimentSynthManagerRef.current?.fadeOut(1);
    bassSynthManagerRef.current?.fadeOut(1);
    
    tickLoopRef.current?.stop();
    if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
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
  

  const isBusy = isInitializing;
  const isGenerative = score === 'evolve' || score === 'omega';
  const drumsEnabled = drumSettings.pattern !== 'none';
  const effectsEnabled = effectsSettings.mode !== 'none';

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
                    disabled={isBusy || isPlaying}
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
                    disabled={isBusy}
                />
            </div>
            <div className="grid grid-cols-3 items-center gap-4 pt-2">
                <Label htmlFor="debug-panel-switch" className="text-right flex items-center gap-1.5"><SlidersHorizontal className="h-4 w-4"/> Debug Panel</Label>
                <div className="col-span-2 flex items-center">
                    <Switch id="debug-panel-switch" checked={showDebugPanel} onCheckedChange={setShowDebugPanel} />
                </div>
            </div>
        </div>
        
        <div className="space-y-4 rounded-lg border p-4">
           <h3 className="text-lg font-medium text-primary flex items-center gap-2"><Music className="h-5 w-5" /> Instrument Channels</h3>

           {/* Solo Channel */}
            <div className="space-y-3 rounded-md border p-3">
                <div className="flex justify-between items-center">
                    <Label htmlFor="solo-instrument" className="font-semibold flex items-center gap-2"><Music className="h-5 w-5" /> Solo</Label>
                     <Select
                      value={instrumentSettings.solo.name}
                      onValueChange={(v) => setInstrumentSettings(i => ({...i, solo: {...i.solo, name: v as InstrumentSettings['solo']['name']}}))}
                      disabled={isBusy || isPlaying}
                    >
                      <SelectTrigger id="solo-instrument" className="w-[150px]">
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
                 <div className="space-y-2 pt-2">
                     <div className="flex items-center justify-between">
                         <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                         <span className="text-xs font-mono text-muted-foreground">{Math.round(instrumentSettings.solo.volume * 100)}</span>
                     </div>
                     <Slider value={[instrumentSettings.solo.volume]} max={1} step={0.05} onValueChange={(v) => setInstrumentSettings(s => ({...s, solo: {...s.solo, volume: v[0]}}))} disabled={isBusy || isPlaying || instrumentSettings.solo.name === 'none'} />

                    <div className="flex items-center justify-between pt-2">
                        <Label htmlFor="solo-dist-enabled" className="flex items-center gap-1.5"><ChevronsRight className="h-4 w-4"/> Distortion</Label>
                        <Switch id="solo-dist-enabled" checked={soloFx.distortion.enabled} onCheckedChange={(c) => setSoloFx(s => ({...s, distortion: {...s.distortion, enabled: c}}))} disabled={isBusy || isPlaying} />
                    </div>
                    <Label className="text-xs text-muted-foreground">Amount</Label>
                    <Slider value={[soloFx.distortion.wet]} max={1} step={0.05} onValueChange={(v) => setSoloFx(s => ({...s, distortion: {...s.distortion, wet: v[0]}}))} disabled={isBusy || isPlaying || !soloFx.distortion.enabled} />
                </div>
            </div>

            {/* Accompaniment Channel */}
            <div className="space-y-3 rounded-md border p-3">
                 <div className="flex justify-between items-center">
                    <Label htmlFor="accompaniment-instrument" className="font-semibold flex items-center gap-2"><Waves className="h-5 w-5" /> Accompaniment</Label>
                     <Select
                      value={instrumentSettings.accompaniment.name}
                      onValueChange={(v) => setInstrumentSettings(i => ({...i, accompaniment: {...i.accompaniment, name: v as InstrumentSettings['accompaniment']['name']}}))}
                      disabled={isBusy || isPlaying}
                    >
                      <SelectTrigger id="accompaniment-instrument" className="w-[150px]">
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
                <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                         <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                         <span className="text-xs font-mono text-muted-foreground">{Math.round(instrumentSettings.accompaniment.volume * 100)}</span>
                     </div>
                    <Slider value={[instrumentSettings.accompaniment.volume]} max={1} step={0.05} onValueChange={(v) => setInstrumentSettings(s => ({...s, accompaniment: {...s.accompaniment, volume: v[0]}}))} disabled={isBusy || isPlaying || instrumentSettings.accompaniment.name === 'none'} />
                    <div className="flex items-center justify-between pt-2">
                        <Label htmlFor="accomp-chorus-enabled" className="flex items-center gap-1.5"><ChevronsRight className="h-4 w-4"/> Chorus</Label>
                        <Switch id="accomp-chorus-enabled" checked={accompanimentFx.chorus.enabled} onCheckedChange={(c) => setAccompanimentFx(s => ({...s, chorus: {...s.chorus, enabled: c}}))} disabled={isBusy || isPlaying} />
                    </div>
                    <Label className="text-xs text-muted-foreground">Wet</Label>
                    <Slider value={[accompanimentFx.chorus.wet]} max={1} step={0.05} onValueChange={(v) => setAccompanimentFx(s => ({...s, chorus: {...s.chorus, wet: v[0]}}))} disabled={isBusy || isPlaying || !accompanimentFx.chorus.enabled} />
                </div>
            </div>

            {/* Bass Channel */}
            <div className="space-y-3 rounded-md border p-3">
                 <div className="flex justify-between items-center">
                    <Label htmlFor="bass-instrument" className="font-semibold flex items-center gap-2"><Music className="h-5 w-5"/> Bass</Label>
                    <Select
                        value={instrumentSettings.bass.name}
                        onValueChange={(v) => setInstrumentSettings(i => ({...i, bass: {...i.bass, name: v as InstrumentSettings['bass']['name']}}))}
                        disabled={isBusy || isPlaying}
                        >
                        <SelectTrigger id="bass-instrument" className="w-[150px]">
                            <SelectValue placeholder="Select instrument" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="bass synth">Bass Synth</SelectItem>
                            <SelectItem value="bassGuitar">Bass Guitar</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                        <span className="text-xs font-mono text-muted-foreground">{Math.round(instrumentSettings.bass.volume * 100)}</span>
                    </div>
                    <Slider value={[instrumentSettings.bass.volume]} max={1} step={0.05} onValueChange={(v) => setInstrumentSettings(s => ({...s, bass: {...s.bass, volume: v[0]}}))} disabled={isBusy || isPlaying || instrumentSettings.bass.name === 'none'} />
                </div>
            </div>
            
            {/* Drums Channel */}
            <div className="space-y-3 rounded-md border p-3">
                 <div className="flex justify-between items-center">
                    <Label className="font-semibold flex items-center gap-2"><Drum className="h-5 w-5"/> Drums</Label>
                    <Select
                        value={drumSettings.pattern}
                        onValueChange={(v) => setDrumSettings(d => ({ ...d, pattern: v as DrumSettings['pattern'] }))}
                        disabled={isBusy || isPlaying || !isGenerative}
                    >
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Select pattern" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="ambient-beat">Ambient Beat</SelectItem>
                            <SelectItem value="basic">Basic</SelectItem>
                            <SelectItem value="breakbeat">Breakbeat</SelectItem>
                            <SelectItem value="slow">Slow</SelectItem>
                            <SelectItem value="heavy">Heavy</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                        <span className="text-xs font-mono text-muted-foreground">{Math.round(drumSettings.volume * 100)}</span>
                    </div>
                    <Slider
                        value={[drumSettings.volume]}
                        max={1}
                        step={0.05}
                        onValueChange={(v) => setDrumSettings(d => ({ ...d, volume: v[0] }))}
                        className="w-full"
                        disabled={isBusy || isPlaying || !drumsEnabled}
                    />
                </div>
            </div>

            {/* Effects Channel */}
            <div className="space-y-3 rounded-md border p-3">
                <div className="flex justify-between items-center">
                    <Label className="font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5"/> Effects</Label>
                    <Select
                        value={effectsSettings.mode}
                        onValueChange={(v) => setEffectsSettings(d => ({ ...d, mode: v as EffectsSettings['mode'] }))}
                        disabled={isBusy || isPlaying}
                    >
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Select mode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="piu">Piu</SelectItem>
                            <SelectItem value="bell">Bell</SelectItem>
                             <SelectItem value="mixed">Mixed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                        <span className="text-xs font-mono text-muted-foreground">{Math.round(effectsSettings.volume * 100)}</span>
                    </div>
                    <Slider
                        value={[effectsSettings.volume]}
                        max={1}
                        step={0.05}
                        onValueChange={(v) => setEffectsSettings(d => ({ ...d, volume: v[0] }))}
                        className="w-full"
                        disabled={isBusy || isPlaying || !effectsEnabled}
                    />
                </div>
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
        {!isBusy && isPlaying && !showDebugPanel && (
             <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Playing at {bpm} BPM...
            </p>
        )}
        {showDebugPanel && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 min-h-[40px]">
                <p className="text-sm font-medium text-center">Real-time Worker Delay</p>
                {debugLog.length === 0 && isPlaying ? (
                    <p className="font-mono text-xs text-center text-muted-foreground">Awaiting first tick...</p>
                ) : (
                    debugLog.map((log, index) => (
                        <p key={index} className={`font-mono text-xs text-center ${log.startsWith('CONGESTION') ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {log}
                        </p>
                    ))
                )}
            </div>
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
        </div>
      </CardFooter>
    </Card>
  );
}

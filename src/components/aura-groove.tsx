
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { Drum, Loader2, Music, Pause, Speaker, FileMusic, Waves, ChevronsRight, Sparkles, SlidersHorizontal, Terminal } from "lucide-react";
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

const CONGESTION_THRESHOLD_MS = 20;

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
    bass: { name: "bass synth", volume: 0.9 },
  });
  const [bpm, setBpm] = useState(75);
  const [score, setScore] = useState<ScoreName>('promenade');
  
  // Instrument FX States
  const [soloFx, setSoloFx] = useState({ distortion: { enabled: false, wet: 0.5 } });
  const [accompanimentFx, setAccompanimentFx] = useState({ chorus: { enabled: false, wet: 0.4, frequency: 1.5, depth: 0.7 } });
  
  // Debug State
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  
  const { toast } = useToast();

  const musicWorkerRef = useRef<Worker>();
  const fxBusRef = useRef<FxBus | null>(null);
  const bassSynthManagerRef = useRef<BassSynthManager | null>(null);
  const soloSynthManagerRef = useRef<SoloSynthManager | null>(null);
  const accompanimentSynthManagerRef = useRef<AccompanimentSynthManager | null>(null);
  const effectsSynthManagerRef = useRef<EffectsSynthManager | null>(null);
  const drumMachineRef = useRef<DrumMachine | null>(null);
  
  const transportLoopRef = useRef<Tone.Loop | null>(null);
  const currentBarRef = useRef<number>(0);
  const lastTickTimeRef = useRef<number>(0);
  
   useEffect(() => {
    
    const initializeAudio = async () => {
        console.log("[AURA_TRACE] Initializing audio components...");
        const worker = new Worker(new URL('../app/ambient.worker.ts', import.meta.url));
        musicWorkerRef.current = worker;

        const { FxBus } = await import('@/lib/fx-bus');
        fxBusRef.current = new FxBus();
        
        drumMachineRef.current = new DrumMachine(fxBusRef.current, () => {
            console.log("[AURA_TRACE] Drum machine ready.");
            setIsDrumMachineReady(true);
        });

        const { BassSynthManager } = await import('@/lib/bass-synth-manager');
        bassSynthManagerRef.current = new BassSynthManager(fxBusRef.current!);
        
        const { SoloSynthManager } = await import('@/lib/solo-synth-manager');
        soloSynthManagerRef.current = new SoloSynthManager(fxBusRef.current!);

        const { AccompanimentSynthManager } = await import('@/lib/accompaniment-synth-manager');
        accompanimentSynthManagerRef.current = new AccompanimentSynthManager(fxBusRef.current!);

        const { EffectsSynthManager } = await import('@/lib/effects-synth-manager');
        effectsSynthManagerRef.current = new EffectsSynthManager(fxBusRef.current!);
       
        worker.onmessage = (event: MessageEvent) => {
            const { type, data, bar: receivedBar, error } = event.data;
            
            const now = Tone.now();
            const delay = now - lastTickTimeRef.current;
            
            if (receivedBar !== undefined && showDebugPanel) {
                const logMessage = `Bar ${receivedBar}: Delay ${delay.toFixed(2)}ms`;
                if (delay > CONGESTION_THRESHOLD_MS) {
                    // CONGESTION LOGIC
                }
            }

            const schedule = (scoreData: any[], manager: any, triggerFn: string) => {
                if (!manager || (manager.isReady && !manager.isReady()) || !isPlaying) return;
                const barStartTime = lastTickTimeRef.current;
                scoreData.forEach((note: any) => {
                    const timeToPlay = Math.max(barStartTime, now) + note.time;
                    if (triggerFn === 'trigger') {
                        manager.trigger(note, timeToPlay);
                    } else {
                        const notesArg = note.notes || note.note;
                        manager.triggerAttackRelease(notesArg, note.duration, timeToPlay, note.velocity);
                    }
                });
            };

            switch(type) {
                case 'initialized':
                   console.log("[AURA_TRACE] Worker initialized.");
                   setIsReady(true);
                   setLoadingText("");
                   break;
                case 'started':
                    console.log("[AURA_TRACE] Worker started.");
                    setIsInitializing(false);
                    setLoadingText("");
                    setIsPlaying(true);
                    currentBarRef.current = 0;
                    lastTickTimeRef.current = Tone.now();
                    break;
                case 'drum_score':
                    schedule(data, drumMachineRef.current, 'trigger');
                    break;
                case 'bass_score':
                    schedule(data, bassSynthManagerRef.current, 'triggerAttackRelease');
                    break;
                case 'solo_score':
                    schedule(data, soloSynthManagerRef.current, 'triggerAttackRelease');
                    break;
                case 'accompaniment_score':
                    schedule(data, accompanimentSynthManagerRef.current, 'triggerAttackRelease');
                    break;
                case 'effects_score':
                    schedule(data, effectsSynthManagerRef.current, 'trigger');
                    break;
                case 'stopped':
                    console.log("[AURA_TRACE] Worker stopped.");
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

        console.log("[AURA_TRACE] Sending init command to worker.");
        musicWorkerRef.current?.postMessage({ command: 'init' });
    }

    initializeAudio();
    
    return () => {
      console.log("[AURA_TRACE] Cleanup effect called.");
      if (musicWorkerRef.current) {
        musicWorkerRef.current.terminate();
      }
      transportLoopRef.current?.dispose();
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
  }, []); 
  
  useEffect(() => {
    if (isReady && isDrumMachineReady) {
        console.log("[AURA_TRACE] All components ready. Setting isInitializing to false.");
        setIsInitializing(false);
    }
  }, [isReady, isDrumMachineReady]);

  const updateWorkerSettings = useCallback(() => {
    if (musicWorkerRef.current) {
        console.log("[AURA_TRACE] updateWorkerSettings called.");
        musicWorkerRef.current?.postMessage({
            command: 'update_settings',
            data: { instrumentSettings, drumSettings, effectsSettings, bpm, score },
        });
    }
  }, [instrumentSettings, drumSettings, effectsSettings, bpm, score]);
  
  const updateBpm = useCallback((newBpm: number) => {
      setBpm(newBpm);
      Tone.Transport.bpm.value = newBpm;
      if (musicWorkerRef.current) {
          console.log("[AURA_TRACE] Sending command from updateBpm: update_settings");
          musicWorkerRef.current.postMessage({ command: 'update_settings', data: { bpm: newBpm } });
      }
  }, []);

  useEffect(() => {
    console.log("[AURA_TRACE] Settings useEffect triggered. isReady:", isReady, "isPlaying:", isPlaying);
    if (isReady && isPlaying) { 
      updateWorkerSettings();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drumSettings, instrumentSettings, effectsSettings, score]);

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
  
  const handleStop = useCallback(() => {
    console.log("[AURA_TRACE] handleStop called.");
    soloSynthManagerRef.current?.fadeOut(0.5);
    accompanimentSynthManagerRef.current?.fadeOut(0.5);
    bassSynthManagerRef.current?.fadeOut(0.5);
    
    transportLoopRef.current?.dispose();
    transportLoopRef.current = null;
    
    if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
    }
    console.log("[AURA_TRACE] Sending command from handleStop: stop");
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    setIsPlaying(false);
    currentBarRef.current = 0;
  }, []);

  const handlePlay = useCallback(async () => {
    console.log("[AURA_TRACE] handlePlay called.");
    if (!isReady) {
        console.warn("[AURA_TRACE] handlePlay called before ready. Aborting.");
        return;
    }

    try {
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        setIsInitializing(true);
        setLoadingText("Preparing audio...");
        
        handleStop(); 
        
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
        
        console.log("[AURA_TRACE] Sending command from handlePlay: start");
        musicWorkerRef.current?.postMessage({ 
            command: 'start',
            data: { drumSettings, instrumentSettings, effectsSettings, bpm, score }
        });
        
        currentBarRef.current = 0;
        transportLoopRef.current = new Tone.Loop(time => {
          lastTickTimeRef.current = time;
          musicWorkerRef.current?.postMessage({ command: 'tick', data: { time, barCount: currentBarRef.current } });
          Tone.Draw.schedule(() => {
            currentBarRef.current++;
          }, time);
        }, '1m').start(0);

        if (Tone.Transport.state !== 'started') {
            Tone.Transport.start();
        }
        
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
  }, [isReady, drumSettings, instrumentSettings, effectsSettings, bpm, score, toast, handleStop]);
  
  const handleTogglePlay = useCallback(() => {
    console.log("[AURA_TRACE] handleTogglePlay called. Current isPlaying state:", isPlaying);
    if (isBusy) {
        console.warn("[AURA_TRACE] handleTogglePlay called while busy. Aborting.");
        return;
    };

    if (isPlaying) {
      handleStop();
    } else {
      handlePlay();
    }
  }, [isBusy, isPlaying, handleStop, handlePlay]);

  const isBusy = isInitializing;
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
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium text-primary flex items-center gap-2"><FileMusic className="h-5 w-5"/> Composition</h3>
              <div className="flex items-center gap-2">
                <Label htmlFor="debug-switch" className="text-xs">Debug</Label>
                <Switch id="debug-switch" checked={showDebugPanel} onCheckedChange={setShowDebugPanel} />
              </div>
            </div>
            {showDebugPanel && (
              <div className="bg-slate-900/50 p-2 rounded-md border border-slate-700/50 max-h-32 overflow-y-auto">
                  <h4 className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mb-1"><Terminal className="h-4 w-4"/> Real-time Worker Delay</h4>
                  <pre className="text-xs font-mono text-slate-500 overflow-x-auto">
                      {debugLog.map((line, i) => <div key={i} className={line.startsWith('CONGESTION') ? 'text-red-400' : ''}>{line}</div>)}
                  </pre>
              </div>
            )}

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
                    onValueChange={(v) => updateBpm(v[0])}
                    className="col-span-2"
                    disabled={isBusy}
                />
            </div>
        </div>
        
        <div className="space-y-4 rounded-lg border p-4">
           <h3 className="text-lg font-medium text-primary flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Instrument Channels</h3>

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
                        disabled={isBusy || isPlaying}
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
        </div>
      </CardFooter>
    </Card>
  );
}

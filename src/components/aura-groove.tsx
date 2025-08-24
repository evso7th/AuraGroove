
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Tone from 'tone';
import { Drum, Loader2, Music, Pause, Speaker, FileMusic, Waves, ChevronsRight, Sparkles, SlidersHorizontal, Terminal, Info } from "lucide-react";
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
import { FxBus } from "@/lib/fx-bus";
import { BassSynthManager } from "@/lib/bass-synth-manager";
import { SoloSynthManager } from "@/lib/solo-synth-manager";
import { AccompanimentSynthManager } from "@/lib/accompaniment-synth-manager";
import { EffectsSynthManager } from "@/lib/effects-synth-manager";
import { DrumMachine } from "@/lib/drum-machine";
import { DrumNote, BassNote, SoloNote, AccompanimentNote, EffectNote, DrumSettings, EffectsSettings, InstrumentSettings, ScoreName } from '@/types/music';

// Architectural constants
const CHUNK_DURATION_IN_BARS = 16;
const NOTE_BUFFER_LOW_WATER_MARK_IN_SECONDS = 30; // Request new chunk when < 30 seconds of music is left in buffer

export function AuraGroove() {
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true); 
  const [loadingText, setLoadingText] = useState("Initializing...");

  // --- State for Music Settings ---
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
  
  // --- State for FX ---
  const [soloFx, setSoloFx] = useState({ distortion: { enabled: false, wet: 0.5 } });
  const [accompanimentFx, setAccompanimentFx] = useState({ chorus: { enabled: false, wet: 0.4, frequency: 1.5, depth: 0.7 } });
  
  // --- State for Debugging & Architecture ---
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [noteBufferCount, setNoteBufferCount] = useState(0);

  const { toast } = useToast();

  // --- Refs for Worker, Audio components, and Music Logic ---
  const musicWorkerRef = useRef<Worker | null>(null);
  const noteBufferRef = useRef<any[]>([]);
  const scheduleLoopRef = useRef<Tone.Loop | null>(null);
  const isRequestingChunkRef = useRef(false);
  const nextNoteTimeRef = useRef(0); // <-- Key state for scheduling

  const [fxBus, setFxBus] = useState<FxBus | null>(null);
  const [bassSynthManager, setBassSynthManager] = useState<BassSynthManager | null>(null);
  const [soloSynthManager, setSoloSynthManager] = useState<SoloSynthManager | null>(null);
  const [accompanimentSynthManager, setAccompanimentSynthManager] = useState<AccompanimentSynthManager | null>(null);
  const [effectsSynthManager, setEffectsSynthManager] = useState<EffectsSynthManager | null>(null);
  const [drumMachine, setDrumMachine] = useState<DrumMachine | null>(null);

  // --- Main Initialization Effect ---
  useEffect(() => {
    const initAudio = async () => {
      try {
        setIsInitializing(true);
        setLoadingText("Initializing Audio Context...");
        await Tone.start();
        Tone.Transport.bpm.value = bpm;
        
        setLoadingText("Creating Audio Buses...");
        const bus = new FxBus();
        setFxBus(bus);

        setLoadingText("Creating Synthesizers...");
        setBassSynthManager(new BassSynthManager(bus));
        setSoloSynthManager(new SoloSynthManager(bus));
        setAccompanimentSynthManager(new AccompanimentSynthManager(bus));
        setEffectsSynthManager(new EffectsSynthManager(bus));
        
        setLoadingText("Loading Drum Samples...");
        const newDrumMachine = new DrumMachine(bus, () => {
          setLoadingText("");
          setIsAudioReady(true);
          setIsInitializing(false);
        });
        setDrumMachine(newDrumMachine);

        // Setup Worker
        const worker = new Worker(new URL('../app/ambient.worker.ts', import.meta.url));
        musicWorkerRef.current = worker;
        worker.postMessage({ command: 'init' });
        
        worker.onmessage = (event: MessageEvent) => {
            const { type, data, error } = event.data;

            if (type === 'chunk_ready') {
                const { drums, bass, solo, accompaniment, effects, chunkDurationInBars, secondsPerBeat } = data;
                
                const processScore = (scoreArr: any[], part: string) => {
                    return scoreArr.flatMap((barNotes, barIndex) => 
                        barNotes.map((note: any) => ({
                            ...note,
                            time: barIndex * 4 * secondsPerBeat + (note.time * secondsPerBeat),
                            part,
                        }))
                    );
                };

                const newNotes = [
                    ...processScore(drums, 'drums'),
                    ...processScore(bass, 'bass'),
                    ...processScore(solo, 'solo'),
                    ...processScore(accompaniment, 'accompaniment'),
                    ...processScore(effects, 'effects'),
                ].sort((a, b) => a.time - b.time);

                noteBufferRef.current.push(...newNotes);
                console.log(`[AURA_TRACE] Received chunk_ready. Added ${newNotes.length} notes. Buffer size: ${noteBufferRef.current.length}`);
                isRequestingChunkRef.current = false;
            } else if (type === 'error') {
                toast({ variant: "destructive", title: "Worker Error", description: error });
                setIsPlaying(false);
                setLoadingText("");
            }
        };
      } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          toast({ variant: "destructive", title: "Initialization Failed", description: errorMsg });
          setIsInitializing(false);
      }
    };

    initAudio();

    return () => {
      musicWorkerRef.current?.terminate();
      scheduleLoopRef.current?.dispose();
      fxBus?.dispose();
      bassSynthManager?.dispose();
      soloSynthManager?.dispose();
      accompanimentSynthManager?.dispose();
      effectsSynthManager?.dispose();
      drumMachine?.dispose();
      if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
        Tone.Transport.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Worker Communication ---
  const updateWorkerSettings = useCallback(() => {
      if (musicWorkerRef.current) {
          musicWorkerRef.current.postMessage({
              command: 'update_settings',
              data: { instrumentSettings, drumSettings, effectsSettings, bpm, score },
          });
      }
  }, [instrumentSettings, drumSettings, effectsSettings, bpm, score]);

  const requestNewChunkFromWorker = useCallback(() => {
    if (musicWorkerRef.current && !isRequestingChunkRef.current) {
        console.log("[AURA_TRACE] Requesting new chunk from worker.");
        isRequestingChunkRef.current = true;
        musicWorkerRef.current.postMessage({ 
            command: 'request_new_chunk', 
            data: { chunkDurationInBars: CHUNK_DURATION_IN_BARS } 
        });
    }
  }, []);
  
  // --- Effect & Volume Handlers ---
  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
    updateWorkerSettings();
  }, [bpm, updateWorkerSettings]);

  useEffect(() => { updateWorkerSettings() }, [drumSettings, instrumentSettings, effectsSettings, score, updateWorkerSettings]);
  
  useEffect(() => {
      if (!isAudioReady || !fxBus?.soloDistortion) return;
      fxBus.soloDistortion.wet.value = soloFx.distortion.enabled ? soloFx.distortion.wet : 0;
  }, [soloFx.distortion, isAudioReady, fxBus]);
  
  useEffect(() => {
      if (!isAudioReady || !fxBus?.accompanimentChorus) return;
      const fx = fxBus.accompanimentChorus;
      fx.wet.value = accompanimentFx.chorus.enabled ? accompanimentFx.chorus.wet : 0;
      fx.frequency.value = accompanimentFx.chorus.frequency;
      fx.depth = accompanimentFx.chorus.depth;
  }, [accompanimentFx.chorus, isAudioReady, fxBus]);

  useEffect(() => { soloSynthManager?.setVolume(instrumentSettings.solo.volume) }, [instrumentSettings.solo.volume, soloSynthManager]);
  useEffect(() => { accompanimentSynthManager?.setVolume(instrumentSettings.accompaniment.volume) }, [instrumentSettings.accompaniment.volume, accompanimentSynthManager]);
  useEffect(() => { bassSynthManager?.setVolume(instrumentSettings.bass.volume) }, [instrumentSettings.bass.volume, bassSynthManager]);
  useEffect(() => { effectsSynthManager?.setVolume(effectsSettings.volume) }, [effectsSettings.volume, effectsSynthManager]);
  useEffect(() => { drumMachine?.setVolume(drumSettings.volume) }, [drumSettings.volume, drumMachine]);

  // --- Play/Stop Logic ---
  const handleStop = useCallback(() => {
    setIsPlaying(false);
    if (scheduleLoopRef.current) {
        scheduleLoopRef.current.stop(0);
        scheduleLoopRef.current.dispose();
        scheduleLoopRef.current = null;
    }
    if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
        Tone.Transport.cancel(0);
    }
    musicWorkerRef.current?.postMessage({ command: 'stop' });
    noteBufferRef.current = [];
    setNoteBufferCount(0);
  }, []);

  const handlePlay = useCallback(async () => {
    if (isInitializing || !isAudioReady || !soloSynthManager || !accompanimentSynthManager || !bassSynthManager || !effectsSynthManager || !drumMachine) return;

    await Tone.start();
    if (Tone.context.state !== 'running') await Tone.context.resume();
    
    soloSynthManager.setInstrument(instrumentSettings.solo.name);
    accompanimentSynthManager.setInstrument(instrumentSettings.accompaniment.name);
    bassSynthManager.setInstrument(instrumentSettings.bass.name);
    effectsSynthManager.setMode(effectsSettings.mode);

    musicWorkerRef.current?.postMessage({ command: 'start', data: { drumSettings, instrumentSettings, effectsSettings, bpm, score } });
    
    requestNewChunkFromWorker();

    nextNoteTimeRef.current = Tone.now() + 0.5; // Start scheduling 0.5s in the future

    scheduleLoopRef.current = new Tone.Loop(loopTime => {
        let notesProcessedInLoop = 0;
        const lookaheadTime = 0.2; // How far ahead to schedule in seconds
        const scheduleUntil = Tone.Transport.seconds + lookaheadTime;

        while (noteBufferRef.current.length > 0) {
            const note = noteBufferRef.current[0];
            const absoluteNoteTime = nextNoteTimeRef.current + note.time;

            if (absoluteNoteTime < scheduleUntil) {
                const scheduledNote = noteBufferRef.current.shift();
                if (!scheduledNote) continue;

                const timeToPlay = nextNoteTimeRef.current + scheduledNote.time;
                
                switch(scheduledNote.part) {
                    case 'drums': drumMachine.trigger(scheduledNote, timeToPlay); break;
                    case 'bass': bassSynthManager.triggerAttackRelease(scheduledNote.note, scheduledNote.duration, timeToPlay, scheduledNote.velocity); break;
                    case 'solo': soloSynthManager.triggerAttackRelease(scheduledNote.notes, scheduledNote.duration, timeToPlay, scheduledNote.velocity); break;
                    case 'accompaniment': accompanimentSynthManager.triggerAttackRelease(scheduledNote.notes, scheduledNote.duration, timeToPlay, scheduledNote.velocity); break;
                    case 'effects': effectsSynthManager.trigger(scheduledNote, timeToPlay); break;
                }
                notesProcessedInLoop++;
            } else {
                break; 
            }
        }
        
        if (notesProcessedInLoop > 0) {
          console.log(`[AURA_TRACE_SCHEDULER] Scheduled ${notesProcessedInLoop} notes. Current buffer size: ${noteBufferRef.current.length}`);
        }

        setNoteBufferCount(noteBufferRef.current.length);
        
        const lastNote = noteBufferRef.current[noteBufferRef.current.length - 1];
        const bufferDuration = lastNote ? (lastNote.time + new Tone.Time(lastNote.duration || 0).toSeconds()) : 0;
        
        if (bufferDuration < NOTE_BUFFER_LOW_WATER_MARK_IN_SECONDS && noteBufferRef.current.length > 0) {
            nextNoteTimeRef.current += lastNote.time + new Tone.Time(lastNote.duration || '16n').toSeconds();
            requestNewChunkFromWorker();
        } else if (noteBufferRef.current.length === 0) {
            requestNewChunkFromWorker();
        }

    }, '1s').start(0); // Run the scheduling check frequently

    Tone.Transport.start();
    setIsPlaying(true);

  }, [isInitializing, isAudioReady, drumSettings, instrumentSettings, effectsSettings, bpm, score, requestNewChunkFromWorker, soloSynthManager, accompanimentSynthManager, bassSynthManager, effectsSynthManager, drumMachine]);

  const handleTogglePlay = useCallback(() => {
    if (isInitializing) return;
    isPlaying ? handleStop() : handlePlay();
  }, [isInitializing, isPlaying, handleStop, handlePlay]);

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
              <div className="bg-slate-900/50 p-2 rounded-md border border-slate-700/50">
                  <div className="text-xs font-mono text-slate-400 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Info className="h-4 w-4"/> Note Buffer</span>
                    <span>{noteBufferCount} notes</span>
                  </div>
              </div>
            )}

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

           {/* Solo Channel */}
            <div className="space-y-3 rounded-md border p-3">
                <div className="flex justify-between items-center">
                    <Label htmlFor="solo-instrument" className="font-semibold flex items-center gap-2"><Music className="h-5 w-5" /> Solo</Label>
                     <Select
                      value={instrumentSettings.solo.name}
                      onValueChange={(v) => setInstrumentSettings(i => ({...i, solo: {...i.solo, name: v as InstrumentSettings['solo']['name']}}))}
                      disabled={isInitializing || isPlaying}
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
                     <Slider value={[instrumentSettings.solo.volume]} max={1} step={0.05} onValueChange={(v) => setInstrumentSettings(s => ({...s, solo: {...s.solo, volume: v[0]}}))} disabled={isInitializing || isPlaying || instrumentSettings.solo.name === 'none'} />

                    <div className="flex items-center justify-between pt-2">
                        <Label htmlFor="solo-dist-enabled" className="flex items-center gap-1.5"><ChevronsRight className="h-4 w-4"/> Distortion</Label>
                        <Switch id="solo-dist-enabled" checked={soloFx.distortion.enabled} onCheckedChange={(c) => setSoloFx(s => ({...s, distortion: {...s.distortion, enabled: c}}))} disabled={isInitializing || isPlaying} />
                    </div>
                    <Label className="text-xs text-muted-foreground">Amount</Label>
                    <Slider value={[soloFx.distortion.wet]} max={1} step={0.05} onValueChange={(v) => setSoloFx(s => ({...s, distortion: {...s.distortion, wet: v[0]}}))} disabled={isInitializing || isPlaying || !soloFx.distortion.enabled} />
                </div>
            </div>

            {/* Accompaniment Channel */}
            <div className="space-y-3 rounded-md border p-3">
                 <div className="flex justify-between items-center">
                    <Label htmlFor="accompaniment-instrument" className="font-semibold flex items-center gap-2"><Waves className="h-5 w-5" /> Accompaniment</Label>
                     <Select
                      value={instrumentSettings.accompaniment.name}
                      onValueChange={(v) => setInstrumentSettings(i => ({...i, accompaniment: {...i.accompaniment, name: v as InstrumentSettings['accompaniment']['name']}}))}
                      disabled={isInitializing || isPlaying}
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
                    <Slider value={[instrumentSettings.accompaniment.volume]} max={1} step={0.05} onValueChange={(v) => setInstrumentSettings(s => ({...s, accompaniment: {...s.accompaniment, volume: v[0]}}))} disabled={isInitializing || isPlaying || instrumentSettings.accompaniment.name === 'none'} />
                    <div className="flex items-center justify-between pt-2">
                        <Label htmlFor="accomp-chorus-enabled" className="flex items-center gap-1.5"><ChevronsRight className="h-4 w-4"/> Chorus</Label>
                        <Switch id="accomp-chorus-enabled" checked={accompanimentFx.chorus.enabled} onCheckedChange={(c) => setAccompanimentFx(s => ({...s, chorus: {...s.chorus, enabled: c}}))} disabled={isInitializing || isPlaying} />
                    </div>
                    <Label className="text-xs text-muted-foreground">Wet</Label>
                    <Slider value={[accompanimentFx.chorus.wet]} max={1} step={0.05} onValueChange={(v) => setAccompanimentFx(s => ({...s, chorus: {...s.chorus, wet: v[0]}}))} disabled={isInitializing || isPlaying || !accompanimentFx.chorus.enabled} />
                </div>
            </div>

            {/* Bass Channel */}
            <div className="space-y-3 rounded-md border p-3">
                 <div className="flex justify-between items-center">
                    <Label htmlFor="bass-instrument" className="font-semibold flex items-center gap-2"><Music className="h-5 w-5"/> Bass</Label>
                    <Select
                        value={instrumentSettings.bass.name}
                        onValueChange={(v) => setInstrumentSettings(i => ({...i, bass: {...i.bass, name: v as InstrumentSettings['bass']['name']}}))}
                        disabled={isInitializing || isPlaying}
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
                    <Slider value={[instrumentSettings.bass.volume]} max={1} step={0.05} onValueChange={(v) => setInstrumentSettings(s => ({...s, bass: {...s.bass, volume: v[0]}}))} disabled={isInitializing || isPlaying || instrumentSettings.bass.name === 'none'} />
                </div>
            </div>
            
            {/* Drums Channel */}
            <div className="space-y-3 rounded-md border p-3">
                 <div className="flex justify-between items-center">
                    <Label className="font-semibold flex items-center gap-2"><Drum className="h-5 w-5"/> Drums</Label>
                    <Select
                        value={drumSettings.pattern}
                        onValueChange={(v) => setDrumSettings(d => ({ ...d, pattern: v as DrumSettings['pattern'] }))}
                        disabled={isInitializing || isPlaying}
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
                        disabled={isInitializing || isPlaying || drumSettings.pattern === 'none'}
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
                        disabled={isInitializing || isPlaying}
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
                        disabled={isInitializing || isPlaying || effectsSettings.mode === 'none'}
                    />
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

    
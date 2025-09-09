
"use client";

import { useState, useEffect } from "react";
import { SlidersHorizontal, Music, Pause, Speaker, FileMusic, Drum, GitBranch, Atom, Piano, Home, X, Sparkles, Sprout, LayoutGrid, LayoutList, Waves, Timer } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AuraGrooveProps } from "./aura-groove";
import { useRouter } from "next/navigation";
import { formatTime } from "@/lib/utils";

const EQ_BANDS = [
  { freq: '60', label: '60' }, { freq: '125', label: '125' }, { freq: '250', label: '250' },
  { freq: '500', label: '500' }, { freq: '1k', label: '1k' }, { freq: '2k', label: '2k' }, { freq: '4k', label: '4k' },
];

export function AuraGrooveV2({
  isPlaying, isInitializing, handleTogglePlay, drumSettings, setDrumSettings, instrumentSettings,
  setInstrumentSettings, handleBassTechniqueChange, handleVolumeChange, textureSettings, handleTextureEnabledChange,
  bpm, handleBpmChange, score, handleScoreChange, density, setDensity, handleGoHome,
  isEqModalOpen, setIsEqModalOpen, eqSettings, handleEqChange,
  timerSettings, handleTimerDurationChange, handleToggleTimer,
}: AuraGrooveProps) {

  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleBack = () => {
    router.push('/aura-groove-legacy');
  };
  
  return (
    <div className="w-full h-full flex flex-col p-3 bg-card">
      {/* Header */}
      <header className="flex-shrink-0 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-row items-center gap-2 pl-1">
            <Image src="/assets/icon8.jpeg" alt="AuraGroove Logo" width={32} height={32} className="rounded-full" />
            <h1 className="text-lg font-bold text-primary">AuraGroove</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleGoHome} aria-label="Go to Home"><Home className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Go back to original UI"><LayoutList className="h-5 w-5" /></Button>
            {isClient && (
              <Dialog open={isEqModalOpen} onOpenChange={setIsEqModalOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="h-9 w-9 px-2" aria-label="Open Equalizer">EQ</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>System Equalizer</DialogTitle></DialogHeader>
                  <div className="flex justify-around items-end pt-4 h-48">
                    {EQ_BANDS.map((band, index) => (
                      <div key={index} className="flex flex-col items-center justify-end space-y-2">
                        <span className="text-xs font-mono text-muted-foreground">{eqSettings[index] > 0 ? '+' : ''}{eqSettings[index].toFixed(1)}</span>
                        <Slider value={[eqSettings[index]]} min={-10} max={10} step={0.5} onValueChange={(v) => handleEqChange(index, v[0])} orientation="vertical" className="h-32" />
                        <Label className="text-xs text-muted-foreground">{band.label}</Label>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 pt-2 pb-1.5">
           <Button type="button" onClick={handleTogglePlay} disabled={isInitializing} className="w-[60%] text-base h-10">
              {isPlaying ? <Pause className="mr-2 h-5 w-5" /> : <Music className="mr-2 h-5 w-5" />}
              {isPlaying ? "Stop" : "Play"}
           </Button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-grow overflow-y-auto pr-2 -mr-2">
        <Tabs defaultValue="composition" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-8">
            <TabsTrigger value="composition" className="text-xs">Composition</TabsTrigger>
            <TabsTrigger value="instruments" className="text-xs">Instruments</TabsTrigger>
            <TabsTrigger value="samples" className="text-xs">Samples</TabsTrigger>
          </TabsList>
          
          <div className="grid">
            <TabsContent value="composition" className="space-y-1.5 pt-2 col-start-1 row-start-1 px-1">
              <Card className="border-0 shadow-none">
                <CardHeader className="p-2"><CardTitle className="flex items-center gap-2 text-sm"><FileMusic className="h-4 w-4"/> Composition</CardTitle></CardHeader>
                <CardContent className="space-y-2 p-3 pt-0">
                  <div className="grid grid-cols-3 items-center gap-2">
                      <Label htmlFor="score-selector" className="text-right text-xs">Style</Label>
                      <Select value={score} onValueChange={(v) => handleScoreChange(v as any)} disabled={isInitializing || isPlaying}>
                          <SelectTrigger id="score-selector" className="col-span-2 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="dreamtales">Dreamtales</SelectItem>
                              <SelectItem value="evolve">Evolve</SelectItem>
                              <SelectItem value="omega">Omega</SelectItem>
                              <SelectItem value="journey">Journey</SelectItem>
                              <SelectItem value="multeity">Multeity</SelectItem>
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-2">
                    <Label htmlFor="bpm-slider" className="text-right text-xs">BPM</Label>
                    <Slider id="bpm-slider" value={[bpm]} min={60} max={160} step={5} onValueChange={(v) => handleBpmChange(v[0])} className="col-span-1" disabled={isInitializing}/>
                    <span className="text-xs w-8 text-right font-mono">{bpm}</span>
                  </div>
                  <div className="grid grid-cols-3 items-center gap-2">
                    <Label htmlFor="density-slider" className="text-right text-xs">Density</Label>
                    <Slider id="density-slider" value={[density]} min={0.1} max={1} step={0.05} onValueChange={(v) => setDensity(v[0])} className="col-span-2" disabled={isInitializing}/>
                  </div>
                </CardContent>
              </Card>
               <Card className="border-0 shadow-none mt-2">
                <CardHeader className="p-2"><CardTitle className="flex items-center gap-2 text-sm"><Timer className="h-4 w-4"/> Sleep Timer</CardTitle></CardHeader>
                <CardContent className="space-y-2 p-3 pt-0">
                    <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-2">
                        <Label htmlFor="timer-slider" className="text-right text-xs">Minutes</Label>
                        <Slider
                            id="timer-slider"
                            value={[timerSettings.duration / 60]}
                            min={0}
                            max={30}
                            step={5}
                            onValueChange={(v) => handleTimerDurationChange(v[0])}
                            className="col-span-1"
                            disabled={isInitializing || timerSettings.isActive}
                        />
                        <span className="text-xs w-8 text-right font-mono">{timerSettings.duration / 60}</span>
                    </div>
                    <div className="flex justify-center items-center gap-4 pt-2">
                         <Button
                            onClick={handleToggleTimer}
                            disabled={isInitializing || timerSettings.duration === 0}
                            variant={timerSettings.isActive ? 'destructive' : 'secondary'}
                            className="w-full h-8 text-xs"
                        >
                            {timerSettings.isActive ? `Stop Timer (${formatTime(timerSettings.timeLeft)})` : 'Start Timer'}
                        </Button>
                    </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="instruments" className="space-y-1 pt-2 col-start-1 row-start-1 px-1">
               <Card className="border-0 shadow-none">
                  <CardHeader className="p-2"><CardTitle className="flex items-center gap-2 text-sm"><SlidersHorizontal className="h-4 w-4"/> Instruments</CardTitle></CardHeader>
                  <CardContent className="space-y-1 p-3 pt-0">
                      {Object.entries(instrumentSettings).map(([part, settings]) => (
                          <div key={part} className="p-2 border rounded-md space-y-2">
                             <div className="grid grid-cols-2 items-center gap-2">
                                  <Label className="font-semibold flex items-center gap-1.5 capitalize text-xs"><Waves className="h-4 w-4"/>{part}</Label>
                                  <Select value={settings.name} onValueChange={(v) => setInstrumentSettings(part as any, v as any)} disabled={isInitializing || isPlaying}>
                                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                                      <SelectContent>
                                          {(part === 'bass' ? ['classicBass', 'glideBass', 'ambientDrone', 'resonantGliss', 'hypnoticDrone', 'livingRiff', 'none'] : ['synth', 'organ', 'mellotron', 'theremin', 'none']).map(inst => (
                                            <SelectItem key={inst} value={inst} className="text-xs">{inst.charAt(0).toUpperCase() + inst.slice(1).replace(/([A-Z])/g, ' $1')}</SelectItem>
                                          ))}
                                      </SelectContent>
                                  </Select>
                              </div>
                               {part === 'bass' && (
                                  <div className="grid grid-cols-2 items-center gap-2">
                                      <Label className="font-semibold flex items-center gap-1.5 capitalize text-xs"><GitBranch className="h-4 w-4"/>Technique</Label>
                                       <Select value={settings.technique} onValueChange={(v) => handleBassTechniqueChange(v as any)} disabled={isInitializing || isPlaying || settings.name === 'none'}>
                                          <SelectTrigger className="h-8 text-xs"><SelectValue/></SelectTrigger>
                                          <SelectContent>
                                              <SelectItem value="arpeggio" className="text-xs">Arpeggio</SelectItem>
                                              <SelectItem value="portamento" className="text-xs">Portamento</SelectItem>
                                              <SelectItem value="glissando" className="text-xs">Glissando</SelectItem>
                                              <SelectItem value="glide" className="text-xs">Glide</SelectItem>
                                              <SelectItem value="pulse" className="text-xs">Pulse</SelectItem>
                                          </SelectContent>
                                      </Select>
                                  </div>
                              )}
                              <div className="flex items-center gap-2">
                                  <Label className="text-xs text-muted-foreground"><Speaker className="h-3 w-3 inline-block mr-1"/>Volume</Label>
                                  <Slider value={[settings.volume]} max={1} step={0.05} onValueChange={(v) => handleVolumeChange(part as any, v[0])} disabled={isInitializing || settings.name === 'none'}/>
                                  <span className="text-xs w-8 text-right font-mono">{Math.round(settings.volume * 100)}</span>
                              </div>
                          </div>
                      ))}
                  </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="samples" className="space-y-1.5 pt-2 col-start-1 row-start-1 px-1">
               <Card className="border-0 shadow-none">
                  <CardHeader className="p-2"><CardTitle className="flex items-center gap-2 text-sm"><Atom className="h-4 w-4"/> Sampled Textures</CardTitle></CardHeader>
                  <CardContent className="space-y-1.5 p-3 pt-0">
                      <div className="p-2 border rounded-md">
                          <div className="flex justify-between items-center mb-1">
                              <Label className="font-semibold flex items-center gap-1.5 text-sm"><Sparkles className="h-4 w-4"/>Sparkles</Label>
                              <Switch checked={textureSettings.sparkles.enabled} onCheckedChange={(c) => handleTextureEnabledChange('sparkles', c)} disabled={isInitializing}/>
                          </div>
                          <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground"><Speaker className="h-3 w-3 inline-block mr-1"/>Volume</Label>
                              <Slider value={[textureSettings.sparkles.volume]} max={1} step={0.05} onValueChange={(v) => handleVolumeChange('sparkles', v[0])} disabled={isInitializing || !textureSettings.sparkles.enabled}/>
                               <span className="text-xs w-8 text-right font-mono">{Math.round(textureSettings.sparkles.volume * 100)}</span>
                          </div>
                      </div>
                       <div className="p-2 border rounded-md">
                          <div className="flex justify-between items-center mb-1">
                              <Label className="font-semibold flex items-center gap-1.5 text-sm"><Waves className="h-4 w-4"/>Pads</Label>
                              <Switch checked={textureSettings.pads.enabled} onCheckedChange={(c) => handleTextureEnabledChange('pads', c)} disabled={isInitializing}/>
                          </div>
                          <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground"><Speaker className="h-3 w-3 inline-block mr-1"/>Volume</Label>
                              <Slider value={[textureSettings.pads.volume]} max={1} step={0.05} onValueChange={(v) => handleVolumeChange('pads', v[0])} disabled={isInitializing || !textureSettings.pads.enabled}/>
                              <span className="text-xs w-8 text-right font-mono">{Math.round(textureSettings.pads.volume * 100)}</span>
                          </div>
                      </div>
                       <div className="p-2 border rounded-md">
                          <div className="flex justify-between items-center mb-1">
                              <Label className="font-semibold flex items-center gap-1.5 text-sm"><Drum className="h-4 w-4"/>Drums</Label>
                               <Select value={drumSettings.pattern} onValueChange={(v) => setDrumSettings(d => ({...d, pattern: v as any}))} disabled={isInitializing || isPlaying}>
                                  <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                      <SelectItem value="none" className="text-xs">None</SelectItem>
                                      <SelectItem value="ambient_beat" className="text-xs">Ambient</SelectItem>
                                      <SelectItem value="composer" className="text-xs">Composer</SelectItem>
                                  </SelectContent>
                              </Select>
                          </div>
                          <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground"><Speaker className="h-3 w-3 inline-block mr-1"/>Volume</Label>
                              <Slider value={[drumSettings.volume]} max={1} step={0.05} onValueChange={(v) => setDrumSettings(d => ({...d, volume: v[0]}))} disabled={isInitializing || drumSettings.pattern === 'none'}/>
                               <span className="text-xs w-8 text-right font-mono">{Math.round(drumSettings.volume * 100)}</span>
                          </div>
                      </div>
                  </CardContent>
              </Card>
            </TabsContent>
          </div>

        </Tabs>
      </main>
    </div>
  );
}

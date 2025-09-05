
"use client";

import { SlidersHorizontal, Music, Pause, Speaker, FileMusic, Drum, GitBranch, Atom, Piano, Home, X, Sparkles, Sprout, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { AuraGrooveProps } from "./aura-groove";
import { useRouter } from "next/navigation";

const EQ_BANDS = [
  { freq: '60', label: '60' }, { freq: '125', label: '125' }, { freq: '250', label: '250' },
  { freq: '500', label: '500' }, { freq: '1k', label: '1k' }, { freq: '2k', label: '2k' }, { freq: '4k', label: '4k' },
];

export function AuraGrooveV2({
  isPlaying, isInitializing, handleTogglePlay, drumSettings, setDrumSettings, instrumentSettings,
  setInstrumentSettings, handleBassTechniqueChange, handleVolumeChange, textureSettings, handleTextureEnabledChange,
  bpm, handleBpmChange, score, handleScoreChange, density, setDensity, handleGoHome,
  isEqModalOpen, setIsEqModalOpen, eqSettings, handleEqChange,
}: AuraGrooveProps) {

  const router = useRouter();

  const handleBack = () => {
    router.push('/aura-groove');
  };
  
  return (
    <div className="w-full max-w-md h-[calc(100vh-2rem)] flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-primary">AuraGroove</h1>
            <p className="text-xs text-muted-foreground">Your personal pure digital ambient music generator</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleGoHome} aria-label="Go to Home"><Home className="h-5 w-5" /></Button>
            <Button variant="ghost" size="icon" onClick={handleBack} aria-label="Go to original UI"><LayoutList className="h-5 w-5" /></Button>
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
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-grow overflow-y-auto">
        <Tabs defaultValue="composition" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="composition">Composition</TabsTrigger>
            <TabsTrigger value="instruments">Instruments</TabsTrigger>
            <TabsTrigger value="samples">Samples</TabsTrigger>
          </TabsList>
          
          <TabsContent value="composition" className="space-y-4 pt-4">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><FileMusic className="h-5 w-5"/> Composition</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor="score-selector" className="text-right">Style</Label>
                    <Select value={score} onValueChange={(v) => handleScoreChange(v as any)} disabled={isInitializing || isPlaying}>
                        <SelectTrigger id="score-selector" className="col-span-2"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="dreamtales">Dreamtales</SelectItem>
                            <SelectItem value="evolve">Evolve</SelectItem>
                            <SelectItem value="omega">Omega</SelectItem>
                            <SelectItem value="journey">Journey</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="bpm-slider" className="text-right">BPM</Label>
                  <Slider id="bpm-slider" value={[bpm]} min={60} max={160} step={5} onValueChange={(v) => handleBpmChange(v[0])} className="col-span-2" disabled={isInitializing}/>
                </div>
                <div className="grid grid-cols-3 items-center gap-4">
                  <Label htmlFor="density-slider" className="text-right">Density</Label>
                  <Slider id="density-slider" value={[density]} min={0.1} max={1} step={0.05} onValueChange={(v) => setDensity(v[0])} className="col-span-2" disabled={isInitializing}/>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="instruments" className="space-y-4 pt-4">
            <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><SlidersHorizontal className="h-5 w-5"/> Instruments</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    {Object.entries(instrumentSettings).map(([part, settings]) => (
                        <div key={part} className="p-3 border rounded-lg">
                           <div className="flex justify-between items-center mb-2">
                                <Label className="font-semibold flex items-center gap-2 capitalize"><Waves className="h-5 w-5"/>{part}</Label>
                                <Select value={settings.name} onValueChange={(v) => setInstrumentSettings(part as any, v as any)} disabled={isInitializing || isPlaying}>
                                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {(part === 'bass' ? ['classicBass', 'glideBass', 'ambientDrone', 'resonantGliss', 'hypnoticDrone', 'livingRiff', 'none'] : ['synth', 'organ', 'mellotron', 'theremin', 'none']).map(inst => (
                                          <SelectItem key={inst} value={inst}>{inst.charAt(0).toUpperCase() + inst.slice(1).replace(/([A-Z])/g, ' $1')}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                             {part === 'bass' && (
                                <div className="flex justify-between items-center mb-2">
                                    <Label className="font-semibold flex items-center gap-2 capitalize"><GitBranch className="h-5 w-5"/>Technique</Label>
                                     <Select value={settings.technique} onValueChange={(v) => handleBassTechniqueChange(v as any)} disabled={isInitializing || isPlaying || settings.name === 'none'}>
                                        <SelectTrigger className="w-[180px]"><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="arpeggio">Arpeggio</SelectItem>
                                            <SelectItem value="portamento">Portamento</SelectItem>
                                            <SelectItem value="glissando">Glissando</SelectItem>
                                            <SelectItem value="glide">Glide</SelectItem>
                                            <SelectItem value="pulse">Pulse</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Label className="text-sm text-muted-foreground"><Speaker className="h-4 w-4 inline-block mr-1"/>Volume</Label>
                                <Slider value={[settings.volume]} max={1} step={0.05} onValueChange={(v) => handleVolumeChange(part as any, v[0])} disabled={isInitializing || settings.name === 'none'}/>
                                <span className="text-sm w-8 text-right font-mono">{Math.round(settings.volume * 100)}</span>
                            </div>
                        </div>
                    ))}
                </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="samples" className="space-y-4 pt-4">
             <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Atom className="h-5 w-5"/> Sampled Textures</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="p-3 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <Label className="font-semibold flex items-center gap-2"><Sparkles className="h-5 w-5"/>Sparkles</Label>
                            <Switch checked={textureSettings.sparkles.enabled} onCheckedChange={(c) => handleTextureEnabledChange('sparkles', c)} disabled={isInitializing}/>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground"><Speaker className="h-4 w-4 inline-block mr-1"/>Volume</Label>
                            <Slider value={[textureSettings.sparkles.volume]} max={1} step={0.05} onValueChange={(v) => handleVolumeChange('sparkles', v[0])} disabled={isInitializing || !textureSettings.sparkles.enabled}/>
                             <span className="text-sm w-8 text-right font-mono">{Math.round(textureSettings.sparkles.volume * 100)}</span>
                        </div>
                    </div>
                     <div className="p-3 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <Label className="font-semibold flex items-center gap-2"><Waves className="h-5 w-5"/>Pads</Label>
                            <Switch checked={textureSettings.pads.enabled} onCheckedChange={(c) => handleTextureEnabledChange('pads', c)} disabled={isInitializing}/>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground"><Speaker className="h-4 w-4 inline-block mr-1"/>Volume</Label>
                            <Slider value={[textureSettings.pads.volume]} max={1} step={0.05} onValueChange={(v) => handleVolumeChange('pads', v[0])} disabled={isInitializing || !textureSettings.pads.enabled}/>
                            <span className="text-sm w-8 text-right font-mono">{Math.round(textureSettings.pads.volume * 100)}</span>
                        </div>
                    </div>
                     <div className="p-3 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                            <Label className="font-semibold flex items-center gap-2"><Drum className="h-5 w-5"/>Drums</Label>
                             <Select value={drumSettings.pattern} onValueChange={(v) => setDrumSettings(d => ({...d, pattern: v as any}))} disabled={isInitializing || isPlaying}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">None</SelectItem>
                                    <SelectItem value="ambient_beat">Ambient</SelectItem>
                                    <SelectItem value="composer">Composer</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Label className="text-sm text-muted-foreground"><Speaker className="h-4 w-4 inline-block mr-1"/>Volume</Label>
                            <Slider value={[drumSettings.volume]} max={1} step={0.05} onValueChange={(v) => setDrumSettings(d => ({...d, volume: v[0]}))} disabled={isInitializing || drumSettings.pattern === 'none'}/>
                             <span className="text-sm w-8 text-right font-mono">{Math.round(drumSettings.volume * 100)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 pt-4 mt-auto">
        <Card className="shadow-none border-t border-border rounded-none -mx-4 -mb-4 sm:-mx-6 sm:-mb-6">
            <CardContent className="p-4 flex flex-col items-center gap-2">
                 <p className="text-muted-foreground text-sm min-h-[20px]">
                    {isPlaying ? `Playing at ${bpm} BPM...` : "Press play to start the music"}
                 </p>
                 <Button type="button" onClick={handleTogglePlay} disabled={isInitializing} className="w-full max-w-xs text-lg py-6">
                    {isPlaying ? <Pause className="mr-2 h-6 w-6" /> : <Music className="mr-2 h-6 w-6" />}
                    {isPlaying ? "Stop" : "Play"}
                 </Button>
            </CardContent>
        </Card>
      </footer>
    </div>
  );
}


"use client";

import { Loader2, Music, Pause, Speaker, FileMusic, Drum, SlidersHorizontal, Waves, GitBranch, Atom, Piano, Home, X, Sparkles, Sprout, LayoutGrid, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import Image from 'next/image';
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { DrumSettings, InstrumentSettings, ScoreName, BassInstrument, InstrumentPart, MelodyInstrument, AccompanimentInstrument, BassTechnique, TextureSettings, TimerSettings } from '@/types/music';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useRouter } from "next/navigation";
import { BASS_PRESETS } from "@/lib/bass-presets";
import { getPresetParams } from "@/lib/presets";


// This is now a "dumb" UI component controlled by the useAuraGroove hook.
export type AuraGrooveProps = {
  isPlaying: boolean;
  isInitializing: boolean;
  loadingText: string;
  drumSettings: DrumSettings;
  setDrumSettings: (settings: React.SetStateAction<DrumSettings>) => void;
  instrumentSettings: InstrumentSettings;
  setInstrumentSettings: (part: keyof InstrumentSettings, name: BassInstrument | MelodyInstrument | AccompanimentInstrument) => void;
  handleBassTechniqueChange: (technique: BassTechnique) => void;
  handleVolumeChange: (part: InstrumentPart, value: number) => void;
  textureSettings: TextureSettings;
  handleTextureEnabledChange: (part: 'sparkles' | 'pads', enabled: boolean) => void;
  bpm: number;
  handleBpmChange: (value: number) => void;
  score: ScoreName;
  handleScoreChange: (value: ScoreName) => void;
  handleTogglePlay: () => void;
  density: number;
  setDensity: (value: number) => void;
  handleGoHome: () => void;
  handleExit: () => void;
  isEqModalOpen: boolean;
  setIsEqModalOpen: (isOpen: boolean) => void;
  eqSettings: number[];
  handleEqChange: (bandIndex: number, gain: number) => void;
  timerSettings: TimerSettings;
  handleTimerDurationChange: (minutes: number) => void;
  handleToggleTimer: () => void;
};

const EQ_BANDS = [
  { freq: '60', label: '60' },
  { freq: '125', label: '125' },
  { freq: '250', label: '250' },
  { freq: '500', label: '500' },
  { freq: '1k', label: '1k' },
  { freq: '2k', label: '2k' },
  { freq: '4k', label: '4k' },
];

export function AuraGroove({
  isPlaying,
  isInitializing,
  loadingText,
  drumSettings,
  setDrumSettings,
  instrumentSettings,
  setInstrumentSettings,
  handleBassTechniqueChange,
  handleVolumeChange,
  textureSettings,
  handleTextureEnabledChange,
  bpm,
  handleBpmChange,
  score,
  handleScoreChange,
  handleTogglePlay,
  density,
  setDensity,
  handleGoHome,
  handleExit,
  isEqModalOpen,
  setIsEqModalOpen,
  eqSettings,
  handleEqChange,
  timerSettings,
  handleTimerDurationChange,
  handleToggleTimer,
}: AuraGrooveProps) {

  const router = useRouter();

  const getPartColor = (part: keyof InstrumentSettings) => {
    const instrumentName = instrumentSettings[part].name;
    if (instrumentName === 'none') return 'hsl(var(--muted-foreground))';
    if (part === 'bass') {
        const preset = BASS_PRESETS[instrumentName as BassInstrument];
        return preset?.color || 'hsl(var(--foreground))';
    }
    // For melody and accompaniment, we can define some default colors
    switch (instrumentName) {
        case 'synth': return '#8B5CF6'; // A nice purple
        case 'organ': return '#38BDF8'; // A sky blue
        case 'mellotron': return '#F97316'; // A warm orange
        case 'theremin': return '#EC4899'; // A vibrant pink
        default: return 'hsl(var(--foreground))';
    }
  };

  const PartIcon = ({ part }: { part: keyof InstrumentSettings }) => {
    const color = getPartColor(part);
    const iconProps = { className: "h-5 w-5", style: { color } };
    
    switch (part) {
        case 'bass': return <Waves {...iconProps} />;
        case 'melody': return <GitBranch {...iconProps} />;
        case 'accompaniment': return <Piano {...iconProps} />;
        default: return <Music {...iconProps} />;
    }
  };


  if (isInitializing) {
    return (
        <Card className="w-full max-w-lg shadow-2xl">
            <CardHeader className="text-center">
                 <div className="mx-auto mb-4">
                    <Image src="/assets/icon8.jpeg" alt="AuraGroove Logo" width={64} height={64} className="rounded-full" />
                </div>
                <CardTitle className="font-headline text-3xl">AuraGroove</CardTitle>
                <CardDescription>AI-powered ambient music generator</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2 min-h-[40px]">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <p>{loadingText || "Loading..."}</p>
                </div>
            </CardContent>
             <CardFooter className="flex-col gap-4">
                <Button disabled className="w-full text-lg py-6">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Initializing...
                </Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <Card className="w-full max-w-lg shadow-2xl relative">
       <div className="absolute top-2 right-2 flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => router.push('/aura-groove')} aria-label="Switch to new UI">
                <LayoutGrid className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleGoHome} aria-label="Go to Home">
                <Home className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleExit} aria-label="Exit Application">
                <X className="h-5 w-5" />
            </Button>
            <Dialog open={isEqModalOpen} onOpenChange={setIsEqModalOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" className="h-9 w-9 px-2" aria-label="Open Equalizer">
                        EQ
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>System Equalizer</DialogTitle>
                    </DialogHeader>
                    <div className="flex justify-around items-end pt-4 h-48">
                        {EQ_BANDS.map((band, index) => (
                            <div key={index} className="flex flex-col items-center justify-end space-y-2">
                                <span className="text-xs font-mono text-muted-foreground">
                                    {eqSettings[index] > 0 ? '+' : ''}{eqSettings[index].toFixed(1)}
                                </span>
                                <Slider
                                    value={[eqSettings[index]]}
                                    min={-10}
                                    max={10}
                                    step={0.5}
                                    onValueChange={(v) => handleEqChange(index, v[0])}
                                    orientation="vertical"
                                    className="h-32"
                                />
                                <Label className="text-xs text-muted-foreground">{band.label}</Label>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      <CardHeader className="text-center pt-12">
        <div className="mx-auto mb-4">
            <Image src="/assets/icon8.jpeg" alt="AuraGroove Logo" width={64} height={64} className="rounded-full" />
        </div>
        <CardTitle className="font-headline text-3xl">AuraGroove</CardTitle>
        <CardDescription>Your personal pure digital ambient music generator</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        <div className="space-y-4 rounded-lg border p-4">
            <h3 className="text-lg font-medium text-primary flex items-center gap-2"><FileMusic className="h-5 w-5"/> Composition</h3>
            <div className="grid grid-cols-3 items-center gap-4">
                 <Label htmlFor="score-selector" className="text-right">Style</Label>
                 <Select
                    value={score}
                    onValueChange={(v) => handleScoreChange(v as ScoreName)}
                    disabled={isInitializing || isPlaying}
                    >
                    <SelectTrigger id="score-selector" className="col-span-2">
                        <SelectValue placeholder="Select score" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="dreamtales">Dreamtales (Anchor)</SelectItem>
                        <SelectItem value="evolve">Evolve (L-Logic)</SelectItem>
                        <SelectItem value="omega">Omega (Fractal)</SelectItem>
                        <SelectItem value="journey">Journey</SelectItem>
                        <SelectItem value="multeity">Multeity (Prog)</SelectItem>
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
                    onValueChange={(v) => handleBpmChange(v[0])}
                    className="col-span-2"
                    disabled={isInitializing}
                />
            </div>
             <div className="grid grid-cols-3 items-center gap-4">
                <Label className="text-right flex items-center gap-1.5"><Atom className="h-4 w-4" /> Density</Label>
                <Slider
                    value={[density]}
                    min={0.1}
                    max={1}
                    step={0.05}
                    onValueChange={(v) => setDensity(v[0])}
                    className="col-span-2"
                    disabled={isInitializing}
                />
            </div>
        </div>
        
        <div className="space-y-4 rounded-lg border p-4">
           <h3 className="text-lg font-medium text-primary flex items-center gap-2"><SlidersHorizontal className="h-5 w-5" /> Instrument Channels</h3>
            {(Object.keys(instrumentSettings) as Array<keyof InstrumentSettings>).map((part) => {
                const settings = instrumentSettings[part];
                let instrumentList: (BassInstrument | MelodyInstrument | AccompanimentInstrument | 'none')[] = [];
                if (part === 'bass') {
                    instrumentList = ['classicBass', 'glideBass', 'ambientDrone', 'resonantGliss', 'hypnoticDrone', 'livingRiff', 'none'];
                } else if (part === 'melody' || part === 'accompaniment') {
                    instrumentList = ['synth', 'organ', 'mellotron', 'theremin', 'none'];
                }

                return (
                 <div key={part} className="space-y-3 rounded-md border p-3">
                     <div className="flex justify-between items-center">
                        <Label htmlFor={`${part}-instrument`} className="font-semibold flex items-center gap-2 capitalize">
                           <PartIcon part={part} /> {part}
                        </Label>
                         <Select
                          value={settings.name}
                          onValueChange={(v) => setInstrumentSettings(part as any, v as any)}
                          disabled={isInitializing || isPlaying}
                        >
                          <SelectTrigger id={`${part}-instrument`} className="w-[150px]">
                            <SelectValue placeholder="Select instrument" />
                          </SelectTrigger>
                          <SelectContent>
                             {instrumentList.map(instrument => (
                                <SelectItem key={instrument} value={instrument}>{instrument.charAt(0).toUpperCase() + instrument.slice(1).replace(/([A-Z])/g, ' $1')}</SelectItem>
                             ))}
                          </SelectContent>
                        </Select>
                    </div>

                    {part === 'bass' && 'technique' in settings && (
                        <div className="flex justify-between items-center">
                            <Label htmlFor="bass-technique" className="font-semibold flex items-center gap-2 capitalize">Technique</Label>
                            <Select
                                value={settings.technique}
                                onValueChange={(v) => handleBassTechniqueChange(v as BassTechnique)}
                                disabled={isInitializing || isPlaying || settings.name === 'none'}
                            >
                                <SelectTrigger id="bass-technique" className="w-[150px]">
                                    <SelectValue placeholder="Select technique" />
                                </SelectTrigger>
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


                     <div className="space-y-2 pt-2">
                         <div className="flex items-center justify-between">
                             <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                             <span className="text-xs font-mono text-muted-foreground">{Math.round(settings.volume * 100)}</span>
                         </div>
                         <Slider 
                            value={[settings.volume]} 
                            max={1} 
                            step={0.05} 
                            onValueChange={(v) => handleVolumeChange(part as InstrumentPart, v[0])} 
                            disabled={isInitializing || settings.name === 'none'}
                            style={{ '--slider-color': getPartColor(part) } as React.CSSProperties}
                            className="[&>span>span]:bg-[var(--slider-color)]"
                         />
                    </div>
                 </div>
                )
            })}
        </div>

        <div className="space-y-4 rounded-lg border p-4">
          <h3 className="text-lg font-medium text-primary flex items-center gap-2"><Sprout className="h-5 w-5" /> Textures</h3>
          
          <div className="space-y-3 rounded-md border p-3">
              <div className="flex justify-between items-center">
                  <Label htmlFor="sparkles-switch" className="font-semibold flex items-center gap-2">
                      <Sparkles className="h-5 w-5" /> Sparkles
                  </Label>
                  <Switch
                      id="sparkles-switch"
                      checked={textureSettings.sparkles.enabled}
                      onCheckedChange={(checked) => handleTextureEnabledChange('sparkles', checked)}
                      disabled={isInitializing}
                  />
              </div>
              <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                      <span className="text-xs font-mono text-muted-foreground">{Math.round(textureSettings.sparkles.volume * 100)}</span>
                  </div>
                  <Slider 
                      value={[textureSettings.sparkles.volume]} 
                      max={1} 
                      step={0.05} 
                      onValueChange={(v) => handleVolumeChange('sparkles', v[0])}
                      disabled={isInitializing || !textureSettings.sparkles.enabled}
                  />
              </div>
          </div>
          
          <div className="space-y-3 rounded-md border p-3">
              <div className="flex justify-between items-center">
                  <Label htmlFor="pads-switch" className="font-semibold flex items-center gap-2">
                      <Waves className="h-5 w-5" /> Pads
                  </Label>
                  <Switch
                      id="pads-switch"
                      checked={textureSettings.pads.enabled}
                      onCheckedChange={(checked) => handleTextureEnabledChange('pads', checked)}
                      disabled={isInitializing}
                  />
              </div>
              <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Speaker className="h-4 w-4"/> Volume</Label>
                      <span className="text-xs font-mono text-muted-foreground">{Math.round(textureSettings.pads.volume * 100)}</span>
                  </div>
                  <Slider 
                      value={[textureSettings.pads.volume]} 
                      max={1} 
                      step={0.05} 
                      onValueChange={(v) => handleVolumeChange('pads', v[0])}
                      disabled={isInitializing || !textureSettings.pads.enabled}
                  />
              </div>
          </div>
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
                     <Slider value={[drumSettings.volume]} max={1} step={0.05} onValueChange={(v) => setDrumSettings(d => ({...d, volume: v[0]}))} disabled={isInitializing || drumSettings.pattern === 'none'} />
                </div>
             </div>
        </div>

         {!isPlaying && (
            <p className="text-muted-foreground text-center min-h-[40px] flex items-center justify-center px-4">
              Press play to start the music.
            </p>
        )}
        {isPlaying && (
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
            {isPlaying ? (
              <Pause className="mr-2 h-6 w-6" />
            ) : (
              <Music className="mr-2 h-6 w-6" />
            )}
            {isPlaying ? "Stop" : "Play"}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

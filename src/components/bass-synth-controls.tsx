
"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Settings } from "lucide-react";

export type BassSynthParams = {
  oscillator: {
    harmonicity: number;
  };
  envelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
  };
  filter: {
    Q: number;
  };
  filterEnvelope: {
    attack: number;
    decay: number;
    sustain: number;
    release: number;
    baseFrequency: number;
    octaves: number;
  };
};

type BassSynthControlsProps = {
  params: BassSynthParams;
  setParams: (params: BassSynthParams) => void;
  disabled?: boolean;
};

const ParamSlider = ({ label, value, min, max, step, onChange, unit = '' }: { label: string, value: number, min: number, max: number, step: number, onChange: (value: number) => void, unit?: string }) => (
  <div className="grid grid-cols-3 items-center gap-4">
    <Label className="text-right">{label}</Label>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onChange(v[0])}
      className="col-span-2"
    />
    <div className="col-start-3 col-span-1 text-xs text-muted-foreground text-center -mt-2">{value.toFixed(3)}{unit}</div>
  </div>
);

export function BassSynthControls({ params, setParams, disabled }: BassSynthControlsProps) {
  
  const handleParamChange = (category: keyof BassSynthParams, param: string, value: number) => {
    setParams({
      ...params,
      [category]: {
        // @ts-ignore
        ...params[category],
        [param]: value,
      },
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" disabled={disabled}>
          <Settings className="h-4 w-4" />
          <span className="sr-only">Open Bass Synth Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Bass Synth Controls</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div>
            <h4 className="text-md font-medium text-primary mb-3">Oscillator</h4>
            <ParamSlider 
                label="Harmonicity" 
                value={params.oscillator.harmonicity}
                min={0.1} max={5} step={0.1}
                onChange={(v) => handleParamChange('oscillator', 'harmonicity', v)} />
          </div>

          <div>
            <h4 className="text-md font-medium text-primary mb-3">Amplitude Envelope</h4>
            <ParamSlider label="Attack" value={params.envelope.attack} min={0.001} max={1} step={0.01} onChange={(v) => handleParamChange('envelope', 'attack', v)} />
            <ParamSlider label="Decay" value={params.envelope.decay} min={0.001} max={2} step={0.01} onChange={(v) => handleParamChange('envelope', 'decay', v)} />
            <ParamSlider label="Sustain" value={params.envelope.sustain} min={0} max={1} step={0.01} onChange={(v) => handleParamChange('envelope', 'sustain', v)} />
            <ParamSlider label="Release" value={params.envelope.release} min={0.001} max={4} step={0.01} onChange={(v) => handleParamChange('envelope', 'release', v)} />
          </div>
          
          <div>
            <h4 className="text-md font-medium text-primary mb-3">Filter</h4>
             <ParamSlider label="Resonance (Q)" value={params.filter.Q} min={0} max={10} step={0.1} onChange={(v) => handleParamChange('filter', 'Q', v)} />
          </div>
          
          <div>
            <h4 className="text-md font-medium text-primary mb-3">Filter Envelope</h4>
            <ParamSlider label="Attack" value={params.filterEnvelope.attack} min={0.001} max={2} step={0.01} onChange={(v) => handleParamChange('filterEnvelope', 'attack', v)} />
            <ParamSlider label="Decay" value={params.filterEnvelope.decay} min={0.001} max={2} step={0.01} onChange={(v) => handleParamChange('filterEnvelope', 'decay', v)} />
            <ParamSlider label="Sustain" value={params.filterEnvelope.sustain} min={0} max={1} step={0.01} onChange={(v) => handleParamChange('filterEnvelope', 'sustain', v)} />
            <ParamSlider label="Release" value={params.filterEnvelope.release} min={0.001} max={4} step={0.01} onChange={(v) => handleParamChange('filterEnvelope', 'release', v)} />
            <ParamSlider label="Base Frequency" value={params.filterEnvelope.baseFrequency} min={20} max={1000} step={10} onChange={(v) => handleParamChange('filterEnvelope', 'baseFrequency', v)} unit=" Hz" />
            <ParamSlider label="Octaves" value={params.filterEnvelope.octaves} min={0} max={10} step={0.1} onChange={(v) => handleParamChange('filterEnvelope', 'octaves', v)} />
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}

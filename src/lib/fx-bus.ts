
import * as Tone from 'tone';

/**
 * A central multi-channel mixer (FX Bus) to route all instruments through.
 * This allows for applying both individual channel effects and master effects.
 */
export class FxBus {
    public masterChannel: Tone.Channel;

    public soloDistortion: Tone.Distortion;
    public accompanimentChorus: Tone.Chorus;
    public bassDistortion: Tone.Distortion; // Added for the "Iron Man" bass sound

    public soloInput: Tone.Gain;
    public accompanimentInput: Tone.Gain;
    public bassInput: Tone.Gain;
    public drumInput: Tone.Channel; // Changed from Gain to Channel
    public effectsInput: Tone.Gain;

    constructor() {
        this.masterChannel = new Tone.Channel({ volume: 0 });
        this.masterChannel.toDestination();

        this.soloDistortion = new Tone.Distortion({ distortion: 0.4, wet: 0 });
        this.accompanimentChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 });
        this.bassDistortion = new Tone.Distortion({ distortion: 0.1, wet: 1.0 }); // Subtle distortion for bass
        
        this.soloInput = new Tone.Gain().chain(this.soloDistortion, this.masterChannel);
        this.accompanimentInput = new Tone.Gain().chain(this.accompanimentChorus, this.masterChannel);
        this.bassInput = new Tone.Gain().chain(this.bassDistortion, this.masterChannel); // Bass now goes through distortion
        this.drumInput = new Tone.Channel({ volume: 0, pan: 0 }).connect(this.masterChannel); // Using a Channel for robust volume control
        this.effectsInput = new Tone.Gain().connect(this.masterChannel);
    }
    
    public dispose() {
        this.soloDistortion.dispose();
        this.accompanimentChorus.dispose();
        this.bassDistortion.dispose();
        
        this.soloInput.dispose();
        this.accompanimentInput.dispose();
        this.bassInput.dispose();
        this.drumInput.dispose();
        this.effectsInput.dispose();

        this.masterChannel.dispose();
    }
}

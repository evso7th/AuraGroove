
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
    public drumInput: Tone.Gain;
    public effectsInput: Tone.Gain;

    constructor() {
        console.log("FXBUS_TRACE: Constructor called.");
        this.masterChannel = new Tone.Channel({ volume: 0 });
        this.masterChannel.toDestination();
        console.log("FXBUS_TRACE: Master channel created and connected to destination.");

        this.soloDistortion = new Tone.Distortion({ distortion: 0.4, wet: 0 });
        this.accompanimentChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 });
        this.bassDistortion = new Tone.Distortion({ distortion: 0.3, wet: 0 }); 
        
        console.log(`FXBUS_TRACE: Bass distortion created with distortion=${this.bassDistortion.distortion} and wet=${this.bassDistortion.wet.value}`);

        this.soloInput = new Tone.Gain().chain(this.soloDistortion, this.masterChannel);
        this.accompanimentInput = new Tone.Gain().chain(this.accompanimentChorus, this.masterChannel);
        this.bassInput = new Tone.Gain().chain(this.bassDistortion, this.masterChannel); 
        this.drumInput = new Tone.Gain({ gain: 0, units: 'decibels' }).connect(this.masterChannel);
        this.effectsInput = new Tone.Gain().connect(this.masterChannel);
        
        console.log(`FXBUS_TRACE: Input gains created. Initial values: bass=${this.bassInput.gain.value}, drums=${this.drumInput.gain.value}`);
    }
    
    public dispose() {
        console.log("FXBUS_TRACE: Dispose called.");
        this.soloDistortion.dispose();
        this.accompanimentChorus.dispose();
        this.bassDistortion.dispose();
        
        this.soloInput.dispose();
        this.accompanimentInput.dispose();
        this.bassInput.dispose();
        this.drumInput.dispose();
        this.effectsInput.dispose();

        this.masterChannel.dispose();
        console.log("FXBUS_TRACE: All nodes disposed.");
    }
}

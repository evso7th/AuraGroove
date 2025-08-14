
import * as Tone from 'tone';

/**
 * A central multi-channel mixer (FX Bus) to route all instruments through.
 * This allows for applying both individual channel effects and master effects.
 * This revised version simplifies routing to ensure signal path integrity.
 */
export class FxBus {
    // Master channel for global effects
    public masterChannel: Tone.Channel;
    public masterReverb: Tone.Reverb;
    public masterDelay: Tone.FeedbackDelay;

    // Individual effects for each instrument type
    public soloDistortion: Tone.Distortion;
    public accompanimentChorus: Tone.Chorus;

    // Direct inputs for each instrument.
    // These act as entry points to the mixer bus.
    public soloInput: Tone.Gain;
    public accompanimentInput: Tone.Gain;
    public bassInput: Tone.Gain;
    public drumInput: Tone.Gain;

    constructor() {
        // 1. Create the master channel which everything will eventually flow into.
        this.masterChannel = new Tone.Channel({ volume: 0 });

        // 2. Create master effects.
        this.masterReverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.01, wet: 0.3 });
        this.masterDelay = new Tone.FeedbackDelay({ delayTime: 0.5, feedback: 0.3, wet: 0.2 });
        
        // 3. Chain master effects and connect to the final destination.
        this.masterChannel.chain(this.masterDelay, this.masterReverb, Tone.Destination);

        // 4. Create individual effects for each channel.
        this.soloDistortion = new Tone.Distortion({ distortion: 0.4, wet: 0 });
        this.accompanimentChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 });
        
        // 5. Create direct inputs for each instrument and route them correctly.
        this.soloInput = new Tone.Gain();
        this.soloInput.chain(this.soloDistortion, this.masterChannel);

        this.accompanimentInput = new Tone.Gain();
        this.accompanimentInput.chain(this.accompanimentChorus, this.masterChannel);

        // Bass and Drums go directly to the master channel as they have no individual effects currently.
        this.bassInput = new Tone.Gain().connect(this.masterChannel);
        this.drumInput = new Tone.Gain().connect(this.masterChannel);
    }
    
    public dispose() {
        // Dispose individual effects first
        this.soloDistortion.dispose();
        this.accompanimentChorus.dispose();
        
        // Dispose Gain nodes
        this.soloInput.dispose();
        this.accompanimentInput.dispose();
        this.bassInput.dispose();
        this.drumInput.dispose();

        // Dispose master effects and channel
        this.masterReverb.dispose();
        this.masterDelay.dispose();
        this.masterChannel.dispose();
    }
}

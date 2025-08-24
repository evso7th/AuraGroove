
import * as Tone from 'tone';

/**
 * A central multi-channel mixer (FX Bus) to route all instruments through.
 * This allows for applying both individual channel effects and master effects.
 */
export class FxBus {
    public masterChannel: Tone.Channel;

    public soloDistortion: Tone.Distortion;
    public accompanimentChorus: Tone.Chorus;
    public bassDistortion: Tone.Distortion;

    public soloInput: Tone.Channel;
    public accompanimentInput: Tone.Channel;
    public bassInput: Tone.Channel;
    public drumInput: Tone.Channel;
    public effectsInput: Tone.Channel;

    constructor() {
        console.log("[AURA_TRACE] FxBus created.");
        this.masterChannel = new Tone.Channel({ volume: 0, pan: 0 }).toDestination();

        // Create effects
        this.soloDistortion = new Tone.Distortion({ distortion: 0.4, wet: 0 });
        this.accompanimentChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 });
        this.bassDistortion = new Tone.Distortion({ distortion: 0.3, wet: 0 }); 
        
        // Create dedicated channels for each instrument type
        this.soloInput = new Tone.Channel({ volume: -6 });
        this.accompanimentInput = new Tone.Channel({ volume: -6 });
        this.bassInput = new Tone.Channel({ volume: -6 });
        this.drumInput = new Tone.Channel({ volume: -Infinity });
        this.effectsInput = new Tone.Channel({ volume: -Infinity });

        // Connect channels WITH dedicated effects through their effects chain
        this.soloInput.connect(this.soloDistortion);
        this.soloDistortion.connect(this.masterChannel);
        
        this.accompanimentInput.connect(this.accompanimentChorus);
        this.accompanimentChorus.connect(this.masterChannel);
        
        this.bassInput.connect(this.bassDistortion);
        this.bassDistortion.connect(this.masterChannel);
        
        // Connect channels WITHOUT dedicated effects directly to the master
        this.drumInput.connect(this.masterChannel);
        this.effectsInput.connect(this.masterChannel);
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

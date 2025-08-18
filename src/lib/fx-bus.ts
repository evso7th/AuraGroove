
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
        console.log("FXBUS_TRACE: Constructor called.");
        this.masterChannel = new Tone.Channel({ volume: 0, pan: 0 }).toDestination();
        console.log("FXBUS_TRACE: Master channel created and connected to destination.");

        // Create effects
        this.soloDistortion = new Tone.Distortion({ distortion: 0.4, wet: 0 });
        this.accompanimentChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 });
        this.bassDistortion = new Tone.Distortion({ distortion: 0.3, wet: 0 }); 
        
        // Create dedicated channels for each instrument type
        this.soloInput = new Tone.Channel({ volume: -Infinity }).connect(this.masterChannel);
        this.accompanimentInput = new Tone.Channel({ volume: -Infinity }).connect(this.masterChannel);
        this.bassInput = new Tone.Channel({ volume: -Infinity }).connect(this.masterChannel);
        this.drumInput = new Tone.Channel({ volume: -Infinity }).connect(this.masterChannel);
        this.effectsInput = new Tone.Channel({ volume: -Infinity }).connect(this.masterChannel);

        // Chain effects within their respective channels if needed (though direct connection is simpler here)
        // For this setup, synths will connect to the channel, and the channel to the master.
        // We will manage effects on the synth managers themselves for more clarity.
        // This class now primarily serves as the final mixing stage.
        
        console.log(`FXBUS_TRACE: Instrument channels created. Initial volumes: solo=${this.soloInput.volume.value}, accomp=${this.accompanimentInput.volume.value}, bass=${this.bassInput.volume.value}`);
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


import * as Tone from 'tone';

/**
 * A central multi-channel mixer (FX Bus) to route all instruments through.
 * This allows for applying both individual channel effects and master effects.
 */
export class FxBus {
    // Master channel for global effects
    public masterChannel: Tone.Channel;
    public masterReverb: Tone.Reverb;
    public masterDelay: Tone.FeedbackDelay;

    // Individual channels for each instrument type
    public soloChannel: Tone.Channel;
    public accompanimentChannel: Tone.Channel;
    public bassChannel: Tone.Channel;
    public drumChannel: Tone.Channel;

    // Individual effects
    public soloDistortion: Tone.Distortion;
    public accompanimentChorus: Tone.Chorus;

    constructor() {
        // 1. Create individual instrument channels
        this.soloChannel = new Tone.Channel({ volume: -3, pan: -0.1 }).toDestination();
        this.accompanimentChannel = new Tone.Channel({ volume: -9, pan: 0.1 }).toDestination();
        this.bassChannel = new Tone.Channel({ volume: 0 }).toDestination();
        this.drumChannel = new Tone.Channel({ volume: -6 }).toDestination();

        // 2. Create and connect individual effects to their channels
        this.soloDistortion = new Tone.Distortion({ distortion: 0.4, wet: 0 }).toDestination();
        this.soloChannel.connect(this.soloDistortion);
        
        this.accompanimentChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 }).toDestination();
        this.accompanimentChannel.connect(this.accompanimentChorus);
        
        // 3. Create the master channel
        this.masterChannel = new Tone.Channel({ volume: 0 }).toDestination();

        // 4. Connect all individual channels to the master channel
        this.soloDistortion.connect(this.masterChannel);
        this.accompanimentChorus.connect(this.masterChannel);
        this.bassChannel.connect(this.masterChannel);
        this.drumChannel.connect(this.masterChannel);

        // 5. Create and chain master effects from the master channel
        this.masterReverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.01, wet: 0.3 });
        this.masterDelay = new Tone.FeedbackDelay({ delayTime: 0.5, feedback: 0.3, wet: 0.2 });
        this.masterChannel.chain(this.masterDelay, this.masterReverb, Tone.Destination);
    }

    // Expose inputs for each instrument channel
    public get soloInput() { return this.soloChannel; }
    public get accompanimentInput() { return this.accompanimentChannel; }
    public get bassInput() { return this.bassChannel; }
    public get drumInput() { return this.drumChannel; }
    
    public dispose() {
        // Dispose individual effects first
        this.soloDistortion.dispose();
        this.accompanimentChorus.dispose();
        
        // Dispose channels
        this.soloChannel.dispose();
        this.accompanimentChannel.dispose();
        this.bassChannel.dispose();
        this.drumChannel.dispose();

        // Dispose master effects and channel
        this.masterReverb.dispose();
        this.masterDelay.dispose();
        this.masterChannel.dispose();
    }
}

    
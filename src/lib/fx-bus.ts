
import * as Tone from 'tone';

/**
 * A central multi-channel mixer (FX Bus) to route all instruments through.
 * This allows for applying both individual channel effects and master effects.
 */
export class FxBus {
    public masterChannel: Tone.Channel;
    public masterReverb: Tone.Reverb;
    public masterDelay: Tone.FeedbackDelay;

    public soloDistortion: Tone.Distortion;
    public accompanimentChorus: Tone.Chorus;

    public soloInput: Tone.Gain;
    public accompanimentInput: Tone.Gain;
    public bassInput: Tone.Gain;
    public drumInput: Tone.Gain;
    public effectsInput: Tone.Gain;

    constructor() {
        this.masterChannel = new Tone.Channel({ volume: 0 });

        this.masterReverb = new Tone.Reverb({ decay: 4.5, preDelay: 0.01, wet: 0.3 });
        this.masterDelay = new Tone.FeedbackDelay({ delayTime: 0.5, feedback: 0.3, wet: 0.2 });
        
        this.masterChannel.chain(this.masterDelay, this.masterReverb, Tone.Destination);

        this.soloDistortion = new Tone.Distortion({ distortion: 0.4, wet: 0 });
        this.accompanimentChorus = new Tone.Chorus({ frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0 });
        
        this.soloInput = new Tone.Gain().chain(this.soloDistortion, this.masterChannel);
        this.accompanimentInput = new Tone.Gain().chain(this.accompanimentChorus, this.masterChannel);
        this.bassInput = new Tone.Gain().connect(this.masterChannel);
        this.drumInput = new Tone.Gain().connect(this.masterChannel);
        this.effectsInput = new Tone.Gain().connect(this.masterChannel);
    }
    
    public dispose() {
        this.soloDistortion.dispose();
        this.accompanimentChorus.dispose();
        
        this.soloInput.dispose();
        this.accompanimentInput.dispose();
        this.bassInput.dispose();
        this.drumInput.dispose();
        this.effectsInput.dispose();

        this.masterReverb.dispose();
        this.masterDelay.dispose();
        this.masterChannel.dispose();
    }
}

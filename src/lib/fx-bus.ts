
import * as Tone from 'tone';

/**
 * A central channel (FX Bus) to route all melodic instruments through.
 * This allows for applying master effects and volume control.
 */
export class FxBus {
    public channel: Tone.Channel;
    public reverb: Tone.Reverb;
    public delay: Tone.FeedbackDelay;
    public chorus: Tone.Chorus;

    constructor() {
        this.channel = new Tone.Channel({
            volume: 0,
            pan: 0,
            solo: false,
            mute: false,
        });

        // Initialize effects with default (mostly dry) settings
        this.reverb = new Tone.Reverb({ 
            decay: 4.5, // seconds
            preDelay: 0.01,
            wet: 0 
        }).toDestination();
        
        this.delay = new Tone.FeedbackDelay({ 
            delayTime: 0.5, // seconds 
            feedback: 0.3, 
            wet: 0 
        });
        
        this.chorus = new Tone.Chorus({ 
            frequency: 1.5, // Hz
            delayTime: 3.5, // ms
            depth: 0.7, 
            wet: 0 
        });

        // Chain the effects: Channel -> Chorus -> Delay -> Reverb -> Destination
        this.channel.chain(this.chorus, this.delay, this.reverb);
    }

    public get input() {
        return this.channel;
    }
    
    public dispose() {
        this.reverb.dispose();
        this.delay.dispose();
        this.chorus.dispose();
        this.channel.dispose();
    }
}

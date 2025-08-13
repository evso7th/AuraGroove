import * as Tone from 'tone';

/**
 * A central channel (FX Bus) to route all melodic instruments through.
 * This allows for applying master effects and volume control.
 */
class FxBus {
    public channel: Tone.Channel;

    constructor() {
        this.channel = new Tone.Channel({
            volume: 0,
            pan: 0,
            solo: false,
            mute: false,
        }).toDestination();
    }

    public get input() {
        return this.channel;
    }
}

// Export a singleton instance
export const fxBus = new FxBus();

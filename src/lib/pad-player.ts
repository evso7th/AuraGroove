
import * as Tone from 'tone';

const PAD_SAMPLES: Record<string, string> = {
    'Drill.ogg': '/assets/music/pads/Drill.ogg',
    'HousedBass7.ogg': '/assets/music/pads/HousedBass7.ogg',
    'SweetHarpRev1.ogg': '/assets/music/pads/SweetHarpRev1.ogg',
    'GlassBell.ogg': '/assets/music/pads/GlassBell.ogg',
    'MelancholicPad.ogg': '/assets/music/pads/MelancholicPad.ogg',
    'CloseA.ogg': '/assets/music/pads/CloseA.ogg',
    'Starter.ogg': '/assets/music/pads/Starter.ogg',
    'Electricity.ogg': '/assets/music/pads/Electricity.ogg',
    'SalvingPad.ogg': '/assets/music/pads/SalvingPad.ogg',
    'Gulls.ogg': '/assets/music/pads/Gulls.ogg',
    'BirdFX.ogg': '/assets/music/pads/BirdFX.ogg',
    'Confusion.ogg': '/assets/music/pads/Confusion.ogg',
    'Abstruse.ogg': '/assets/music/pads/Abstruse.ogg',
    'Freakystones.ogg': '/assets/music/pads/Freakystones.ogg',
    'EPstein.ogg': '/assets/music/pads/EPstein.ogg',
    'Dizzy.ogg': '/assets/music/pads/Dizzy.ogg',
    'ElectroShock.ogg': '/assets/music/pads/ElectroShock.ogg',
    'E_Rhythm.ogg': '/assets/music/pads/E_Rhythm.ogg',
    'NoiseFxB06.ogg': '/assets/music/pads/NoiseFxB06.ogg',
    'BeepFreak.ogg': '/assets/music/pads/BeepFreak.ogg',
    'Koto1.ogg': '/assets/music/pads/Koto1.ogg',
    'BladeWalker.ogg': '/assets/music/pads/BladeWalker.ogg',
    'Fearsome.ogg': '/assets/music/pads/Fearsome.ogg',
    'AcChord.ogg': '/assets/music/pads/AcChord.ogg',
    'Tubator.ogg': '/assets/music/pads/Tubator.ogg',
    'Sleep.ogg': '/assets/music/pads/Sleep.ogg',
    'Grounding.ogg': '/assets/music/pads/Grounding.ogg',
};


export class PadPlayer {
    private audioContext: AudioContext;
    private players: [Tone.Player, Tone.Player];
    private crossFade: Tone.CrossFade;
    private activePlayerIndex: number = 0;
    private outputNode: AudioNode;
    public isInitialized = false;

    constructor(audioContext: AudioContext, destination: AudioNode) {
        this.audioContext = audioContext;
        this.outputNode = destination;
        
        this.players = [
            new Tone.Player({ loop: true }),
            new Tone.Player({ loop: true })
        ];

        this.crossFade = new Tone.CrossFade(0).connect(this.outputNode);
        this.players[0].connect(this.crossFade.a);
        this.players[1].connect(this.crossFade.b);
    }

    async init() {
        if (this.isInitialized) return;
        try {
            await Tone.loaded();
            console.log('[PadPlayer] Initialized successfully.');
            this.isInitialized = true;
        } catch (e) {
            console.error('[PadPlayer] Failed to initialize:', e);
        }
    }
    
    private async loadAndPlay(player: Tone.Player, padName: string, time: number) {
        const url = PAD_SAMPLES[padName];
        if (!url) {
            console.warn(`[PadPlayer] Pad sample not found: ${padName}`);
            return;
        }
        
        try {
            if (player.loaded) {
                 player.stop(time);
            }
            await player.load(url);
            player.start(time);
        } catch (error) {
            console.error(`[PadPlayer] Error loading or playing pad ${padName}:`, error);
        }
    }

    public setPad(padName: string, time: number) {
        if (!this.isInitialized) return;

        const inactivePlayerIndex = 1 - this.activePlayerIndex;
        const inactivePlayer = this.players[inactivePlayerIndex];
        
        this.loadAndPlay(inactivePlayer, padName, time);

        // Schedule the crossfade
        this.crossFade.fade.linearRampTo(inactivePlayerIndex, 2, time);

        this.activePlayerIndex = inactivePlayerIndex;
    }
    
    public setVolume(volume: number) {
        if (this.outputNode instanceof GainNode) {
            this.outputNode.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.01);
        }
    }

    public stop() {
        const now = this.audioContext.currentTime;
        this.players.forEach(p => {
            if(p.state === 'started'){
                p.stop(now);
            }
        });
    }

    public dispose() {
        this.stop();
        this.players.forEach(p => p.dispose());
        this.crossFade.dispose();
    }
}

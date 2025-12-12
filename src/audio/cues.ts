import * as Tone from 'tone'

let reverb: Tone.Reverb | null = null
let filter: Tone.Filter | null = null
let noise: Tone.NoiseSynth | null = null
let transient: Tone.Synth | null = null

const ensureNodes = () => {
    if (!reverb) {
        reverb = new Tone.Reverb({
            decay: 0.4,
            preDelay: 0.005,
            wet: 0.25,
        }).toDestination()
    }

    if (!filter) {
        filter = new Tone.Filter({
            type: 'lowpass',
            frequency: 8000,
            rolloff: -12,
        }).connect(reverb)
    }

    if (!noise) {
        noise = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: {
                attack: 0.001,
                decay: 0.06,
                sustain: 0,
                release: 0.02,
            },
        }).connect(filter)
    }

    if (!transient) {
        transient = new Tone.Synth({
            oscillator: { type: 'square' },
            envelope: {
                attack: 0.001,
                decay: 0.03,
                sustain: 0,
                release: 0.01,
            },
        }).connect(reverb)
    }
}

export const playCue = async () => {
    await Tone.start()
    ensureNodes()

    noise?.triggerAttackRelease('16n')
    transient?.triggerAttackRelease('C6', '32n')
}

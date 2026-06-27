# TR/ST — Icabod

> A driving, darkwave track at 126 BPM in F# minor, characterized by relentless 16th-note synth arpeggios, a gritty four-on-the-floor beat, and cavernous, reverb-drenched vocals, creating a feeling of intense, melancholic momentum.

*Source: `Trust - Icabod.mp3` · Model: gemini-2.5-pro · stem-separated*

## Measured facts (MIR ground truth)

- **Tempo:** 126 BPM
- **Key:** F# minor (confidence 0.91)
- **Duration:** 4:29
- **Sections: 7** (boundaries at 0:00, 1:24, 2:43, 3:25, 4:12, 4:19, 4:22)
- **Brightness (spectral centroid):** mean 2991 Hz (range 701–7479 Hz)
- **Dynamics:** RMS mean 0.259, range 15.1 dB
- **Timbre:** rolloff 6334 Hz, flatness 0.01, contrast 20.8, ZCR 0.062, harmonic ratio 0.81

## Overview (full-mix read)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by classic analog-style synthesizer textures. Bright, detuned sawtooth leads and plucks contrast with a distorted square-wave bass and breathy, atmospheric pads. |
| Brightness | Bright and sharp, especially in the high-mid range, driven by the persistent synth arpeggio and metallic hi-hats. The spectral centroid at 2991 Hz reflects this, though a heavy low-end provides a dark foundation. |
| Envelope | Primarily short, percussive envelopes. The main arpeggio and bass have quick attack and decay, creating a tight, sequenced feel. This is contrasted by slow-attack, long-release pads that swell in the background. |
| Register/density | Dense and wide-ranging. The arrangement is packed with layers from a deep sub-bass to shimmering high-frequency arpeggios, creating a full spectral wall of sound, particularly in the choruses. |
| Harmony/mode | Anchored in F# minor, with a strong, melancholic Goth-pop feel. Harmony is primarily conveyed through arpeggiated minor chords and root-note basslines, emphasizing a dark and driving tonality. |
| Groove | A relentless four-on-the-floor machine groove at 126 BPM. The constant 16th-note pulse from the arpeggiator and hi-hats creates a hypnotic, driving energy typical of EBM and dark synth-pop. |
| Space/grit | The space is vast and cavernous, achieved through heavy use of hall reverb on most elements, especially vocals and pads. Grit is applied via saturation and light drive on the bass and lead synths, adding an aggressive, industrial edge. |

> Model-guessed song-level synth direction — speculative, tune by ear.

SPECULATIVE STARTER: Create a 126 BPM transport. The core is a Tone.Sequence for the 'Arpeggio Lead' (MonoSynth, fatsawtooth, short ADSR, LPF at ~4.5kHz, reverb). Sequence: ['F#4', null, 'A4', null, 'C#5', null, 'A4', null] on a '16n' grid. The 'Driving Bass' (MonoSynth, square wave, drive: 0.4, LPF at ~700Hz) plays a '8n' octave pattern ['F#2', 'F#1']. Drums are a four-on-the-floor kick (MembraneSynth), snare on 2/4 (NoiseSynth), and off-beat 8th-note hi-hats (MetalSynth). Layer a 'Goth Pad' (PolySynth, slow attack, lots of chorus/reverb) playing sustained F#m chords ('F#3+A3+C#4') for atmosphere. Set up a global reverb (Tone.Reverb) with a long decay (~4s) and use sends for space.

## drums

> A driving, four-on-the-floor electronic drum pattern characteristic of darkwave and EBM. The track builds in intensity by layering increasingly dense hi-hat patterns, adding syncopated percussive elements, and applying more saturation and reverb over time. The core groove is stark and powerful, built from synthetic, processed drum sounds.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Driving Kick | MembraneSynth | A relentless and punchy four-on-the-floor 1/4 note pattern. | The foundational element of the track, providing a constant, driving pulse. It's a deep electronic kick with a tight envelope and a slight clicky attack that remains present for nearly the entire duration. |
| Backbeat Snare | NoiseSynth | A sharp, cracking backbeat on beats 2 and 4. | A synthetic snare composed primarily of filtered white noise. It provides the essential backbeat and becomes more aggressive and saturated as the track progresses. It's often layered with a clap for extra impact. |
| Syncopated Clap | NoiseSynth | Syncopated rhythmic figures, often playing around the main snare beat. | A digital clap sound that adds rhythmic complexity. It frequently plays on off-beats or in short, fast fills, creating a stuttering effect that contrasts with the steady main groove. |
| Clockwork Hat | MetalSynth | Evolves from off-beat 1/8ths to a constant, driving 1/16th note pattern. | A tight, metallic, and precise hi-hat that dictates the track's energy level. The shift from a sparse to a dense pattern is a key feature of the arrangement, creating a sense of acceleration and urgency. |
| Cymbal Wash | MetalSynth | Longer-decay hits used as accents, typically on the downbeat of a new phrase or on an off-beat. | A noisy, washy open hi-hat or crash cymbal sound. It's used for punctuation, adding space and a high-frequency splash that contrasts with the tightness of the other percussive elements. Its reverb is more pronounced. |

## vocals

> A heavily processed baritone vocal performance, characterized by its deep, chant-like delivery and drenched in a cavernous reverb and delay, creating a sound that is simultaneously intimate and vast, synthetic and human.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Crypt Keeper Vocals | PolySynth with fat sawtooth oscillators, processed through a resonant lowpass filter and heavy effects. | Syncopated, descending melodic phrases with a chant-like repetition, typically spanning 1-2 bars. | The sole element of the stem, this track features a low male vocal, heavily processed with reverb, chorus, and delay. It's present throughout, varying in intensity from a single voice in the verses to a dense, harmonized choral texture in the main sections. |

## other

> A dark, driving synth-pop instrumental layer built on a relentless 16th-note arpeggio. Atmospheric pads and a mournful lead melody add emotional depth and texture, all saturated in cavernous reverb.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Driving Arp | PolySynth | Constant 16th-note arpeggios outlining chords (e.g., i-VI-VII in F# minor), creating a propulsive, hypnotic foundation. | The core engine of the stem, present almost throughout. It's drenched in reverb, giving it a sense of scale, with a slightly gritty, detuned analog character. |
| Vocal Lead / Choir Pad | PolySynth | Initially plays a syncopated, mournful melody in the mid-high register. Later transforms into sustained, choir-like pads playing block chords. | Introduced at 147s as a lead voice, adding an emotional, melodic focus. From 201s, it shifts to a background role, providing lush, sustained harmonic pads with the same vocal-like timbre. |
| Glimmer Pad | PolySynth | Sustained high-register notes or simple dyads, holding for multiple bars, with slow swells. | Enters periodically to add atmospheric texture and harmonic lift. Its heavily chorused and reverberated sound creates a wide, shimmering wash that floats above the arpeggio. |

## bass

> A relentless, driving 16th-note synth bassline with a dark, plucky character and moderate saturation, forming the sole rhythmic and harmonic backbone of the track.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Motorik Bass | MonoSynth | A continuous, driving 16th-note sequence playing evolving arpeggiated figures in B minor. The pattern loops in 2 or 4-bar phrases. | The sole instrument in this stem, this bassline provides the complete harmonic and rhythmic foundation. It enters at the beginning and plays almost continuously until the end, defining the track's energy. |

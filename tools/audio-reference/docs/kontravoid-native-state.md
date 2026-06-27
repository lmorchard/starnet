# Kontravoid — Native State

> An aggressive, driving EBM/industrial track at 120 BPM in A minor. The piece is built on a foundation of a distorted, four-on-the-floor kick, a sharp backbeat snare, and a relentless 16th-note sawtooth bassline. Layers of bright, metallic hi-hats and a resonant lead synth create a dense, energetic texture during the chorus sections, contrasted with sparser verses. The production is characterized by heavy use of distortion and a dark, gated reverb that provides both grit and space.

*Source: `Kontravoid - Native State (Official Video).mp3` · Model: gemini-2.5-pro · stem-separated*

## Measured facts (MIR ground truth)

- **Tempo:** 120 BPM
- **Key:** A minor (confidence 0.83)
- **Duration:** 2:32
- **Sections: 6** (boundaries at 0:00, 0:23, 0:41, 0:48, 1:03, 2:25)
- **Brightness (spectral centroid):** mean 4210 Hz (range 676–8192 Hz)
- **Dynamics:** RMS mean 0.234, range 15.5 dB
- **Timbre:** rolloff 8458 Hz, flatness 0.01, contrast 20.4, ZCR 0.122, harmonic ratio 0.69

## Overview (full-mix read)

| Dimension | Reading |
|---|---|
| Timbre | Aggressively analog and distorted. The core is saw and square-wave heavy, with significant saturation on the bass and leads. Percussion is a mix of punchy synthesized tones and sharp, filtered noise. |
| Brightness | Bright and cutting. The high spectral centroid and rolloff are driven by crisp, metallic 16th-note hi-hats and the sizzling high-end of the distorted synths, which cut through the dense mix. |
| Envelope | Sharp and percussive across the board. The kick, snare, and bass all have fast attacks and short, tight decays, creating a forceful, machine-like pulse with minimal sustained elements. |
| Register/density | The track builds from a lean low-mid foundation of bass and kick into a dense, full-spectrum arrangement. The energy is focused in the low-end rhythm and the high-frequency synths and hats, leaving the mid-range relatively open for the vocals. |
| Harmony/mode | Anchored in A minor with a dark, driving feel. Harmony is primarily implied through the arpeggiated bassline which outlines simple minor chord changes (e.g., Am, G, F) rather than through explicit chordal pads. |
| Groove | A rigid and powerful four-on-the-floor EBM groove. A steady kick on every beat, a heavy snare/clap on 2 and 4, and a continuous 16th-note bassline create an intense, propulsive feel. |
| Space/grit | The space is a dark, medium-sized room created by reverb, used most prominently on the snare and vocals to give them size without becoming washed out. Grit is a defining characteristic, with audible drive and saturation applied to the bass and lead synths, lending them weight and aggression. |

> Model-guessed song-level synth direction — speculative, tune by ear.

SPECULATIVE STARTER: The track is built on a 120 BPM grid in A minor. Start with the rhythm section: a Tone.MembraneSynth for the kick ('C1' on a '4n' grid) with some drive, and a Tone.NoiseSynth for the snare ('x' on the 2 and 4) sent to a reverb with a short decay time to emulate a gated effect. The core is the bassline: use a Tone.MonoSynth with a 'fatsawtooth' oscillator, ~0.5 drive, and a lowpass filter around 1200Hz. The pattern is a relentless 16th-note sequence, e.g., ['A2','E2','A2','C3',...]. The lead is another MonoSynth, but with a brighter 'sawtooth' wave, a resonant lowpass filter (Q=5), and chorus. Its melody is sparse, like ['E4', '', 'E4', 'D4', 'C4', '', 'A3', '']. Arrange by building layers: start with drums, bring in the bassline, then use the lead synth for high-energy chorus sections.

## drums

> A driving, aggressive industrial/EBM drum machine pattern at 120 BPM. The track is built on a powerful four-on-the-floor kick, a cracking reverb-heavy snare on the backbeats, and a relentless stream of metallic 16th-note hi-hats. The arrangement evolves by adding and removing layers like open hats, crash cymbals for emphasis, and occasional electronic tom fills.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Industrial Kick | MembraneSynth | A relentless and powerful four-on-the-floor pattern, playing on every quarter note without exception. | The foundational element of the track, providing the main pulse and low-end weight. It is present almost throughout the entire piece. |
| Cracking Snare | NoiseSynth | A sharp, impactful backbeat on beats 2 and 4 of every measure, often with heavy reverb. | This track defines the backbeat and adds a significant amount of the track's aggressive character and spatial depth due to heavy processing. It often sounds like a layer of a snare and a clap. |
| Machine Hats | MetalSynth | A constant stream of straight 16th notes, creating a driving, high-frequency texture. | This closed hi-hat pattern provides the main rhythmic subdivision and energy. Its metallic, sharp timbre is key to the industrial feel. It drops out for effect in certain breakdowns. |
| Offbeat Open Hat | MetalSynth | Plays consistently on the off-beat 8th notes ('and's), adding syncopation and width. | This open hi-hat or small cymbal adds a layer of groove on top of the straight 16th hats, emphasizing the upbeat and filling out the rhythm. |
| Crash Accent | MetalSynth | A long, decaying crash cymbal that hits on beat 1 of major section changes. | Used as a structural marker to announce new sections, like the start of a chorus or verse. Its long tail fills the space and adds dramatic impact. |
| Tom Fill | MembraneSynth | Short, syncopated 16th-note fills, typically occurring at the end of an 8 or 16-bar phrase. | These electronic tom fills serve as transitional devices, breaking the repetition of the main groove and leading into the next section. They are pitched higher than the kick. |

## vocals

> This track consists of a single, heavily processed male vocal performance. The voice has a chant-like, rhythmic quality and is saturated with distortion, creating a gritty industrial texture. The sound is defined by its vast sense of space, achieved through a very prominent hall reverb and rhythmic delays that echo the main phrases.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Industrial Chant Vocal | PolySynth with heavy post-processing (distortion, reverb, delay) | Syncopated, staccato 16th-note phrases delivered in a rhythmic chant. The pattern is a 2-bar loop with significant space, which is then filled by long effect tails. | The sole instrument in this stem, this distorted vocal carries the lyrical and rhythmic focus. It is present almost continuously, defined by its aggressive processing, including heavy saturation, a massive reverb, and a signature dotted-eighth note delay. |

## other

> This stem features an aggressive, distorted arpeggiated lead that evolves into powerful chord stabs, forming the track's rhythmic and harmonic core. This is layered with a contrasting, slow-building atmospheric pad drenched in reverb, creating a dynamic between tight, gritty drive and expansive, cavernous space. The overall feeling is dark, mechanical, and propulsive.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Rhythmic Lead | PolySynth | Starts as a driving 16th-note arpeggio on the root/octave. In fuller sections (e.g. after 0:23), it shifts to playing block chords on quarter or eighth notes, outlining the Am-G-F progression. The filter cutoff modulates throughout. | The central element of the stem. Enters at the beginning as an arp and provides constant rhythmic drive. Evolves into a powerful chordal stab sequence that carries the main harmony. Saturated with distortion and has a tight, aggressive sound. |
| Cathedral Pad | PolySynth | Plays sustained, single-note drones or simple two-note intervals that follow the main chord progression (e.g., holding an 'A' and 'E' over the Am section). Notes change every 4 or 8 bars. | Enters around 0:40 to provide atmospheric depth and contrast. It has a very slow attack, long release, and is saturated in a large hall reverb, creating a sense of vast space that opposes the tight, aggressive lead. |

## bass

> A driving, gritty monophonic synth bass plays a series of evolving 8th and 16th-note arpeggios and ostinatos in A minor, forming the rhythmic and harmonic foundation of the track.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Driving Arp Bass | MonoSynth | Continuous 16th-note pattern, alternating between repeating a single root note and playing 1-bar melodic arpeggios (e.g., A-C-D-C). The filter cutoff increases during arpeggiated sections for more intensity. | The sole instrument in this stem, this bassline provides the core rhythmic and harmonic drive. It is present from the beginning to the end, evolving its pattern to shape the track's structure. |

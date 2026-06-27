# TR/ST — Dressed For Space

> A driving, retro-futuristic darkwave track with a propulsive 16th-note bass arpeggio, cavernous pads, and a stark drum machine beat.

*Source: `TR_ST - Dressed For Space (Official Video).mp3` · Model: gemini-2.5-pro · stem-separated*

## Measured facts (MIR ground truth)

- **Tempo:** 133 BPM
- **Key:** G major (confidence 0.70)
- **Duration:** 3:37
- **Sections: 6** (boundaries at 0:00, 0:08, 0:22, 1:35, 1:50, 3:32)
- **Brightness (spectral centroid):** mean 2353 Hz (range 138–5433 Hz)
- **Dynamics:** RMS mean 0.333, range 12.2 dB
- **Timbre:** rolloff 5274 Hz, flatness 0.00, contrast 22.1, ZCR 0.036, harmonic ratio 0.89

## Overview (full-mix read)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by analog-style synth voices (sawtooth, square), with significant saturation on the bass and a mix of percussive plucks and sustained, atmospheric pads. |
| Brightness | Moderately bright, focused in the upper-mid range. Cymbals and synth leads provide high-frequency energy, but the overall mix avoids harshness. |
| Envelope | A strong contrast between the tight, percussive plucks of the bass arpeggio (zero attack, fast decay) and the vast, slow-attack, long-release pads and vocal reverbs. |
| Register/density | Built around a mid-range bass arpeggio and low-mid pads. The arrangement is initially sparse, progressively layering higher synth melodies and percussion to build density for choruses. |
| Harmony/mode | The piece operates firmly in E minor, creating a dark and melancholic mood despite the driving tempo. It primarily uses chords from the E natural minor scale (i, iv, VII). |
| Groove | A rigid and insistent four-on-the-floor feel at 133 BPM. The groove is defined by the interplay between the steady kick/snare and the relentless 16th-note bass arpeggio. |
| Space/grit | The mix has a huge, cavernous sense of space created by heavy reverb on pads and vocals. Grit is applied selectively through saturation and drive on the bass synth, adding warmth and aggression. |

> Model-guessed song-level synth direction — speculative, tune by ear.

Speculative starter for a Tone.js score: Set tempo to 133 BPM in 4/4. The key is E minor. The core groove is a MonoSynth 'Arp Bass' playing a 16th-note arpeggio, e.g., ['E2', 'G2', 'B2', 'G2'], with a 'sawtooth' oscillator, quick envelope (attack: 0.01, decay: 0.15), and drive around 0.4. The beat is a four-on-the-floor MembraneSynth 'Kick' and a NoiseSynth 'Snare' with a bandpass filter and short decay on beats 2 and 4. The harmony comes from a PolySynth 'Gloom Pad' using a 'fatsawtooth' oscillator, slow attack (~1.5s), and long release (~3s), playing sustained Em chords. Add a high 'reverbSend' (~0.8) and 'chorus' (~0.7) to the pad for space.

## drums

> A driving, powerful four-on-the-floor drum machine groove in a classic darkwave/EBM style, characterized by a punchy kick, heavily processed snare/clap, and persistent hi-hats.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Foundation Kick | MembraneSynth | A powerful, unrelenting four-on-the-floor kick pattern, forming the core of the groove. | This kick drum is the central rhythmic anchor, playing on every quarter note from the beginning to the end. Its sound is deep and tonal with a sharp attack, characteristic of classic electronic dance music. |
| Gated Snare/Clap | NoiseSynth | A heavy backbeat on counts 2 and 4, sounding like a snare and clap layered together. | This track provides the song's strong backbeat. The sound is a composite of a sharp snare and a slightly looser clap, processed with significant compression and a short, gated reverb for a classic '80s punch. |
| Clockwork Hats | MetalSynth | A driving pattern of primarily closed 8th and 16th notes, with occasional accents. | This track delivers the high-frequency energy and propulsive feel. It plays a near-constant pattern of tight, metallic closed hi-hats, creating a sense of urgency and speed. |
| Offbeat Open Hat | MetalSynth | A syncopated open hi-hat playing on the off-beats, creating a classic disco feel. | This open hi-hat provides a syncopated lift to the groove. It consistently plays on the 'and' of each beat, adding a signature element of post-punk and disco rhythms. Its longer decay contrasts with the tight closed hats. |
| Synth Tom Fills | MembraneSynth | Syncopated rhythmic figures and short fills, often with descending pitches. | These synth toms appear periodically to add rhythmic variation and punctuate the ends of phrases. They have a tonal, percussive sound with a quick decay, typical of electronic tom sounds. |

## vocals

> A heavily processed male lead vocal, sung in a baritone range with occasional pushes into a higher tenor. The vocal is defined by its spacious, gothic atmosphere, achieved through a very prominent large reverb, subtle chorus/doubling, and a touch of lo-fi grit. It's the sole element in this stem.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Gothic Lead Vocal | PolySynth | Syncopated, lyrical melodic phrases in E minor with a mix of short and sustained notes, following the sung vocal line. | The sole melodic focus of the stem, this is a male lead vocal drenched in a huge, dark reverb, with a subtle chorus effect for width and some saturation for grit. It enters around 0:37. |

## other

> A dense, cinematic synth arrangement featuring a powerful, melodic lead and a massive, evolving pad. The piece is built on layers of rich, sawtooth-based synthesizer textures, drenched in reverb to create a dark, epic, and atmospheric soundscape characteristic of darkwave or synth-pop.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Epic Lead | PolySynth | Plays the primary, soaring melodic hook of the song. The pattern consists of long, lyrical phrases mixed with faster 16th-note runs, primarily using notes from the E natural minor scale. | The main melodic voice, entering at the first major section (0:07). It is bright, powerful, and sits at the front of the mix. It's treated with a significant amount of reverb and chorus to give it a grand, singing quality that cuts through the dense pads. |
| Synth Orchestra Pad | PolySynth | Sustained, block chords that change every 2 to 4 bars, following the core progression (e.g., Em - C - D). Occasionally, this layer breaks into simple 16th-note arpeggios outlining the same chords. | The harmonic and atmospheric foundation of the track, present from the very beginning. It's a massive, wide, layered sound with a very slow attack, creating swells that ebb and flow with the song's dynamics. This track provides the epic, wall-of-sound character. |

## bass

> A driving, relentless mono-synth bassline playing continuous eighth-notes, characterized by a gritty, filtered sawtooth sound that provides the track's rhythmic and harmonic foundation.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Motorik Bass | MonoSynth | A relentless eighth-note pattern playing a 2-bar melodic figure that descends through the C# minor scale. The filter cutoff is automated, starting low and opening up after the intro. | This single bass synth provides the core pulse and harmony for the entire track. It enters at the start with a very dark, muffled tone on a pedal C#, then at 0:07 the filter opens to reveal the main gritty sound and melodic riff, which continues with variations throughout. |

# Parallels — Dry Blood

> A driving, anthemic 80s-inspired synth-pop track at 120 BPM in A minor. It features a classic four-on-the-floor drum machine beat, a propulsive 16th-note arpeggiated bassline, gated chords, and a soaring lead synth melody. The production uses heavy gated reverb to create a large, cavernous soundscape, while the core instrumental elements remain punchy and defined.

*Source: `Dry Blood By Parallels (Official Music Video).mp3` · Model: gemini-2.5-pro · stem-separated*

## Measured facts (MIR ground truth)

- **Tempo:** 120 BPM
- **Key:** A minor (confidence 0.86)
- **Duration:** 4:09
- **Sections: 6** (boundaries at 0:00, 0:09, 1:22, 2:09, 2:58, 4:02)
- **Brightness (spectral centroid):** mean 3823 Hz (range 985–8092 Hz)
- **Dynamics:** RMS mean 0.109, range 8.7 dB
- **Timbre:** rolloff 8384 Hz, flatness 0.02, contrast 21.2, ZCR 0.097, harmonic ratio 0.76

## Overview (full-mix read)

| Dimension | Reading |
|---|---|
| Timbre | A classic retro-analog synthesis palette, blending bright, cutting sawtooth and square leads with thick, chorused pads and a punchy, filtered bass. Percussion is based on classic drum machine sounds with significant noise components and reverb. |
| Brightness | Crisp and bright, with a high spectral centroid. Shimmering hi-hats and cutting lead synths occupy the high frequencies, balanced by a powerful mid-range from chords and a focused low-end from the bass and kick. |
| Envelope | Predominantly plucky and gated. Basslines and rhythmic chords have very fast attacks and short, abrupt decays creating a tight, percussive feel. This contrasts with soaring lead lines and background pads which use longer attacks and releases. |
| Register/density | Layered and wide-ranging. The arrangement builds from a sparse intro to a dense, full-spectrum texture. It utilizes deep sub-bass, a busy mid-range with arpeggios and chords, and high-frequency lead melodies and percussion. |
| Harmony/mode | Driving minor key. The harmony is firmly rooted in A minor, using simple, powerful chord progressions (i-VII-VI) typical of the 80s pop/rock style, reinforcing a feeling of moody determination. |
| Groove | Four-on-the-floor. A straight, propulsive 4/4 groove is established by the kick drum, with a strong backbeat from a prominent gated snare. The constant 16th-note bass arpeggio provides relentless rhythmic energy. |
| Space/grit | Cavernous and saturated. The mix is defined by a large, ambient space created with heavy use of reverb, especially a gated effect on the snare. Synths have a light to moderate analog-style saturation (drive) for warmth and presence, without being overtly distorted. |

> Model-guessed song-level synth direction — speculative, tune by ear.

SPECULATIVE STARTER: To approximate 'Dry Blood', set tempo to 120 BPM in A minor. Use a `MembraneSynth` for the kick in a 4/4 pattern: `['C1', 'C1', 'C1', 'C1']`. The snare is a `NoiseSynth` with a short decay and heavy reverb on beats 2 and 4. The main engine is a `MonoSynth` (`oscillatorType: 'sawtooth'`) with a low-pass filter (cutoff ~800Hz, Q ~2) playing a 16th-note arpeggio like `['A2', 'E3', 'A3', 'E3', ...]`. Layer this with a `PolySynth` (`oscillatorType: 'fatsquare'`) playing gated power chords like `['A3+E4', '', 'G3+D4', '']`. The lead melody can be a `MonoSynth` with `oscillatorType: 'fatsawtooth'`, chorus, and reverb, playing a simple line in A minor. Background pads are a `PolySynth` with a very slow attack (`>1.5s`), long release, and high chorus, holding chords like 'Am' and 'G'.

## drums

> A driving, powerful, and bright acoustic-style drum performance with a strong 4/4 rock backbeat, characterized by a punchy kick, a sharp reverberant snare, and constant, crisp hi-hats.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Power Kick | MembraneSynth | A foundational rock pattern, primarily landing on beats 1 and 3, with occasional syncopated 8th notes to add drive. | The low-end anchor of the entire track. It provides a consistent, punchy pulse that is present through almost the entire duration. |
| Backbeat Snare | NoiseSynth | A solid, unwavering backbeat on 2 and 4, occasionally embellished with ghost notes and leading into fills. | The defining element of the groove, providing a sharp, cracking sound with noticeable reverb that gives it size. It cuts through the mix clearly. |
| Driving Hats | MetalSynth | Constant, driving 8th notes, with accents created by velocity variation and periodic open-hat sizzles on an off-beat. | The main time-keeping element, providing high-frequency energy and a sense of constant motion. The sound is tight and metallic. |
| Crash Cymbals | MetalSynth | Dramatic, explosive accents landing on the downbeat of major phrases (e.g., beat 1 of an 8-bar section). | Used for emphasis and to mark structural transitions. The crashes are bright, loud, and have a long, shimmering decay, adding a sense of scale and drama. |
| Tom Fills | MembraneSynth | Fast 16th-note runs, typically over one or two beats, used to connect phrases and build tension. | These fills provide rhythmic variation and excitement, usually appearing at the end of a 4 or 8 bar phrase before a chorus or new section. They are tuned from high to low. |

## vocals

> A heavily processed female lead vocal accompanied by multiple layers of harmony and a massive reverb. The track consists entirely of sung lyrical phrases and occasional breathy textures, creating an ethereal and atmospheric soundscape. The arrangement builds from a single voice to a dense, choral wall of sound in the choruses.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Ethereal Lead Vocals | PolySynth | Melodic, lyrical phrases that follow the song's structure. Verses are sparser, while choruses feature dense, multi-part harmonies. The rhythm is largely based on quarter and eighth notes with significant legato and long-held notes, all saturated in reverb. | This single track represents the entire vocal arrangement, including the lead, doubles, and harmony layers. It is the sole melodic and harmonic element in this stem, present from the beginning to the end. The defining characteristic is the massive reverb wash that glues all vocal layers together into a single atmospheric entity. |

## other

> A dense, driving synth-wave arrangement featuring a prominent 16th-note arpeggio, a soaring, atmospheric lead/pad, and a gritty, supportive bass arpeggio. The piece is built on classic synth-pop textures with heavy use of reverb and chorus to create a large, immersive soundscape.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Classic Arp | PolySynth | Continuous 16th-note arpeggio outlining transposed chord progressions. The pattern is a fast, multi-octave figure that forms the primary rhythmic and melodic element. | The main rhythmic and harmonic driver of the track, present from the beginning. It has a bright, plucky sound with a significant amount of reverb, creating a wash of notes that propels the song forward. |
| Soaring Lead Pad | PolySynth with fat oscillators | Long, sustained notes and simple, evolving melodic lines. Notes often hold for one or more bars, creating a slow-moving harmonic layer. | Enters at 0:33 to provide an epic, atmospheric layer. Sits high in the mix with a very wide stereo field (from chorus) and a long reverb tail. Its slow attack allows it to swell in and out of the arrangement. |
| Gritty Bass Arp | MonoSynth | Plays a simplified 16th-note arpeggio in the low-mid register, often outlining the root and fifth of the current chord. | Adds rhythmic weight and a touch of aggression to the low-mids, entering around 0:33. This is a synth bass line with mild drive that locks in with the main arp, rather than a sub-bass. |

## bass

> A driving, repetitive synth bass line plays a constant 8th-note pattern, forming the rhythmic and harmonic foundation of the track with a gritty, filtered tone.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Driving Mid-Bass | MonoSynth | A relentless 8th-note pattern outlining chord roots, typically in a repeating 2-bar or 4-bar phrase. The filter cutoff subtly opens in more intense sections. | The core rhythmic and harmonic engine, present from the start and playing nearly continuously. It provides a constant, hypnotic pulse that underpins the entire song. |

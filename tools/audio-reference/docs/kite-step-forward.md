# Kite — Step Forward

> An anthemic, driving synth-pop track with a distinct 80s aesthetic. The song is built around a powerful four-on-the-floor drum beat, a gritty eighth-note bassline, and massive sawtooth synth chords. A strong male vocal performance delivers the main melody, supported by syncopated synth leads and dramatic transitions marked by noise sweeps. The overall mood is epic and slightly melancholic, with a propulsive energy suitable for a stadium.

*Source: `Kite Step Forward (Kite In China) Official Video.mp3` · Model: gemini-2.5-pro · stem-separated*

## Measured facts (MIR ground truth)

- **Tempo:** 136 BPM
- **Key:** E minor (confidence 0.91)
- **Duration:** 4:15
- **Sections: 7** (boundaries at 0:00, 0:10, 0:29, 1:26, 1:44, 3:37, 4:14)
- **Brightness (spectral centroid):** mean 2523 Hz (range 503–7037 Hz)
- **Dynamics:** RMS mean 0.175, range 19.6 dB
- **Timbre:** rolloff 5028 Hz, flatness 0.00, contrast 20.8, ZCR 0.060, harmonic ratio 0.82

## Overview (full-mix read)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by classic analog synthesizer waveforms, primarily thick, detuned sawtooths for chords and a grittier, filtered sawtooth for the bass. Percussion is synthetic and punchy, characteristic of 80s drum machines. The lead synths have a brighter, slightly metallic FM quality. |
| Brightness | Moderately bright and clear. The persistent hi-hats, crisp snare, and the high-frequency content of the synth leads place the spectral energy in the upper-mids and highs, while the bass and chord fundamentals provide a solid, warm foundation. |
| Envelope | A mix of tight and loose envelopes. The bass and percussion are very tight and plucky (short attack/decay). In contrast, the main synth chords have a slower attack and a long release, creating a continuous harmonic wash. |
| Register/density | The arrangement is dense, particularly during the chorus sections. The low register is occupied by the driving bassline, the mid-range is filled with thick chords and vocals, and the high-end is defined by hi-hats and melodic synth flourishes. |
| Harmony/mode | The track is firmly in a minor key (E minor), using a powerful and anthemic progression (i-VI-VII). This creates a feeling of dramatic tension and emotional release, common in stadium rock and epic pop music. |
| Groove | A propulsive and straightforward four-on-the-floor groove at 136 BPM. The constant eighth-note bassline provides relentless forward momentum, while the strong backbeat on the snare creates an insistent, danceable rhythm. |
| Space/grit | The production features a large, cavernous reverb, most noticeable on the snare drum and vocals, creating a sense of immense space. Significant grit and saturation are applied to the bass synth, giving it a distorted, aggressive character that cuts through the mix. |

> Model-guessed song-level synth direction — speculative, tune by ear.

SPECULATIVE STARTER: Set Tone.Transport.bpm.value = 136. The core is a four-part rhythm section: a `MembraneSynth` kick on `['C1', 'C1', 'C1', 'C1']` in a `4n` loop; a `NoiseSynth` snare on `['', 'x', '', 'x']` sent to a `Reverb` with a long decay (~4s) and high wet level (~0.8); `MetalSynth` hi-hats on a constant `8n` pattern; and a driving `MonoSynth` bass with `oscillator.type = 'sawtooth'`, `drive = 0.6`, playing 8th notes like `['E2', 'E2', ...]`. The main harmony comes from a `PolySynth` with `oscillator.type = 'fatsawtooth'`, `count = 6`, and `spread = 30`. Add a `Chorus` for width. It plays sustained chords like `E3+B3`. A brighter `FMSynth` with `harmonicity = 2` plays a syncopated lead melody in E minor pentatonic. Build tension into choruses with a `NoiseSynth` automated through a `AutoFilter` with its base frequency sweeping from 200 to 8000 Hz.

## drums

> This is a driving, intricate drum stem featuring a mix of electronic and acoustic-style percussion. The foundation is a powerful, often syncopated kick and a gritty snare backbeat. The rhythmic complexity is driven by a prominent layer of syncopated mid-range percussion, reminiscent of congas or djembes, which provides a constant sense of forward motion. High-frequency energy is supplied by busy hi-hat patterns and a continuous 16th-note shaker texture. The overall feel is dynamic and energetic, suitable for an indie dance or synth-pop track.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Power Kick | MembraneSynth | A heavy, resonant kick drum playing a driving, syncopated pattern that often lands just off the main beat, creating tension and forward motion. | The fundamental low-end driver of the track. It's present through most of the song, dropping out for breakdowns and re-entering with impact. |
| Gritty Snare | NoiseSynth | A sharp backbeat on counts 2 and 4, with occasional ghost notes and fills. The sound is a composite of a sharp crack and a noisy body. | The main rhythmic anchor, providing a consistent backbeat. Its slightly distorted and layered texture adds to the track's edgy character. |
| Afro-Percussion | FMSynth | A highly syncopated and continuous melodic-percussive line, resembling congas or djembes, playing a repeating rhythmic motif. | A defining feature of the track's groove, this layer adds a tribal, world-music feel and significant rhythmic complexity. Its tonal nature contributes to the track's unique timbre. |
| Driving Hats | MetalSynth | A busy, metallic hi-hat pattern with a mix of 8th and 16th notes, providing high-frequency energy. | This hi-hat pattern works with the shaker to create a dense, shimmering top-end that propels the track forward. It's clean and synthetic in character. |
| 16th Shaker | NoiseSynth | A constant, unwavering stream of 16th notes, providing a textural bed. | This subtle but crucial layer acts as rhythmic glue, filling in all the gaps and maintaining a constant sense of high-energy motion. It sits high in the mix, but low in volume. |

## vocals

> A heavily processed male tenor vocal stem featuring a clean, reverb-drenched verse melody and a powerful, multi-layered, and distorted gang-vocal chorus. The performance is anthemic and emotional, with a vast sense of space.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Anthemic Lead Vocals | PolySynth with fat oscillators, filter, and heavy effects to simulate layered, processed vocals. | Melody follows the lyrical phrasing, alternating between sparser verse lines and a powerful, descending chorus motif held over multiple bars. Rhythm is mostly straight quarter and eighth notes. | The only element in the stem. Carries the entire melodic and emotional content of the song. The processing transforms it from a single voice in the verses to a massive choir in the choruses, drenched in reverb and distortion throughout. |

## other

> An epic, cinematic synth track built from three primary layers: massive, sustained supersaw pads providing the harmony, a relentless 16th-note arpeggio driving the rhythm, and dramatic filtered noise sweeps for transitions and texture. The piece evolves from sparse chords into a dense, driving wall of sound.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| SuperSaw Pad | PolySynth | Sustained whole-note block chords playing a slow-moving progression. Swells in and out, forming the harmonic foundation. | The core harmonic and atmospheric element of the track. Enters at the beginning and provides a continuous, swelling backdrop. It's very wide, chorused, and washed in reverb. |
| Driving Arp | MonoSynth | A relentless, driving 16th-note arpeggio that outlines the chord changes. The pattern often involves octave jumps and movement between the 1st, 3rd, and 5th of the chord. | Enters around 0:29 and acts as the main rhythmic engine. Its constant motion creates tension and energy. It has its own sense of space from delay and reverb, but is more focused than the pads. |
| Noise Riser | NoiseSynth | A single, long textural event characterized by a filter sweep. Typically used to build tension into a new section. | A transitional and textural effect, most prominent in the long, chaotic outro after 2:00. It's a wash of white/pink noise processed through a sweeping resonant filter and heavy reverb/delay, creating a massive sense of arrival or collapse. |

## bass

> A driving, gritty synth bass track built on a foundational 8th-note ostinato in E minor. The arrangement builds from sparse, long notes into a relentless motorik groove, characterized by a dark, filtered, and saturated timbre.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Motorik Bass | MonoSynth | Begins with sparse whole notes, then transitions at 0:47 to a driving, continuous 8th-note ostinato. The pattern is mostly built on root notes of a 4-bar progression (E-B-D-A) but includes more melodic figures. | The sole instrument in this stem, this bass provides the rhythmic and harmonic foundation. Its character shifts from a sparse presence to a relentless driving force, defined by its gritty, filtered tone. A long, sustained drone appears in the final section (from 217.2s). |

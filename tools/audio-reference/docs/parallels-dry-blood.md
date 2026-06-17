# Parallels — Dry Blood

> A quintessential darkwave/synth-pop track featuring a driving four-on-the-floor beat, a prominent 16th-note arpeggiated bassline, and layered analog-style synths. The arrangement builds by adding melodic and harmonic layers over a constant, motorik groove. The production is defined by its use of large hall reverb and an iconic gated snare sound, characteristic of the 80s era.

*Source: `Dry Blood By Parallels (Official Music Video).mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 120 BPM
- **Key:** A minor (confidence 0.86)
- **Duration:** 4:09
- **Sections: 6** (boundaries at 0:00, 0:09, 1:22, 2:09, 2:58, 4:02)
- **Brightness (spectral centroid):** mean 3823 Hz (range 985–8092 Hz)
- **Dynamics:** RMS mean 0.109, range 8.7 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | Classic 80s analog and early digital synth tones. Saw and square waves dominate the bass and pads, with FM bell-like textures appearing later. Percussion is distinctly electronic drum machine-like, with a prominent noise-based snare. |
| Brightness | Bright and clear, with a spectral focus in the high-mids (mean 3823 Hz). The cymbals and arpeggiator cut through the mix, while the pads provide a warmer, but still present, background. |
| Envelope | Predominantly short, plucky envelopes (fast attack, fast decay, no sustain) for rhythmic elements like the bass arpeggio. The snare has an instantaneous attack and a characteristic gated reverb tail. Pads use slower attacks and long releases. |
| Register/density | The arrangement starts sparse and builds to a medium-high density. A low-register bass (A1-A2) provides the foundation, with arpeggios and chords in the mid-range (A3-A5). The high register is occupied by cymbals and brighter synth leads. |
| Harmony/mode | The track is firmly in A minor, with a repeating, melancholic chord progression typical of the darkwave genre (e.g., Am-G-F-C). The harmony is functional and supports the strong melodic content of the vocals and lead synths. |
| Groove | A straight, driving 4/4 groove at 120 BPM. A four-on-the-floor kick drum and a snare on beats 2 and 4 create a classic dance-pop foundation. The propulsive feel comes from the relentless 16th-note bass arpeggio. |
| Space/grit | The track is defined by a large, cavernous reverb space. The most notable effect is the heavy gated reverb on the snare drum. Synths are widened with chorus. Grit is minimal, manifesting as subtle saturation/drive on the bass for punch, rather than heavy distortion. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| 80s Kick | MembraneSynth | Simple four-on-the-floor pattern on every quarter note. | Provides the foundational pulse of the track. It's present from the beginning and remains constant. It has a punchy, slightly boomy quality. |
| Gated Snare | NoiseSynth | A classic backbeat on beats 2 and 4. | The iconic sound of the track. A sharp burst of white noise with a prominent gated reverb tail. It enters with the full drum beat and defines the track's 80s character. |
| Synth Hats | MetalSynth | Continuous 16th notes, with accents from open hat variations. | Provides high-frequency rhythmic energy. A steady pattern of closed hi-hats, likely with an open hat sound on the off-beats in some sections (notated here as a single pattern for simplicity). |
| Arp Bass | MonoSynth | A continuous, driving 16th-note arpeggio outlining the root chord. | The main rhythmic and harmonic engine of the track, entering after the intro. Its plucky, filtered sound provides constant motion. The pattern shifts to follow the chord changes. |
| Chorus Pad | PolySynth | Sustained whole-note chords that follow the main progression. | Provides the main harmonic bed and atmosphere. It enters during the verse/chorus sections. Its slow attack makes it swell in, and a heavy chorus effect gives it width and movement. |
| Bright Lead | PolySynth | A syncopated melodic line that plays during the chorus. | This is the main instrumental hook, sitting on top of the mix. It's a bright, powerful synth sound that carries the primary melody during instrumental sections. |
| FM Bell Counterpoint | FMSynth | A sparse, higher-register melodic phrase that answers the main lead. | Appears in later sections of the song, adding a crystalline, digital texture. It plays a simple counter-melody that contrasts with the warmer analog synths. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

speculative score draft: Set tempo to 120 BPM. Use a large hall Reverb as a global effect send. The core groove is a `MembraneSynth` kick on `["C1","C1","C1","C1"]` (4n) and a `NoiseSynth` snare on `["", "x", "", "x"]` (4n). The snare's synth should have a short decay (e.g., 0.15) but a high `reverbSend` (e.g., 0.8) to simulate the gated effect. The main drive is a `MonoSynth` with a 'sawtooth' oscillator and a fast filter envelope playing a 16th-note arpeggio like `["A2","E3","A3","E3",...]`. Layer this with a `PolySynth` pad (oscillator `fatsawtooth`, slow attack >0.5s, high chorus >0.5) playing whole-note chords like `["A3+C4+E4"]` followed by `["G3+B3+D4"]`. The lead hook can be a brighter `PolySynth` with a 'fatsquare' oscillator and a quicker ADSR, playing melodies in A minor around the A4-E5 range.

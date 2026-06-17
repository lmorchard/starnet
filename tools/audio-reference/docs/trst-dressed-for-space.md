# TR/ST — Dressed For Space

> A driving, melancholic darkwave track at 133 BPM in E minor. It's built on a relentless 16th-note sawtooth bass arpeggio and a four-on-the-floor beat. Layers of saturated synths, including a prominent square-wave lead, swelling pads, and bright chime arpeggios, create a dense, atmospheric texture. Low, reverb-drenched male vocals deliver the melody, reinforcing the track's somber yet energetic mood.

*Source: `TR_ST - Dressed For Space (Official Video).mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 133 BPM
- **Key:** G major (confidence 0.70)
- **Duration:** 3:37
- **Sections: 6** (boundaries at 0:00, 0:08, 0:22, 1:35, 1:50, 3:32)
- **Brightness (spectral centroid):** mean 2353 Hz (range 138–5433 Hz)
- **Dynamics:** RMS mean 0.333, range 12.2 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by classic 80s analog-style synth voices: saturated sawtooth bass, bright square-wave leads, FM-like bells, and wide sawtooth pads, with processed, low-register male vocals. |
| Brightness | Crisp and present, with bright digital-sounding synth leads and chimes cutting through a darker, saturated low-mid range from the bass and pads. The overall mix has a high-frequency sheen. |
| Envelope | A mix of tight, plucky envelopes for the bass arpeggio and drums (short attack/decay), and much longer, swelling envelopes (slow attack, long release) for the atmospheric pads. |
| Register/density | Starts with a sparse low-mid register bassline, then builds to a high density by layering a kick, snare, mid-register pads, a high-mid lead, and a very high chime arpeggio. |
| Harmony/mode | Strongly rooted in a melancholic E minor mode, using a simple, repetitive chord progression (e.g., Em-C-G). The harmony is functional but serves mainly as a bed for melodic and rhythmic texture. |
| Groove | A straight and propulsive four-on-the-floor groove driven by the constant 16th-note bass arpeggio and a simple kick-on-every-beat, snare-on-2-and-4 pattern. |
| Space/grit | The track is drenched in a large hall reverb, creating a vast, cavernous space, especially on the vocals and pads. Most synth elements, particularly the bass, have noticeable saturation and drive, adding warmth and grit without being overtly distorted. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Arp Bass | MonoSynth | Continuous 16th-note arpeggio outlining the chord progression, typically in a root-fifth-octave pattern. The primary rhythmic and harmonic driver of the track. | The foundational element, starting from the intro and running almost continuously. It's a punchy, saturated sound that sits in the low-mid range. |
| Synth Kick | MembraneSynth | Simple and steady four-on-the-floor pattern, hitting on every quarter note. | Enters at 0:22 to establish the dance beat. It's a deep, punchy kick with a medium decay that anchors the groove. |
| Noise Snare | NoiseSynth | A classic backbeat hitting on beats 2 and 4 of each bar. | Enters with the kick at 0:22, providing the backbeat. It's a bright, noisy snare sound with a quick decay and noticeable reverb. |
| Swell Pad | PolySynth | Sustained whole-note chords that follow the main harmony, swelling in and out. | Enters around 0:08, providing a continuous atmospheric and harmonic bed. The sound is very wide due to chorus and has a long reverb tail. |
| Main Lead | MonoSynth | A simple, catchy, and syncopated melodic hook that repeats throughout the chorus sections. | Enters at 0:22, serving as the main melodic focus besides the vocal. It has a bright, cutting square-wave tone that sits high in the mix. |
| Lead Vocal Synth | FMSynth used to approximate a vocal tone | Melodic phrases with a relatively narrow pitch range and simple rhythm, following the lyrical structure. | Enters around 0:36. This is an approximation of the low, baritone male vocal, which is heavily processed with reverb. |
| Chime Arp | FMSynth | A very fast, high-pitched 16th-note arpeggio that follows the chord changes. | Appears during chorus sections (e.g., 0:50) to add a layer of bright, crystalline texture on top of the mix. It has a bell-like, percussive quality. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

Speculative starter: Set tempo to 133 BPM. The harmonic foundation is an E minor chord progression (e.g., | Em | Em | C | C |). The core driver is a 'MonoSynth' with a 'sawtooth' oscillator playing 16th-note arpeggios (e.g., ['E2', 'B2', 'E3', 'B2', ...]). Apply moderate `drive: 0.5` and a `lowpass` filter with `filterFrequency: 1200`, `filterQ: 2.5` for punch. The main lead is a 'MonoSynth' with a 'fatsquare' oscillator (`count: 3`, `spread: 20`) playing a syncopated hook around B4. Pads can be a 'PolySynth' with 'fatsawtooth', a slow `attack: 2.5`, and high `chorus: 0.6` and `reverbSend: 0.7`. Drums are a `MembraneSynth` kick on every quarter note and a `NoiseSynth` snare on beats 2 and 4. A global reverb with a long decay is essential for the track's atmosphere.

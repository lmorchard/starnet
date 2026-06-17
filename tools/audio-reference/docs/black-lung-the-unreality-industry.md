# Black Lung — The Unreality Industry

> This is a dark, driving industrial techno track at 161 BPM in C# minor. It builds methodically from an atmospheric drone pad, introducing a heavy four-on-the-floor kick and relentless 16th-note hi-hats. The main hypnotic element is a metallic, plucked FM synth arpeggio, later joined by a resonant filtered lead and a solid sub-bass, creating a tense, mechanical, and immersive atmosphere.

*Source: `The Unreality Industry.mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 161 BPM
- **Key:** C# minor (confidence 0.85)
- **Duration:** 5:19
- **Sections: 8** (boundaries at 0:00, 0:08, 0:39, 1:59, 2:15, 3:19, 3:58, 4:48)
- **Brightness (spectral centroid):** mean 1929 Hz (range 72–6039 Hz)
- **Dynamics:** RMS mean 0.130, range 13.5 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | The palette is synthetic and electronic, featuring complex, metallic FM tones, harsh digital noise, wide detuned saw pads, and a deep, distorted sine-wave sub. Grit is added through saturation, particularly on percussive elements. |
| Brightness | Moderately bright (mean centroid 1929 Hz), characterized by the contrast between a dark, ambient pad and sharp, high-frequency elements like the persistent 16th-note hi-hats and cutting synth arpeggios. |
| Envelope | Envelopes are highly varied. A slow-attack, long-release pad creates a continuous wash. Percussive sounds use very fast attacks and short decays for maximum punch. The main arpeggio has a sharp, plucked envelope with zero sustain. |
| Register/density | The track builds from a sparse, low-mid register drone into a dense, full-spectrum arrangement. The low end is anchored by a sub-bass and kick, mids are filled by arpeggios and pads, and the high register is dominated by hi-hats. |
| Harmony/mode | The harmony is modal and static, centered on C# minor. The piece establishes a dark, hypnotic mood through repetition of arpeggiated minor-key figures and sustained drone pads rather than through harmonic progression. |
| Groove | A relentless and driving four-on-the-floor groove at a fast 161 BPM. The foundation is a heavy kick on each beat and a constant stream of 16th-note hi-hats, creating a powerful, machine-like propulsion. |
| Space/grit | The track features a large, cavernous reverb on the pads, creating a vast sense of space. This contrasts with drier, more upfront percussive and melodic elements. A significant amount of grit is present from distortion and saturation on drums and synths. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Drone Pad | PolySynth with FMSynth voices | Sustained, low-register two-note chord (root and fifth) held for multiple bars. | Establishes the dark, atmospheric foundation from the beginning of the track. It's processed with a very large reverb, creating a wide, continuous sonic bed. |
| Industrial Kick | MembraneSynth | Driving four-on-the-floor pattern (1/4 notes). | The rhythmic core of the track, entering at 0:39. It's a heavy, punchy kick with a distorted character, providing relentless energy. |
| 16th Hats | NoiseSynth | Constant, unaccented 16th notes. | Enters at 0:39 with the kick. A bright, sharp hi-hat pattern that provides high-frequency energy and propels the track forward. |
| Plucked Arp | FMSynth | Hypnotic, repeating 16th-note arpeggio based on the C# minor scale. | The primary melodic hook, entering at 0:39. Its metallic, plucked timbre and repetitive nature create a trance-like effect. It's mixed upfront and is relatively dry. |
| Noise Snare | NoiseSynth | Simple backbeat on beats 2 and 4. | Enters around 1:19, providing a classic backbeat that reinforces the groove. It has a splashy quality with a noticeable reverb tail. |
| Filter Lead | Synth | A simple, evolving melodic line using notes from the C# minor scale. | Introduced around 1:19 to add melodic development. The key feature is a sweeping low-pass filter with high resonance that opens and closes, creating tension and textural change. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

SPECULATIVE STARTER: Set tempo to 161 BPM. Start with a PolySynth playing low C#3+G#3 chords. Use FMSynth voices with a slow attack (2s) and long release (4s), harmonicity ~1.5, into a large reverb. At 39s, bring in the main groove: a MembraneSynth kick on every quarter note ('C1') and a NoiseSynth playing constant 16ths ('x'). For the kick, short decay (~0.3s). For the hats, use a high-pass filter (~8kHz). Simultaneously, start a 16n sequence on an FMSynth for the main arp (e.g., ['C#5', '', 'G#4', '', 'E5', '', 'G#4', '']). Use a plucky envelope (decay ~0.1, sustain 0) and metallic settings (harmonicity 2, modIndex 12). For development, introduce a Synth with a 'fatsawtooth' oscillator and a resonant low-pass filter. Automate the filter's frequency to create sweeping build-ups. A simple snare on beats 2 and 4 using a second NoiseSynth (pink noise, decay ~0.2s) will solidify the groove.

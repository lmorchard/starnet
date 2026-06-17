# Kontravoid — Native State

> A dark, driving EBM track at 120 BPM in A minor, characterized by classic drum machine sounds, a relentless 16th-note synth bassline, and layered analog-style synths, all drenched in cavernous reverb and industrial grit.

*Source: `Kontravoid - Native State (Official Video).mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 120 BPM
- **Key:** A minor (confidence 0.83)
- **Duration:** 2:32
- **Sections: 6** (boundaries at 0:00, 0:23, 0:41, 0:48, 1:03, 2:25)
- **Brightness (spectral centroid):** mean 4210 Hz (range 676–8192 Hz)
- **Dynamics:** RMS mean 0.234, range 15.5 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by synthetic, analog-style sounds; sawtooth and square waves for bass/leads, FM for bells, and noise for percussion and texture. |
| Brightness | High mean brightness (4210 Hz) from crisp 16th-note hi-hats and a bright bell arpeggio, balanced against a thudding low-end kick and bass. |
| Envelope | Mostly short, tight, and plucky envelopes creating a sequenced, machine-like feel, especially in the bass and arpeggios. Leads and pads have slightly longer releases. |
| Register/density | Wide register. A low kick and mid-bass occupy the bottom, while arpeggios and hi-hats fill the high frequencies. Density increases significantly in choruses with the addition of a thick saw lead. |
| Harmony/mode | Dark and modal, firmly rooted in A minor. The harmony is built from simple, repetitive arpeggios and basslines on the minor scale, with sustained minor chords in the pads. |
| Groove | A rigid, driving, machine-like EBM groove. Four-on-the-floor kick, backbeat snare, and a constant 16th-note subdivision from the bass and hi-hats. Not swung. |
| Space/grit | Heavy use of digital/plate reverb, especially on the snare and vocals, creating a large, cavernous space. Synths have a moderate amount of grit and saturation, contributing to the industrial aesthetic. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Gated Kick | MembraneSynth | Four-on-the-floor 1/4 note pattern. Short and punchy. | Provides the core rhythmic pulse of the track. A heavy, thudding kick sound with a very short decay, typical of the EBM genre. Present almost throughout. |
| Reverb Snare | NoiseSynth | Standard backbeat on beats 2 and 4, 1-bar loop. | A sharp, classic drum machine snare with a prominent plate reverb tail that defines the track's sense of space. It cuts through the mix on the backbeat. |
| 16th Hi-Hats | MetalSynth | Continuous 16th-note pattern. | A crisp, metallic hi-hat pattern playing straight 16ths, driving the top-end rhythm and contributing to the track's high-frequency energy. Drops out for some breakdowns. |
| Sequencer Bass | MonoSynth | Relentless 16th-note sequence, outlining A minor scale fragments. 1-bar loop. | The main melodic/rhythmic engine. A gritty, filtered sawtooth bass with a fast envelope creating a plucky, sequenced feel. Enters in the intro and drives the verses. |
| Bell Arpeggio | FMSynth | High-register 16th-note arpeggio based on A minor. | A bright, chiming synth that adds a melodic counterpoint, especially in the intro and linking passages. It's processed with a noticeable delay effect. |
| Chorus Saw Lead | PolySynth with 'fatsawtooth' voices | A slow, anthemic melody played on quarter and half notes during the chorus. | The main melodic hook of the chorus. A very wide, detuned, powerful sawtooth lead that gives the chorus its emotional weight and energy.  |
| Grit Pad | AMSynth | Sustained single notes or simple dyads. | A textural pad that adds a layer of noisy, gritty dissonance. It sits low in the mix, filling out the space behind the main elements without being explicitly melodic. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

SPECULATIVE STARTER: Set Tone.Transport.bpm to 120. Use a 'MembraneSynth' for the kick on 1/4 notes ('C1'). Use a 'NoiseSynth' with a short envelope for the snare on beats 2 and 4. A 'MetalSynth' can play constant 16ths for hi-hats. The main bass is a 'MonoSynth' with a 'sawtooth' oscillator and a fast filter envelope (low 'filter.frequency', high 'filter.Q', short 'filter.envelope.attack' and 'filter.envelope.decay') playing a 16th-note pattern like ['A2','A2','C3','A2','G2','A2','E2','A2']. A bright 'FMSynth' ('harmonicity': 3) can play a high arpeggio like ['A4','','C5','','E5',...]. The chorus lead is a 'PolySynth' with 'fatsawtooth' voices, wide 'spread', and a slow melody. Send the snare and vocals to a 'Reverb' with a decay of ~2s.

# Ghost Cop — Problems

> A dark, driving EBM/synth-pop track featuring a relentless 16th-note bass arpeggio, a four-on-the-floor beat, atmospheric pads, and a detached female vocal performance.

*Source: `GHOST COP - PROBLEMS.mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 126 BPM
- **Key:** A minor (confidence 0.77)
- **Duration:** 4:25
- **Sections: 8** (boundaries at 0:00, 0:15, 2:02, 2:33, 2:46, 2:59, 4:04, 4:22)
- **Brightness (spectral centroid):** mean 2074 Hz (range 219–5101 Hz)
- **Dynamics:** RMS mean 0.281, range 12.5 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by classic analog-style synth textures, including plucky sawtooth/square bass arpeggios, sustained pads, and drum machine sounds, contrasted with a breathy human vocal. |
| Brightness | Moderately bright, with a mean spectral centroid of 2074 Hz. The crisp metallic hi-hats and filtered lead synths occupy the high end, balanced by a powerful low-end from the kick and sub-bass. |
| Envelope | Envelopes are predominantly short and tight, especially the percussive bass arpeggio and drums which have near-zero attack and quick decay. Pads and vocals use longer attacks and releases to create atmospheric space. |
| Register/density | The arrangement builds from a sparse intro of bass and kick to a moderately dense texture, layering multiple synth lines, pads, and vocals. The register is wide, from deep sub-bass to sizzling high-frequency hats. |
| Harmony/mode | The track is set in a dark A minor mode, using repetitive, hypnotic basslines centered on the tonic. Harmony is minimal and static, reinforcing the driving, trance-like mood. |
| Groove | A straight and powerful four-on-the-floor groove at 126 BPM. The propulsive energy comes from the constant 16th-note bass arpeggiation against the steady quarter-note kick drum. |
| Space/grit | The production uses a distinct separation of space: drums and bass are dry and upfront, while vocals and pads are washed in a large, dark reverb. A subtle layer of saturation adds grit and aggression to the synth elements. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Kick Drum | MembraneSynth | Unyielding four-on-the-floor quarter-note pattern. | The foundational rhythmic pulse of the track, a powerful and consistent kick drum present from the very beginning. |
| Snare | NoiseSynth | Standard backbeat on beats 2 and 4. | A punchy, electronic snare providing the backbeat. It has a tight envelope and a touch of reverb, entering with the main beat. |
| Closed Hat | MetalSynth | Continuous 8th notes. | A crisp, metallic closed hi-hat playing steady 8th notes, adding high-frequency energy and tightening the groove. |
| Arp Bass | FMSynth | Relentless 16th-note arpeggio, outlining the root and fifth. | The track's signature element, a driving, percussive bass arpeggio that establishes the core melodic and rhythmic identity from the intro. |
| Sub Bass | Synth | Sustained whole notes following the root of the harmony. | A deep, low-passed sine/triangle wave that enters after the intro (0:15) to add weight and fundamental harmonic support beneath the main arp. |
| Vocal | Player | Melodic phrases in a breathy, detached style. | The lead female vocal, entering at 0:15. It is mixed centrally with a prominent hall reverb effect. As this is a sample, the synth and steps are a playable proxy. |
| Harmony Pad | PolySynth | Sustained minor chords with slow attack. | A bright, wide stereo pad that swells in during chorus sections to add atmospheric depth and harmonic texture. Uses detuned oscillators for a thick sound. |
| Breakdown Arp | Synth | Melodic 16th-note sequence with delay. | A melodic synth line with a square-wave timbre that appears in the instrumental breakdown section around 2:07, providing a solo-like counterpoint. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

SPECULATIVE STARTER: Set tempo to 126 BPM. The core is an FMSynth playing a 16n sequence like ['A2', 'E3', 'A3', 'E3']. Give it a plucky envelope (attack:0.001, decay:0.2, sustain:0) and some bite (harmonicity:1.5, modIndex:5). Underpin this with a four-on-the-floor MembraneSynth kick. Layer a NoiseSynth snare on beats 2 and 4. For pads, use a PolySynth with a 'fatsawtooth' oscillator, slow attack (>0.5s), and long release (>1s) on minor chords (e.g., 'A3+C4+E4'). Process vocals and pads with a Reverb with a decay of ~3s and wet level of ~0.4. Keep bass and drums mostly dry.

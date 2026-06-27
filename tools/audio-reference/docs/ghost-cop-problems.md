# Ghost Cop — Problems

> A driving, dark synth-pop track in the style of EBM (Electronic Body Music). It features a relentless, machine-like four-on-the-floor beat, a gritty 16th-note bassline, and layered analog-style synths. The mood is tense and propulsive, with a spacious, reverb-drenched vocal floating over a tight rhythmic foundation.

*Source: `GHOST COP - PROBLEMS.mp3` · Model: gemini-2.5-pro · stem-separated*

## Measured facts (MIR ground truth)

- **Tempo:** 126 BPM
- **Key:** A minor (confidence 0.77)
- **Duration:** 4:25
- **Sections: 8** (boundaries at 0:00, 0:15, 2:02, 2:33, 2:46, 2:59, 4:04, 4:22)
- **Brightness (spectral centroid):** mean 2074 Hz (range 219–5101 Hz)
- **Dynamics:** RMS mean 0.281, range 12.5 dB
- **Timbre:** rolloff 4448 Hz, flatness 0.00, contrast 20.5, ZCR 0.041, harmonic ratio 0.84

## Overview (full-mix read)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by synthetic, tonal sources. Gritty, distorted sawtooth bass contrasts with sharper, filtered square/saw leads and metallic percussion. Pad sounds are thick and detuned ('fat' oscillators). |
| Brightness | Moderately bright with a strong mid-range presence. Sharp transients from the drums and arp cut through the mix, but the core bass and pads are often filtered down, keeping the overall brightness controlled. |
| Envelope | Predominantly short and percussive. The bass and drums have very fast attacks and quick decays, creating a tight, punchy feel. Pads and vocals feature longer attack and release times, adding atmospheric depth. |
| Register/density | Dense and layered. A low-register bass provides a constant rhythmic and harmonic foundation. The mid-range is filled with pads, arpeggios, and vocals. The high-register contains metallic hi-hats and the upper harmonics of the lead synths. |
| Harmony/mode | A minor tonality, with simple, repetitive progressions that emphasize the root and create a hypnotic, driving feel. The harmony primarily serves to support the rhythm and dark mood. |
| Groove | A rigid and powerful 4/4 groove. A four-on-the-floor kick drum and a constant 16th-note bassline create an incessant, machine-like pulse characteristic of EBM and industrial dance music. |
| Space/grit | The track has significant grit, primarily from distortion and drive on the bass synth. The sense of space is large and cavernous, created by substantial reverb on the vocals and pads, while the core rhythmic elements remain relatively dry and upfront. |

> Model-guessed song-level synth direction — speculative, tune by ear.

SPECULATIVE STARTER: Start with the rhythm section. Use Tone.Part for the 4/4 kick (MembraneSynth, default pitch) and the backbeat snare (NoiseSynth, short decay). Use Tone.Sequence for the driving 16th-note bass (MonoSynth, oscillator: 'sawtooth', filter: {type: 'lowpass', frequency: 900, Q: 2}, drive: 0.6). Try a pattern like ['A2', 'A2', 'A2', 'A2', 'G2', 'G2', 'G2', 'G2', 'F2', 'F2', 'F2', 'F2', 'G2', 'G2', 'G2', 'G2']. Add a constant 16th-note hi-hat (MetalSynth). For harmony, use a PolySynth with a 'fatsawtooth' oscillator, chorus, and reverb to play sustained A-minor and G-major chords. A melodic arp (Synth, oscillator: 'fatsquare') can be sequenced with notes like ['C5', null, 'A4', null, 'E5', null, 'C5', null] to add movement.

## drums

> A driving, industrial-tinged techno drum track at 126 BPM. The piece is built around a relentless four-on-the-floor kick drum, progressively layering in processed snares, metallic hi-hats, and syncopated percussive fills. The arrangement uses dynamic shifts, dropping elements to create tension and release, all while maintaining a gritty, powerful, and spacious sound through the use of distortion and reverb.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Industrial Kick | MembraneSynth | A powerful and relentless four-on-the-floor quarter-note pattern. | The foundational pulse of the track, present almost continuously. This kick is deep, punchy, and processed with distortion for an aggressive, industrial character that cuts through the mix. |
| Backbeat Snare | NoiseSynth | A strong, consistent backbeat on counts 2 and 4. | A sharp, digital-sounding snare providing the main backbeat. It has a quick, noisy attack and is processed with a healthy amount of reverb, giving it a splashy tail that defines the track's sense of space. Enters at 0:15. |
| 16th Hats | MetalSynth | A steady, driving 16th-note pattern with slight velocity variations. | A tight, metallic closed hi-hat playing a nearly constant 16th-note rhythm. This element is the high-frequency engine of the track, creating a sense of speed and urgency. It's kept relatively dry to maintain rhythmic precision. |
| Offbeat Cymbal | MetalSynth | A syncopated 8th-note off-beat pattern. | A washy, bright open hi-hat or splash cymbal that adds a classic house/techno syncopation. Its longer decay and higher reverb send contribute significantly to the track's atmospheric quality. |
| Syncopated Tom | MembraneSynth | Short, syncopated fills, often appearing in the latter half of a 4-bar phrase. | A low-mid frequency tom-like sound used for creating rhythmic counterpoint and fills. The pattern is sparse and syncopated, adding complexity and variation to the main groove without cluttering it. |
| Ride Cymbal | MetalSynth | A driving quarter-note pattern with a push on the last 16th note of the bar. | A bright, metallic ride cymbal that enters in later sections (e.g., around 2:44) to lift the energy. It has a clear 'ping' and a shimmering decay, playing on the beat to reinforce the pulse. |

## vocals

> A processed, atmospheric male lead vocal performance with a wide dynamic range. The track alternates between a subdued, almost spoken-word delivery in the verses and a more forceful, sung melody in the choruses, all drenched in a spacious reverb.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Lead Vocal | MonoSynth with heavy reverb and light chorus to simulate vocal processing and doubling. | Syncopated, semi-spoken melodic phrases in a baritone range. The rhythm is primarily based on eighth notes, with a 2-4 bar phrase length. Dynamics vary significantly between sections. | The sole element in this stem, this track carries the entire lyrical and melodic content of the song. It is present from the beginning and its character is defined by its spacious reverb and dynamic, emotional delivery. |

## other

> An epic and cinematic synth track built from layered parts: a gritty, pulsing saw bass pad provides the foundation, a wide, distorted unison lead carries the main melodic themes, and a fast, plucky trance-style arpeggio adds high-frequency energy and movement in later sections. The overall sound is massive, drenched in reverb, and has a dark, driving E minor tonality.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Saw Bass Pad | PolySynth | Starts as a rhythmic 8th-note pulse on the root note, then transitions to sustained whole-note pads that hold the bass of the chord progression. | A foundational low-mid layer that provides harmonic structure and a gritty, buzzing texture. It's present from the beginning and underpins the entire track, providing weight and a rhythmic anchor. |
| Epic Lead | PolySynth | Plays soaring, memorable melodic phrases using a mix of eighth, quarter, and half notes. Carries the main theme of the track. | The dominant melodic voice, entering around 0:15. It's a very wide, bright, and aggressive unison lead with heavy chorus, distortion, and reverb, giving it a signature cinematic quality. |
| Trance Arp | FMSynth | A continuous, driving 16th-note arpeggio that outlines the chord progression. | Enters around 1:21, this high-frequency textural layer adds significant energy and movement. Its plucky, metallic sound cuts through the mix, and it's drenched in reverb to blend it into the large sonic space. |

## bass

> A driving, hypnotic industrial track built on a relentless, gritty analog-style synth bass playing a simple eighth-note pattern in C minor. The sound is dark, dry, and has a percussive, plucky envelope, providing a constant motorik pulse throughout the piece.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Motorik Bass | MonoSynth | Continuous straight eighth-note pattern, typically outlining the root and fifth in a 1 or 2-bar loop. | The foundational element of the track, present from the start and running almost continuously. It provides both the harmonic anchor in C minor and the main rhythmic pulse. Its filter cutoff and volume are modulated subtly across sections to create dynamic shifts. |

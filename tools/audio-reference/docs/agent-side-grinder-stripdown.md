# Agent Side Grinder — Stripdown

> A driving, dark synth-rock track at 120 BPM, built on a relentless 16th-note bassline and four-on-the-floor drum machine beat. The atmosphere is cavernous and gritty, with layers of arpeggiated synths and a baritone vocal delivering a tense, declamatory lyric. The structure builds by adding and removing synth layers, culminating in a distorted synth solo.

*Source: `Agent Side Grinder Stripdown (Official Video).mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 120 BPM
- **Key:** A major (confidence 0.80)
- **Duration:** 4:43
- **Sections: 7** (boundaries at 0:00, 1:34, 2:07, 2:22, 4:30, 4:34, 4:38)
- **Brightness (spectral centroid):** mean 2529 Hz (range 504–7183 Hz)
- **Dynamics:** RMS mean 0.250, range 11.1 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by analog-style synthesizers with sawtooth and filtered square waves. Bass and leads are saturated with distortion. Drums are punchy and electronic, resembling a gritty 808/909. Vocals are a low male baritone with heavy reverb. |
| Brightness | Moderately bright, with a mean spectral centroid of 2529 Hz. The crisp, constant 16th-note hi-hats and the upper harmonics of the distorted synths sit atop a powerful, thick low-mid foundation from the bass. |
| Envelope | Bass and arpeggiated synths use tight, plucky envelopes (fast attack, fast decay, low sustain). Drums are percussive with quick decays. Some lead synth layers and vocals have longer releases, contributing to the spacious feel. |
| Register/density | High density throughout. The low register is occupied by the constant kick and driving bassline. The mid-register contains the main synth arpeggios and vocals. The high register is defined by the hi-hats and cymbals. |
| Harmony/mode | The track has a strong F-sharp minor tonality, creating a dark and tense mood, despite the measured key of A major (its relative major). The harmony is driven by arpeggiated synth progressions outlining chords like F#m, C#m, and D. |
| Groove | A rigid and propulsive 4/4 groove. A four-on-the-floor kick drum and snare on beats 2 and 4 create a powerful, danceable foundation, while the motorik 16th-note bass arpeggio provides constant forward momentum. |
| Space/grit | The track is both spacious and gritty. A large hall reverb is applied liberally to the snare and vocals, creating a cavernous soundstage. Grit is introduced through significant drive and saturation on the bass and lead synths, giving them an aggressive edge. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Kick Drum | MembraneSynth | Relentless four-on-the-floor quarter-note pattern. | The foundational rhythmic pulse of the track, present almost continuously. It's a punchy, deep kick with a touch of saturation. |
| Reverb Snare | NoiseSynth | A simple backbeat on 2 and 4. | A sharp, electronic snare hit with a prominent, long reverb tail that defines the track's spaciousness. Enters with the main beat. |
| 16th Hats | MetalSynth | Constant 16th-note pattern. | Crisp, metallic hi-hats that provide the high-frequency rhythmic texture and drive. Plays throughout most of the track. |
| Driving Bass Arp | MonoSynth | A constant, fast 16th-note arpeggio outlining the chord progression. | The central motor of the track, entering at the beginning and playing nearly non-stop. Its gritty, filtered sawtooth sound is iconic to the piece. |
| Lead Chord Synth | PolySynth | Plays sustained chords and melodic motifs that follow the main harmony, often arpeggiated on an 8th-note rhythm. | This synth provides the main harmonic information over the bass. It has a thick, detuned sound and appears in the main instrumental sections, dropping out for vocal-focused parts. |
| Distorted Solo Lead | MonoSynth | A wailing, expressive solo with slides and bends, appears in the song's final third. | A high-gain, heavily saturated lead synth that takes over for an instrumental solo. It's aggressive and cuts through the mix with a screaming quality. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

SPECULATIVE STARTER: Begin with the rhythmic core at 120 BPM. A `MembraneSynth` kick on every quarter note (`['C2', 'C2', 'C2', 'C2']` on a '4n' grid) and a `NoiseSynth` snare on 2 and 4, sent to a large `Reverb` (decay ~4s). The key element is the `MonoSynth` bassline ('Driving Bass Arp'). Use a 'sawtooth' oscillator with a 'lowpass' filter around 900 Hz, Q of 2, and `drive` of 0.4. Sequence a 16th-note pattern in F# minor, like `['F#2', 'C#3', 'A2', 'C#3', 'F#2', 'C#3', 'B2', 'C#3', ...]`. Layer a `PolySynth` ('Lead Chord Synth') using a `fatsawtooth` oscillator, `count: 5`, `spread: 25`, with `chorus` and `reverb`. Voice chords like F#m (`['F#3', 'A3', 'C#4']`) and C#m (`['C#4', 'E4', 'G#4']`) on half-notes to establish the harmony.

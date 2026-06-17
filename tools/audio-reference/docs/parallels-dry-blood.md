# Parallels — Dry Blood

> An energetic and nostalgic synth-pop track in A minor at 120 BPM, characterized by a driving 16th-note bassline, bright arpeggios, a four-on-the-floor beat with a prominent gated snare, and melancholic melodic themes.

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
| Timbre | Dominated by classic 80s analog and early digital synthesizer sounds: bright sawtooth leads, punchy bass, washy pads, and crisp drum machine percussion. |
| Brightness | Bright and crisp, with a high spectral centroid. High-frequency arpeggios and cymbals cut through the mix, balanced by warm, low-passed pads. |
| Envelope | A mix of very tight, percussive envelopes (bass, arp, drums) with fast attacks and quick decays, and slow, swelling envelopes for the pads, creating both drive and atmosphere. |
| Register/density | Dense and wide-ranging. A low-end anchor from the kick and bass, a busy mid-range with chords and melodies, and a sparkling high-end from arpeggios and hi-hats. |
| Harmony/mode | Firmly in A-minor (Aeolian), creating a classic melancholic but driving synth-pop mood. Harmony is built on diatonic chords like Am, G, F, and C. |
| Groove | A straight, non-swung 120 BPM four-on-the-floor groove. The relentless 16th-note bass and arpeggio lines create a strong sense of forward momentum. |
| Space/grit | Spacious and clean. Dominated by large hall and gated reverbs, especially on the snare, giving the track its characteristic 80s depth. Grit is minimal, with sounds being saturated but not overtly distorted. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Four on the Floor Kick | MembraneSynth | Steady quarter notes (4-on-the-floor). | The core rhythmic foundation of the track. Present throughout most of the song, providing a constant pulse. |
| Gated Snare | NoiseSynth | Hits on beats 2 and 4. | A classic 80s gated reverb snare sound that defines the backbeat. Requires a GatedReverb effect to achieve its signature spacious-but-tight sound. |
| Closed Hats | MetalSynth | Continuous 16th notes. | Provides high-frequency rhythmic drive with a tight, crisp sound. |
| Open Hat | MetalSynth | Plays on the off-beat of every quarter note. | Accents the main beat, creating the classic open-closed hat groove. Has a longer decay than the closed hats for a 'sizzle' effect. |
| Driving Bass | MonoSynth | Continuous 16th-note octave pattern, following the chord roots. | The main rhythmic and harmonic driver in the low-mid range. Enters after the intro and plays almost continuously. |
| Bright Arp | Synth | Fast 16th-note arpeggio outlining the chords in a high register. | A defining melodic and textural element from the very start. Its brightness cuts through the mix and provides a sense of speed and energy. |
| Main Pad | PolySynth | Sustained whole-note chords that follow the main progression. | Provides the harmonic glue for the track. Swells in with a slow attack and fills the background with a wide, stereo texture. |
| Brass Stabs | PolySynth | Syncopated chord stabs, often playing on off-beats. | Adds punch and excitement during the chorus sections. Has a bright, brassy timbre with a quick decay. |
| Simple Lead | MonoSynth | Simple, melodic phrases with held notes. | Carries the main instrumental melody. It's expressive and reminiscent of a vocal line. Enters in verse-like sections. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

// Speculative starter kit for Tone.js. Effects are crucial.
// The iconic snare sound needs a Gated Reverb.
const gatedReverb = new Tone.GatedReverb({ wet: 0.6, decay: 0.2 }).toDestination();
const snare = new Tone.NoiseSynth({ envelope: { attack: 0.005, decay: 0.2 } }).connect(gatedReverb);

// The core rhythm is a 16th-note bass and arp.
const bass = new Tone.MonoSynth({ oscillator: { type: 'sawtooth' }, filter: { type: 'lowpass', frequency: 800 }, envelope: { attack: 0.01, decay: 0.2 } }).toDestination();
const bassPattern = new Tone.Sequence((time, note) => bass.triggerAttackRelease(note, '16n', time), ['A2', 'A1', 'A2', 'A1', 'A2', 'A1', 'A2', 'A1', 'G2', 'G1', 'G2', 'G1', 'G2', 'G1', 'G2', 'G1'], '16n').start(0);

// Washy pads fill the space.
const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 4, spread: 40 }, envelope: { attack: 1.5, release: 2.0 }, filter: { type: 'lowpass', frequency: 2500 } }).toDestination();

// Set tempo and start transport.
Tone.Transport.bpm.value = 120;

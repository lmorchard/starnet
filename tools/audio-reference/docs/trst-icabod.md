# TR/ST — Icabod

> A driving, melancholic darkwave track featuring a relentless 126 BPM four-on-the-floor beat, dominated by a thick sawtooth octave bassline and a bright, detuned 16th-note synth arpeggio. The sound is defined by its contrast between dark, punchy low-end and cutting high-end synths, all drenched in a cavernous reverb that envelops the moody lead vocals.

*Source: `Trust - Icabod.mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 126 BPM
- **Key:** F# minor (confidence 0.91)
- **Duration:** 4:29
- **Sections: 7** (boundaries at 0:00, 1:24, 2:43, 3:25, 4:12, 4:19, 4:22)
- **Brightness (spectral centroid):** mean 2991 Hz (range 701–7479 Hz)
- **Dynamics:** RMS mean 0.259, range 15.1 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | Primarily composed of analog-style synthesizer sounds, especially detuned sawtooth and fatsawtooth waves for bass and leads, with noise-based percussion. |
| Brightness | High-contrast; a dark, heavily low-pass filtered bass provides a foundation for exceptionally bright, cutting arpeggios and metallic hi-hats, consistent with the measured mean spectral centroid of 2991 Hz. |
| Envelope | Rhythmic elements use tight, plucky envelopes (short attack/decay, low sustain) for a punchy, almost gated feel. Pads and vocals utilize long attack and release times to create atmospheric washes. |
| Register/density | Dense and layered. The low register is occupied by the kick and bass. The mid-range is dominated by the fast, constant arpeggio and vocals. The high register contains hi-hats and atmospheric pads. |
| Harmony/mode | Firmly rooted in F# minor, utilizing a driving i-VI-III-VII (F#m-D-A-E) chord progression that is characteristic of the genre, reinforcing a feeling of melancholic propulsion. |
| Groove | A straight and driving 4/4 machine groove. The foundation is a constant four-on-the-floor kick drum, with the primary rhythmic energy coming from the relentless 16th-note synth arpeggio. |
| Space/grit | The track is saturated in a large hall or cathedral-like reverb, giving it a vast, epic sense of space. Grit comes from the chorusing/detuning of oscillators (wide 'spread' on fatsawtooth waves) and the sharp, filtered nature of the percussion. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Kick Drum | MembraneSynth | Four-on-the-floor quarter notes. | The foundation of the rhythm, providing a constant, driving pulse throughout most of the track. |
| Snare Hit | NoiseSynth | Hits on beats 2 and 4. | A sharp, filtered noise snare that provides the backbeat for the main groove. |
| Octave Bass | MonoSynth | Driving 8th-note pattern, often jumping octaves on the beat, following the root of the chords. | A powerful, filtered sawtooth bass that creates the core rhythmic and harmonic momentum of the track. |
| Saw Arp | PolySynth | Continuous 16th-note arpeggio outlining the chord progression. | The main melodic and rhythmic hook of the song. A bright, wide, detuned sawtooth sound that cuts through the entire mix. |
| Verse Vocal Lead | MonoSynth | Melodic phrases corresponding to the main vocal line in the verses. | Approximation of the male lead vocal melody. It is heavily processed with a large reverb and some delay. |
| Chorus Pad | PolySynth | Long, sustained chords that swell in during the chorus sections. | A choir-like pad that adds an epic, atmospheric layer under the 'helplessly' vocal section, filling out the harmony. |
| High Pad | PolySynth | Very slow, evolving high-register chords entering in the latter half of the song. | A high, shimmering pad that adds tension and atmosphere, floating above the main arrangement from the second verse onwards. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

const synths = {};
const reverb = new Tone.Reverb({ decay: 8, wet: 0.5 }).toDestination();

// Start at 126 BPM in F# minor
Tone.Transport.bpm.value = 126;

// SPECULATIVE SETUP:

// Bass: MonoSynth, saw wave, lowpass filter around 400-600Hz.
// const arpBass = new Tone.MonoSynth({...}).connect(reverb);
// new Tone.Pattern(time => arpBass.triggerAttackRelease('F#1', '8n', time), ['16n']).start(0);

// Arp: PolySynth, 'fatsawtooth' oscillator with spread, run through an Arpeggiator.
// const sawArp = new Tone.PolySynth(Tone.Synth, {...}).connect(reverb);
// const arpeggiator = new Tone.Arpeggiator('up', '16n').connect(sawArp.volume);
// arpeggiator.start('0m');
// new Tone.Part((time, chord) => Tone.getTransport().set('chord', chord), [
//   ['0:0', 'F#m'], ['0:2', 'D'], ['1:0', 'A'], ['1:2', 'E']
// ]).start(0);
// Tone.getTransport().on('change:chord', (chord) => arpeggiator.set('notes', Tone.Chord.get(chord).notes));

// Drums: Use MembraneSynth for kick, NoiseSynth for snare/hats.
// const kick = new Tone.MembraneSynth().toDestination();
// new Tone.Loop(time => kick.triggerAttackRelease('C1', '8n', time), '4n').start(0);


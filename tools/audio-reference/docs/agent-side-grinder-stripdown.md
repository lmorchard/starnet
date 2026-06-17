# Agent Side Grinder — Stripdown

> A driving, dark synth-pop track in the style of EBM or post-punk, built on a relentless four-on-the-floor beat and a propulsive 16th-note sawtooth bassline. The arrangement layers melodic synth leads, sustained power-chord pads, and an expressive, wailing synth-sax solo over a static F-sharp minor harmonic foundation. The production is characterized by a spacious, reverb-heavy mix and classic 80s gated percussion.

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
| Timbre | Dominated by raw analog-style synthesizer sounds, including bright sawtooth waves for the bass and leads, and fat, detuned saws for pads. Percussion is synthetic and reminiscent of classic drum machines. Vocals are low, male, and declamatory. |
| Brightness | Mid-heavy and punchy, but with a consistently bright, buzzy texture from the high-frequency content of the main bass and lead synths. The spectral centroid is high, but the overall feel is dark due to the low vocal register and minor harmony. |
| Envelope | The primary rhythmic elements (bass, kick, snare) have very sharp attacks and quick decays, creating a tight, percussive, and machine-like feel. Pad and lead sounds have slightly softer attacks and longer releases to create melodic and harmonic layers. |
| Register/density | The low-to-mid register is extremely dense and rhythmically active, anchored by the constant 16th-note bassline and kick drum. The high register is used more sparingly for lead melodies and the climactic solo. |
| Harmony/mode | The track is firmly in F-sharp minor. Despite the A major key measurement, the harmonic center and melodic phrasing consistently resolve to F#, creating a dark and melancholic mood typical of the genre. The progression is simple, often cycling through F#m, E, D, and A. |
| Groove | A rigid, driving, and hypnotic motorik groove at 120 BPM. The feel is defined by a four-on-the-floor kick drum pattern and a constant 16th-note bass sequence, creating a powerful forward momentum suitable for dancing. |
| Space/grit | The mix feels spacious and cavernous, using significant reverb, particularly a gated effect on the snare and a longer tail on the vocals. Synths have a light analog grit and detuning but are generally clean and punchy, evoking a polished 80s production aesthetic. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Four on the Floor Kick | MembraneSynth | A heavy kick drum playing on every quarter note. | The track's rhythmic anchor, this heavy, thudding kick provides a constant pulse from the very beginning. |
| Gated Snare | NoiseSynth | A classic backbeat, hitting on beats 2 and 4, with a prominent reverb tail. | An archetypal 80s snare sound with a gated reverb effect. It establishes the main backbeat of the song. |
| Sequencer Bass | MonoSynth | A relentless 16th-note pattern, typically jumping between octaves, following the root notes of the chord progression. | The main driving force of the track, this bright, buzzy sawtooth bass plays almost continuously, defining the song's energy and EBM character. |
| Power Chord Pad | PolySynth | Sustained root-fifth power chords that change with the harmony, typically every bar or two. | A gritty, distorted pad-like layer that provides the harmonic foundation. It enters after the intro to add weight and texture, functioning like a rhythm guitar. |
| Harmonized Lead | PolySynth | A recurring 8th-note melodic hook, often harmonized in thirds or sixths. | The main melodic instrument, this bright synth lead enters during instrumental sections (e.g., 0:47) to play a catchy, memorable riff over the chord changes. |
| Synth Sax Solo | FMSynth | An expressive, improvisational solo with fast runs, pitch bends, and held notes with vibrato, using F# blues scale. | A wailing, saxophone-like solo that appears late in the track (around 2:20), adding a layer of chaotic, human expression over the rigid electronic backing. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

/* SPECULATIVE STARTER - This is a rough guide. */
// Set tempo and key
Tone.Transport.bpm.value = 120;
const key = 'F# minor';

// Core Rhythm
const kick = new Tone.MembraneSynth().toDestination();
const kickLoop = new Tone.Loop(time => kick.triggerAttackRelease('C1', '8n', time), '4n').start(0);
const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.2 } }).toDestination();
const snareLoop = new Tone.Sequence((time, note) => snare.triggerAttack(time), [null, 'C2', null, 'C2'], '4n').start(0);

// Driving Bassline
const bass = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.1 },
  filter: { type: 'lowpass', frequency: 3500, Q: 1.5 }
}).toDestination();
bass.volume.value = -12;
const bassPattern = new Tone.Sequence((time, note) => {
  bass.triggerAttackRelease(note, '16n', time);
}, ['F#2', 'F#3', 'F#2', 'F#3', 'F#2', 'F#3', 'F#2', 'F#3', 'E2', 'E3', 'E2', 'E3', 'E2', 'E3', 'E2', 'E3'], '16n').start(0);

// Pad/Guitar Layer
const pad = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsawtooth', count: 5, spread: 40 },
  envelope: { attack: 0.1, decay: 1.5, sustain: 0.4, release: 1.0 }
}).toDestination();
pad.volume.value = -20;
const chordLoop = new Tone.Sequence((time, chord) => {
  pad.triggerAttackRelease(chord, '1m', time);
}, [['F#3', 'C#4'], ['E3', 'B3'], ['D3', 'A3'], ['A2', 'E3']], '1m').start(0);

Tone.Transport.start();

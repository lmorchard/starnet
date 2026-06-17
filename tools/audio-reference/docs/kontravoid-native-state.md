# Kontravoid — Native State

> A driving, dark EBM/coldwave track at 120 BPM in A minor, characterized by a relentless 16th-note synth bass arpeggio, a four-on-the-floor beat with a heavily reverberated snare, and detached female vocals. The production style evokes classic 80s industrial and post-punk with its analog-style synths and prominent rhythmic elements.

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
| Timbre | Timbre is dominated by synthetic, analog-style sounds including a saturated sawtooth bass, sharp metallic hi-hats, and a bright, bell-like FM lead synth. |
| Brightness | The track has a wide spectral range, with a deep, dark bass foundation contrasted by crisp, bright hi-hats and cutting lead synth transients. |
| Envelope | Envelopes are predominantly tight and percussive, featuring short attack and decay times on the bass and drums to emphasize the aggressive, rhythmic drive. |
| Register/density | The arrangement focuses on the low and high registers, with a powerful bassline anchoring the bottom and hi-hats/lead synth occupying the top, leaving the mid-range relatively open for vocals. |
| Harmony/mode | The harmony is stark and rooted in A minor, relying on simple root-octave bass motion and sparse melodic lines, reinforcing a bleak, industrial atmosphere. |
| Groove | A relentless four-on-the-floor EBM groove is established by the kick drum, a strong backbeat snare, and continuous 16th-note hi-hats, creating a highly danceable yet rigid feel. |
| Space/grit | Space is defined by a large, classic gated reverb on the snare, while grit comes from noticeable saturation and drive on the main bass synth. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Kick | MembraneSynth | A driving four-on-the-floor pattern on every quarter note. | The foundational pulse of the track, a punchy and consistent kick drum that drives the rhythm from the start. |
| Gated Snare | NoiseSynth | A strong backbeat on counts 2 and 4. | A bright, snappy white noise snare with a very large and prominent reverb, defining the track's 80s-inspired spatial character. Present throughout. |
| Hi-Hats | MetalSynth | Constant, running 16th notes. | Bright, metallic hi-hats provide high-frequency energy and reinforce the driving 16th-note subdivision of the groove. |
| Arp Bass | MonoSynth | A continuous 16th-note arpeggio, outlining the root, fifth, and octave. | The primary melodic and rhythmic engine of the song. Its saturated, punchy tone and constant motion create the track's signature tension and drive. It's present almost throughout. |
| Pluck Lead | FMSynth | A sparse, high-register melodic phrase with a distinct rhythmic character. | This lead synth enters around 0:22, playing a simple, memorable hook that cuts through the dense rhythm section. It has a bell-like, metallic quality and is processed with a noticeable delay. |
| Vocal Pad Proxy | PolySynth | Sustained single notes following the main vocal contour. | This track serves as a synthetic proxy for the detached female vocals. It holds long notes in the mid-range to represent the harmonic space occupied by the voice, particularly in the verses. |
| Chorus Drone | PolySynth | A single, long sustained root note held for multiple bars. | Enters during the chorus sections (e.g., 0:40) to add weight and harmonic depth. This fat, detuned saw pad sits underneath the main arp bass, creating a powerful wall of sound. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

/* Speculative Score-Draft Starter for 'Native State' */

// Set global tempo and effects
Tone.Transport.bpm.value = 120;
const reverb = new Tone.Reverb({ decay: 4, wet: 0.8 }).toDestination();
const distortion = new Tone.Distortion(0.5).toDestination();

// 1. Arp Bass (MonoSynth)
const arpBass = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.1 },
  filter: { type: 'lowpass', frequency: 1200, Q: 2.5 }
}).connect(distortion);
const bassPattern = new Tone.Sequence((time, note) => {
  arpBass.triggerAttackRelease(note, '16n', time);
}, ['A2', 'E3', 'A2', 'E3', 'A3', 'E3', 'A2', 'E3'], '16n').start(0);

// 2. Gated Snare (NoiseSynth)
const gatedSnare = new Tone.NoiseSynth({
  noise: { type: 'white' },
  envelope: { attack: 0.005, decay: 0.15, sustain: 0 }
}).connect(reverb);
const snarePattern = new Tone.Sequence((time) => {
  gatedSnare.triggerAttack(time);
}, [null, 'x', null, 'x'], '4n').start(0);

// 3. Kick (MembraneSynth)
const kick = new Tone.MembraneSynth().toDestination();
const kickPattern = new Tone.Sequence((time) => {
  kick.triggerAttackRelease('C1', '8n', time);
}, ['x', null, 'x', null], '4n').start(0);

// 4. Lead (FMSynth)
const leadSynth = new Tone.FMSynth({
  harmonicity: 2, 
  modulationIndex: 5,
  envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.8 }
}).toDestination();
// Use a ping pong delay for the lead's rhythmic echo effect

// Key idea: Layer the relentless 16th-note bass with the 4/4 kick and backbeat snare.
// The 'gated' reverb effect on the snare is crucial for the sound; use a Gate effect after the Reverb.
// The harmony is simple A minor, so basslines and melodies will use A, B, C, D, E, F, G.

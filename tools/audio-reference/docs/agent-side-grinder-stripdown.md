# Agent Side Grinder — Stripdown

> A driving, darkwave track featuring a relentless 16th-note bassline, raw analog synth textures, and cavernous reverb-drenched vocals, built on a stomping four-on-the-floor drum machine groove.

*Source: `Agent Side Grinder Stripdown (Official Video).mp3` · Model: gemini-2.5-pro · stem-separated*

## Measured facts (MIR ground truth)

- **Tempo:** 120 BPM
- **Key:** A major (confidence 0.80)
- **Duration:** 4:43
- **Sections: 7** (boundaries at 0:00, 1:34, 2:07, 2:22, 4:30, 4:34, 4:38)
- **Brightness (spectral centroid):** mean 2529 Hz (range 504–7183 Hz)
- **Dynamics:** RMS mean 0.250, range 11.1 dB
- **Timbre:** rolloff 5459 Hz, flatness 0.00, contrast 20.2, ZCR 0.051, harmonic ratio 0.84

## Overview (full-mix read)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by raw, distorted analog-style synth sounds, including sawtooth bass, square wave chords, and noisy percussive elements, contrasted with a deep, baritone vocal. |
| Brightness | Balanced but leaning dark, with a thick, murky low-mid range from the bass and chords, punctuated by the sharp, cutting quality of the lead synth arpeggios and metallic hi-hats. |
| Envelope | A study in contrasts: the rhythm section (bass, drums) is extremely tight and percussive (short attack/decay), while vocals and lead synths are washed in long reverb, creating a vast sense of space. |
| Register/density | Dense and layered. A constant, busy low-end from the bass, a solid mid-range foundation from chords and vocals, and an active high register occupied by the main synth riff and hi-hats. |
| Harmony/mode | A clear F-sharp minor tonality, characterized by a dark, brooding mood. The progressions are simple and powerful, often moving between the tonic (F#m) and chords like Bm and C#m, reinforcing the track's somber feel. |
| Groove | A rigid, motorik 120 BPM groove defined by a four-on-the-floor kick drum and a relentless 16th-note bassline, creating an insistent, danceable pulse reminiscent of EBM and post-punk. |
| Space/grit | High grit and cavernous space. The bass and rhythm synths are heavily saturated with distortion ('drive'). This dry, gritty core is set against the immense space created by heavy, long-decay reverb on the lead synths and vocals. |

> Model-guessed song-level synth direction — speculative, tune by ear.

const reverb = new Tone.Reverb({ decay: 8, wet: 1 }).toDestination();
const chorus = new Tone.Chorus(4, 2.5, 0.5).toDestination();
const distortion = new Tone.Distortion(0.6).toDestination();

// SPECULATIVE STARTER //

// Driving Bass - Key is saturation and filter
const bassSynth = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.1 },
  filter: { type: 'lowpass', frequency: 800, Q: 2 }
}).connect(new Tone.Distortion(0.6).toDestination());

const bassPattern = new Tone.Sequence((time, note) => {
  bassSynth.triggerAttackRelease(note, '16n', time);
}, ['F#1', 'F#1', 'F#1', 'F#1', /*...continue for full bar...*/ ], '16n').start(0);

// Arp Lead - Key is fat oscillator, chorus, and reverb
const arpSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsawtooth', count: 5, spread: 30 },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.4, release: 0.8 },
}).connect(chorus).connect(reverb.set({ wet: 0.7 }));

const arpPattern = new Tone.Sequence((time, note) => {
  if (note) arpSynth.triggerAttackRelease(note, '8n', time);
}, ['F#5', null, 'E5', 'C#5', 'B4', null, 'C#5', 'E5'], '8n').start(0);

Tone.Transport.bpm.value = 120;

## drums

> An aggressive and heavily processed drum machine pattern, characteristic of industrial or EBM genres. It features a driving four-on-the-floor kick, a powerful gated reverb snare, and various hi-hat and percussive layers that build in complexity over the track's duration.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Industrial Kick | MembraneSynth | A relentless and driving four-on-the-floor 1/4 note pattern. | The foundation of the track, providing a constant, powerful pulse from the very beginning. The sound is a deep, slightly boomy electronic kick with a sharp attack. |
| Gated Snare | A NoiseSynth processed with a very short reverb or a dedicated Gated Reverb effect. | A powerful, unwavering backbeat on counts 2 and 4. | The most character-defining element. Its explosive, reverberant, yet abruptly cut-off sound gives the track its classic 80s industrial feel. It is present almost throughout. |
| 8th Note Hi-Hat | MetalSynth | A constant, machine-like 8th note pattern. | Enters after the initial kick/snare intro, providing the main high-frequency energy and driving the rhythm forward. Its metallic and consistent nature adds to the industrial feel. |

**Industrial Kick**
```strudel
sound("bd ~ bd ~").gain(1.1)
```

**Gated Snare**
```strudel
sound("~ sd ~ sd").room(0.6).gain(0.9)
```

**8th Note Hi-Hat**
```strudel
cat(note("c6 b5 a#5 a5 g#5 g5 f#5 f5 e5 d#5 d5 c#5 c5 b4 a#4 a4").s("hh").gain(0.5), silence, silence, silence, silence, silence, silence, silence)
```

## vocals

> A dynamic and atmospheric track featuring a lone, raspy male baritone vocal that builds with layered, choral harmonies and a wild, expressive saxophone solo, all drenched in heavy reverb.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|

## other

> A dense and dramatic synth-driven piece in the post-punk/goth style. It is built on three primary layers: a frantic, continuous 16th-note sawtooth lead melody; a vast, slow-moving atmospheric pad that provides a harmonic wash; and powerful, heavily overdriven chord stabs that enter to create immense, climactic walls of sound. The entire mix is saturated in a large, cavernous reverb, giving it an epic and melancholic feel.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Goth Lead Synth | MonoSynth | (REWORK) Sultry, melancholic, spooky-60s guitar lead (reverb-drenched) — NOT the model's frantic 16th arpeggio. Mostly E Dorian (raised 6th = C#) with chromatic/tritone spice. Two-phrase melody by ear: P1 = E | G E G G# A D | D A G; P2 = E F# G D | F# G C# (G->C# tritone) | F# G F# A G. | Re-voiced from a bright distorted saw to a reverb-drenched ringing guitar (MonoSynth, long decay/release). Melody hand-transcribed by ear (first phrase; rhythm being refined). |
| Cathedral Pad | PolySynth | Sustained whole-note or half-note chords, typically playing minor triads or open fifths. The harmonic rhythm is very slow, with chords held for one or two bars. | Provides the atmospheric, harmonic foundation. It's present throughout most of the track, swelling and receding. It starts smooth but becomes much louder, brighter, and more distorted around 1:40, creating a massive wall of sound. It's very wide and washed in reverb. |
| Lead Drone (unison double) | warm saw synth pad, in unison with the lead | Sustained synth drone doubling the lead melody in unison (same notes, held/legato). | Layered under the e-piano lead to fatten it and fill the gaps where the plucked tone decays. Same 16-bar melody as the Goth Lead. |

**Goth Lead Synth**
```strudel
note("e3 ~ g3 e3 g3 g#3 a3 d3 ~ d3 ~ d3 a3 ~ g3 ~ e3 f#3 g3 d3 ~ f#3 g3 c#3 ~ f#3 g3 f#3 a3 ~ g3 ~ e3 ~ g3 e3 g3 g#3 a3 d3 ~ d3 ~ d3 a3 ~ g3 ~ e3 f#3 g3 d3 ~ f#3 g3 c#3 ~ f#3 g3 f#3 a3 ~ g3 ~ e3 ~ g3 e3 g3 g#3 a3 d3 ~ d3 ~ d3 a3 ~ g3 ~ e3 f#3 g3 d3 ~ f#3 g3 c#3 ~ f#3 g3 f#3 a3 ~ g3 ~ e3 ~ g3 e3 g3 g#3 a3 d3 ~ d3 ~ d3 a3 ~ g3 ~ e3 f#3 g3 d3 ~ f#3 g3 c3 ~ f#3 g3 f#3 a3 ~ g3 ~").slow(16).s("sine").fm(6).fmh(2).fmattack(0.001).fmdecay(0.6).fmsustain(0.35).attack(0.002).decay(0.3).sustain(0.45).release(0.6).lpf(4500).room(0.5).delay(0.12).gain(0.85)
```

**Cathedral Pad**
```strudel
note("[e3,g3,b3] [c4,e4,g4]").slow(2).s("sawtooth").attack(2.5).release(5).lpf(1200).room(0.8).gain(0.4)
```

**Lead Drone (unison double)**
```strudel
note("e3 ~ g3 e3 g3 g#3 a3 d3 ~ d3 ~ d3 a3 ~ g3 ~ e3 f#3 g3 d3 ~ f#3 g3 c#3 ~ f#3 g3 f#3 a3 ~ g3 ~ e3 ~ g3 e3 g3 g#3 a3 d3 ~ d3 ~ d3 a3 ~ g3 ~ e3 f#3 g3 d3 ~ f#3 g3 c#3 ~ f#3 g3 f#3 a3 ~ g3 ~ e3 ~ g3 e3 g3 g#3 a3 d3 ~ d3 ~ d3 a3 ~ g3 ~ e3 f#3 g3 d3 ~ f#3 g3 c#3 ~ f#3 g3 f#3 a3 ~ g3 ~ e3 ~ g3 e3 g3 g#3 a3 d3 ~ d3 ~ d3 a3 ~ g3 ~ e3 f#3 g3 d3 ~ f#3 g3 c3 ~ f#3 g3 f#3 a3 ~ g3 ~").slow(16).s("sawtooth").lpf(1900).attack(0.05).release(2.8).room(0.9).gain(0.4)
```

## bass

> A driving, motorik-style synth bass track that forms the relentless rhythmic and harmonic foundation of the song. A single, gritty monophonic synth plays a continuous stream of eighth notes, outlining E minor arpeggios and scale fragments. The timbre is that of a sawtooth wave passed through a resonant low-pass filter and a distortion/drive effect, giving it a dark, buzzy, and powerful character. The sound is direct and upfront, with a tight, percussive envelope and very little spatial effect.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Motorik Bass | MonoSynth | 16-bar bass form in driving straight 8th-notes: a 4-bar chromatic descending pedal phrase (E->D->C#->C, connecting Em(i) to C(VI)) played 3x, then a 4-bar answer phrase that dips to A and climbs back A->B->C->D. Each root is pedaled, and the last 8th of most bars anticipates the next root (pickup) ahead of the bar line. | The harmonic + rhythmic engine: a chromatic descending pedal bass with an antecedent/consequent shape (3 descending statements + 1 dip-and-rise answer). Anticipation pickups pull each change ahead of the downbeat. (Hand-transcribed by ear; replaces the model's 1-bar arpeggio guess.) |

**Motorik Bass**
```strudel
note("e2 e2 e2 e2 e2 e2 e2 d2 d2 d2 d2 d2 d2 d2 d2 e2 e2 e2 e2 d2 d2 d2 d2 c#2 c#2 c#2 c#2 c2 c2 c2 c2 c2 e2 e2 e2 e2 e2 e2 e2 d2 d2 d2 d2 d2 d2 d2 d2 e2 e2 e2 e2 d2 d2 d2 d2 c#2 c#2 c#2 c#2 c2 c2 c2 c2 c2 e2 e2 e2 e2 e2 e2 e2 d2 d2 d2 d2 d2 d2 d2 d2 e2 e2 e2 e2 d2 d2 d2 d2 c#2 c#2 c#2 c#2 c2 c2 c2 c2 c2 e2 e2 e2 e2 e2 e2 e2 d2 d2 d2 d2 d2 d2 d2 d2 a1 a1 a1 a1 b1 b1 b1 b1 c2 c2 c2 c2 d2 d2 d2 d2 d2").slow(16).s("sawtooth").lpf(1500).resonance(3).distort(0.6).attack(0.004).decay(0.16).sustain(0.3).release(0.08).gain(0.95)
```

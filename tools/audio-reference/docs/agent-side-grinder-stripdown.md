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
| Off-beat Open Hat | MetalSynth | Syncopated off-beat hits, typically on the '+' of each quarter note, creating a classic disco/EBM feel. | This track adds a 'breathing' quality and syncopation to the otherwise rigid groove. Its longer decay contrasts with the tight closed hat. |
| Digital Clap/Rim | NoiseSynth | Syncopated 16th-note accent patterns that evolve throughout the track. | A dry, sharp percussive layer that adds rhythmic complexity and density, particularly in the track's middle and later sections. It sounds like a digital clap or a sharp rimshot. |

## vocals

> A dynamic and atmospheric track featuring a lone, raspy male baritone vocal that builds with layered, choral harmonies and a wild, expressive saxophone solo, all drenched in heavy reverb.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Declamatory Lead Vocal | MonoSynth | Rhythmic, spoken-word-like phrases in verses, transitioning to longer, sustained melodic lines in choruses. Features multi-tracked harmonies in chorus sections. | The central narrative element of the track, present from the beginning. It delivers the lyrics with a mix of rhythmic precision and melodic contour. In choruses, it's supported by wide, reverb-heavy harmonies. The synth approximation aims for the baritone weight and raspy character. |
| Wailing Sax Solo | MonoSynth | A fast, virtuosic, and blues-inflected melodic solo with rapid runs, long-held notes, and expressive bends, occurring in the latter half of the track. | Takes over the lead role from the vocal for an extended instrumental section (approx. 2:03-2:35). The part is wild and expressive, full of fast passages and screaming high notes. The synth patch aims to capture the reedy bite and resonant quality of a saxophone. |

## other

> A dense and dramatic synth-driven piece in the post-punk/goth style. It is built on three primary layers: a frantic, continuous 16th-note sawtooth lead melody; a vast, slow-moving atmospheric pad that provides a harmonic wash; and powerful, heavily overdriven chord stabs that enter to create immense, climactic walls of sound. The entire mix is saturated in a large, cavernous reverb, giving it an epic and melancholic feel.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Goth Lead Synth | MonoSynth | Continuous, driving 16th-note melody outlining chord tones. It has a two-bar phrase structure that repeats with variations, creating a frantic and relentless feel. | The main melodic driver of the track, entering at 0:16. It's bright, slightly distorted, and sits front and center in the mix. It has a noticeable amount of reverb and a slight portamento between notes. |
| Cathedral Pad | PolySynth | Sustained whole-note or half-note chords, typically playing minor triads or open fifths. The harmonic rhythm is very slow, with chords held for one or two bars. | Provides the atmospheric, harmonic foundation. It's present throughout most of the track, swelling and receding. It starts smooth but becomes much louder, brighter, and more distorted around 1:40, creating a massive wall of sound. It's very wide and washed in reverb. |
| Overdriven Chords | PolySynth | Rhythmic power chord stabs, often landing on downbeats or playing a simple quarter-note pattern. Provides rhythmic weight and aggression. | This powerful layer enters in the more intense sections (e.g., 1:40) to create a climactic, industrial-tinged texture. It's a thick, heavily distorted synth playing simple chords, layered on top of the pad but with a much sharper attack and more grit. |

## bass

> A driving, motorik-style synth bass track that forms the relentless rhythmic and harmonic foundation of the song. A single, gritty monophonic synth plays a continuous stream of eighth notes, outlining E minor arpeggios and scale fragments. The timbre is that of a sawtooth wave passed through a resonant low-pass filter and a distortion/drive effect, giving it a dark, buzzy, and powerful character. The sound is direct and upfront, with a tight, percussive envelope and very little spatial effect.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Motorik Bass | MonoSynth | Continuous, driving eighth-notes playing arpeggiated figures and scale runs in E minor. The pattern is a primary rhythmic and harmonic driver, evolving in small ways over long sections. | The central and sole element of this stem, present from the beginning to the end. It establishes the track's key, tempo, and aggressive, dark mood. Its filter frequency likely modulates slightly across different song sections to build or release tension. |

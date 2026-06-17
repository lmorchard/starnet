# TR/ST — Dressed For Space

> A driving, 133 BPM darkwave track with a strong synthpop influence. Its structure is built around a relentless four-on-the-floor beat, a punchy monosynth bassline, and a signature fast 16th-note sawtooth arpeggio. The harmony is firmly in E minor, creating a melancholic but energetic mood, with all elements bathed in a large, cavernous reverb.

*Source: `TR_ST - Dressed For Space (Official Video).mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 133 BPM
- **Key:** G major (confidence 0.70)
- **Duration:** 3:37
- **Sections: 6** (boundaries at 0:00, 0:08, 0:22, 1:35, 1:50, 3:32)
- **Brightness (spectral centroid):** mean 2353 Hz (range 138–5433 Hz)
- **Dynamics:** RMS mean 0.333, range 12.2 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | A classic 80s-inspired digital and analog-style synth palette, featuring sharp sawtooth leads, buzzy square-wave basses, and ethereal pads, contrasted with a heavily processed, reverb-drenched lead vocal. |
| Brightness | Moderately bright, with cutting arpeggios and crisp metallic hi-hats occupying the high frequencies, balanced by a powerful low-end from the kick and bass synths. |
| Envelope | Dominated by very short, tight, plucky envelopes on the bass and arpeggio parts, which create the track's driving rhythmic pulse. Pads feature long, swelling attacks and releases. |
| Register/density | The arrangement is dense and wide-ranging, layering multiple synth parts from a deep sub-bass to high-frequency arpeggios, creating a full wall of sound in its busiest sections. |
| Harmony/mode | E minor. Despite a G major measurement, the track's progressions (e.g., i-III-VI-IV as Em-G-C-A), bass root motion, and melodic focus consistently establish a dark, emotive E minor tonality. |
| Groove | A propulsive and highly danceable four-on-the-floor groove. The steady kick drum, off-beat snare, and constant 8th-note hi-hats create a classic disco/new-wave feel, propelled forward by the syncopated bassline. |
| Space/grit | The production creates a vast, deep sense of space through heavy application of reverb and some delay on nearly all elements, especially the vocals and pads. There is a subtle digital grit and saturation on the bass and leads, but the overall sound is polished. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Arp Lead | PolySynth | A continuous, fast 16th-note arpeggio that outlines the core chord progression (Em-G-C-Am), serving as the main melodic hook. | Enters at 0:07 and is the primary melodic and rhythmic driver for the verses. It's a bright, detuned sawtooth sound with a very short, plucky envelope, filtered to keep it from being too harsh. |
| Punchy Bass | MonoSynth | A syncopated 8th-note pattern that follows the root notes of the chords, locking in with the kick drum. | Starts at 0:07, forming the core rhythmic and harmonic foundation of the track along with the drums. It has a punchy, filtered sound that sits in the low-mids. |
| Lush Pad | PolySynth | Sustained chords that follow the main progression, held for two bars each. | Present from the intro at 0:00, this pad provides the atmospheric and harmonic glue. It has a very slow attack and long release, making it swell and recede behind the main elements. |
| Kick Drum | MembraneSynth | A classic four-on-the-floor pattern, hitting on every quarter note. | The backbone of the groove, entering at 0:07. It's a punchy, mid-heavy kick sound typical of the genre. |
| Snare | NoiseSynth | A simple backbeat, hitting on beats 2 and 4 of each bar. | Enters with the full drum kit at 0:07. It's a bright, snappy white noise snare with a quick decay and a touch of the track's global reverb. |
| Closed Hi-Hat | MetalSynth | A constant stream of straight 8th notes. | Provides the high-frequency rhythmic energy, starting at 0:07. It's a short, metallic, and precise sound. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

/* DRAFT - This is a speculative starting point. */

// Setup
Tone.Transport.bpm.value = 133;
const reverb = new Tone.Reverb({ decay: 8, wet: 0.4 }).toDestination();

// Arp Lead (Em-G-C-A)
const arpSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.1, release: 0.1 },
  filter: { type: 'lowpass', frequency: 4000, Q: 1 }
}).connect(reverb);
const arpPattern = new Tone.Sequence((time, note) => {
  arpSynth.triggerAttackRelease(note, '16n', time);
}, ['E4', 'G4', 'B4', 'G4', 'D5', 'G4', 'B4', 'G4', 'C5', 'E5', 'G5', 'E5', 'A4', 'C5', 'E5', 'C5'], '16n').start(0);

// Punchy Bass
const bassSynth = new Tone.MonoSynth({
  oscillator: { type: 'square' },
  filter: { type: 'lowpass', frequency: 700, Q: 2 },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.2 }
}).connect(reverb);
const bassPattern = new Tone.Sequence((time, note) => {
  bassSynth.triggerAttackRelease(note, '8n', time);
}, ['E2', 'E2', 'G2', 'G2', 'C2', 'C2', 'A1', 'A1'], '8n').start(0);

// Drums
const kick = new Tone.MembraneSynth({ volume: -2 }).toDestination();
const snare = new Tone.NoiseSynth({ decay: 0.15, volume: -8 }).connect(reverb);
const hihat = new Tone.MetalSynth({ volume: -14, decay: 0.05 }).toDestination();

new Tone.Loop(time => kick.triggerAttackRelease('C2', '8n', time), '4n').start(0);
new Tone.Loop(time => snare.triggerAttackRelease('8n', time), '2n').start('4n');
new Tone.Loop(time => hihat.triggerAttackRelease('16n', time), '8n').start(0);

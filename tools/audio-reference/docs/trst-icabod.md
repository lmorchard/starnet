# TR/ST — Icabod

> A driving, motorik darkwave track featuring relentless 16th-note bass arpeggios, heavily processed vocals, and a cavernous, atmospheric mix, built on a classic four-on-the-floor beat.

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
| Timbre | A mix of classic analog-style synthesis (sawtooth, square waves) for basslines and pads, metallic FM sounds for percussion, and heavily processed, reverberant male vocals. |
| Brightness | Bright and crisp, with a mean spectral centroid around 3kHz. The constant 16th-note hi-hats and sharp synth arpeggios create a persistent high-frequency sizzle over a dark, heavy bass foundation. |
| Envelope | Predominantly tight and percussive. Bass and arpeggio synths use very short, plucky envelopes (fast attack, quick decay), while pads have slow attacks and long, washed-out releases. |
| Register/density | Dense and full-spectrum. A deep sub-bass anchors the low end, a busy mid-range is occupied by the main bass arp and vocals, and the high register is filled with sparkling hi-hats and synth leads. |
| Harmony/mode | Firmly rooted in F# minor, employing repetitive, hypnotic chord progressions common in coldwave and post-punk. The harmony is modal and cyclical, prioritizing rhythmic drive over complex changes. |
| Groove | A relentless and driving four-on-the-floor groove at 126 BPM. The rhythmic foundation is a constant 16th-note subdivision carried by both the hi-hats and the primary bass arpeggio. |
| Space/grit | Characterized by a large, cavernous space created by heavy reverb on vocals and pads. A layer of analog-style saturation and subtle noise adds warmth and grit to the otherwise clean synth tones. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Arp Bass | MonoSynth | Continuous 16th-note arpeggio outlining the chord progression (e.g., F#-A-C#). The pattern is a 1-bar loop that transposes with the harmony. It has a slightly accented, driving dynamic. | The main rhythmic and harmonic driver of the track, entering at the very beginning and playing almost continuously. It has a sharp, slightly resonant filtered saw-wave sound. |
| Kick Drum | MembraneSynth | A classic four-on-the-floor pattern, hitting on every quarter note (1, 2, 3, 4). | Provides the core pulse of the track. It's a punchy, mid-heavy kick sound with a short decay, typical of 80s drum machines. |
| Snare Drum | NoiseSynth | A standard backbeat pattern, hitting on beats 2 and 4 of each measure. | A sharp, synthetic snare with a prominent white noise component and a very short decay, providing the main backbeat. |
| 16th Hi-Hats | MetalSynth | Continuous, unaccented 16th notes. | A bright, metallic hi-hat that adds high-frequency energy and reinforces the driving 16th-note feel. It's present through most of the track. |
| Lead Vocal | Player | Rhythmic, declarative phrases with a mostly monotonic delivery, following 2 or 4-bar structures. | A low-mixed male vocal with heavy reverb and some delay, acting as a textural and narrative element. Enters around 0:21. |
| Chorus Vocal Pad | GrainPlayer | Long, sustained notes holding on 'Woah' or wordless melodies that follow the root chord changes over 4-bar phrases. | Layered, reverberant backing vocals that function as a harmonic pad during chorus sections (e.g., at 0:31), adding an epic, atmospheric quality. |
| Sweep Pad | PolySynth | Holds a single chord (e.g., F# minor) for 8 or 16 bars while its filter cutoff is automated upwards. | A wide, detuned saw-wave pad used to build tension into new sections. It has a slow attack and a rising filter sweep, creating a dramatic wash of sound. |
| Sub Bass | MonoSynth | Whole notes or half notes playing the root of the current chord. | A very low-frequency sine or low-passed square wave that reinforces the fundamental harmony, adding weight and power, especially in the chorus sections. |
| Bridge Vocal Loop | Sampler | A repeating 4-beat phrase ('helplessly, where one wants to stand') that loops and layers on itself. | A hypnotic, looping vocal sample that defines the bridge section starting around 1:24. The layers build in density, creating a frantic, obsessive texture. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

/* SPECULATIVE SCORE-DRAFT STARTER */

// Key: F# minor, Tempo: 126 BPM

// Arp Bass (MonoSynth)
const arpBass = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.1 },
  filter: { type: 'lowpass', Q: 2, frequency: 1200 },
  filterEnvelope: { attack: 0.02, decay: 0.4, sustain: 0.1, release: 0.1, baseFrequency: 400, octaves: 2 }
}).toDestination();

const arpPattern = new Tone.Pattern(
  (time, note) => { arpBass.triggerAttackRelease(note, '16n', time); },
  ['F#3', 'A3', 'C#4', 'A3', 'F#3', 'A3', 'C#4', 'A3'],
  'upDown'
);
arpPattern.interval = '16n';

// Sweep Pad (PolySynth)
const sweepPad = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'sawtooth' },
  detune: 15,
  envelope: { attack: 2, decay: 0.5, sustain: 1, release: 4 }
}).toDestination();
const padFilter = new Tone.Filter(300, 'lowpass').toDestination();
sweepPad.connect(padFilter);
// Automate the filter for a rise:
padFilter.frequency.rampTo(4000, 16);
// Trigger with a chord:
sweepPad.triggerAttackRelease(['F#3', 'A3', 'C#4'], '8m');

// Drums
const kick = new Tone.MembraneSynth({ pitchDecay: 0.02, octaves: 5, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).toDestination();
const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.15, sustain: 0 } }).toDestination();
const hats = new Tone.MetalSynth({ frequency: 400, envelope: { attack: 0.001, decay: 0.08, release: 0.05 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000 }).toDestination();

new Tone.Sequence((time, note) => { kick.triggerAttackRelease(note, '8n', time); }, ['C1', null, 'C1', null], '2n').start(0);
new Tone.Sequence((time) => { snare.triggerAttack(time); }, [null, 1, null, 1], '2n').start(0);
new Tone.Sequence((time, note) => { hats.triggerAttackRelease(note, '32n', time); }, ['C5'], '16n').start(0);

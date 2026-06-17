# Ghost Cop — Problems

> A dark, driving synth-pop track in the style of 80s EBM/darkwave, built on a propulsive four-on-the-floor beat, gritty analog-style bass sequences, and arpeggiated synth leads. The mood is tense and energetic, with a clear A minor tonality and heavily processed female vocals.

*Source: `GHOST COP - PROBLEMS.mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 126 BPM
- **Key:** A minor (confidence 0.77)
- **Duration:** 4:25
- **Sections: 8** (boundaries at 0:00, 0:15, 2:02, 2:33, 2:46, 2:59, 4:04, 4:22)
- **Brightness (spectral centroid):** mean 2074 Hz (range 219–5101 Hz)
- **Dynamics:** RMS mean 0.281, range 12.5 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | Primarily gritty, detuned analog synth emulations (sawtooth, square) with occasional brighter, metallic FM textures. |
| Brightness | Bright and present in the high-mids, with a cutting lead synth and crisp percussion over a darker bass foundation; spectral centroid is moderately high. |
| Envelope | Dominated by tight, percussive, and short-decay envelopes for bass, arps, and drums, creating a strong rhythmic pulse. |
| Register/density | Starts sparse, building to a dense mid-to-high register arrangement with a constant low-end anchor from the bass and kick drum. |
| Harmony/mode | Firmly in A minor, using progressions like i-VII-III-VI (Am-G-C-F) to create a classic darkwave harmonic feel. |
| Groove | A straight and relentless 4/4 machine groove at 126 BPM, with constant 16th-note motion in the bass and arpeggiator. |
| Space/grit | The mix combines dry, upfront rhythmic elements with a moderately large, reverberant space for vocals and leads, while key synth parts feature noticeable saturation and drive. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Kick | MembraneSynth | Standard four-on-the-floor kick pattern on every quarter note. | The foundation of the rhythm section, providing a constant pulse throughout most of the track. |
| Snare | NoiseSynth | Hits on beats 2 and 4, providing the backbeat. | A sharp, filtered noise hit that functions as the snare drum, cutting through the mix. |
| Hi-Hats | MetalSynth | Constant 16th-note pattern with slight velocity variations (not shown in steps). | Provides high-frequency rhythmic energy and drives the top-end of the groove. |
| Sequenced Bass | MonoSynth | Continuous 16th-note pattern following the root notes of the chord progression. | A gritty, driving bassline that acts as a core melodic and rhythmic engine. Enters from the beginning. It has a slight filter pluck on each note. |
| Arp Lead | MonoSynth | An arpeggiated 16th-note figure that outlines the chords. Plays a counter-rhythm to the bass. | A brighter, detuned synth lead that adds harmonic complexity and rhythmic interest. Enters during the intro and features prominently in instrumental sections. |
| Chorus Pad | PolySynth | Sustained chords that change every 2 or 4 bars, following the main harmony. | A thick, wide pad that enters during the chorus sections to add weight and harmonic depth. It sits in the background behind the leads and vocals. |
| Accent Arp | FMSynth | Sparse, higher-register arpeggiated pattern that appears during vocal phrases. | A bell-like, metallic synth that provides punctuation and call-and-response with the vocals. First appears around 0:30. Its tone is more piercing than the main arp. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

/* DRAFT STARTER -- speculative, incomplete. Based on Ghost Cop - 'Problems' */

const mainReverb = new Tone.Reverb(2.5).toDestination();
const mainChorus = new Tone.Chorus(4, 2.5, 0.5).connect(mainReverb);

// Gritty 16th-note bass sequence
const bassSynth = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.1 },
  filter: { type: 'lowpass', frequency: 1200, Q: 2.5 },
  filterEnvelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1, baseFrequency: 200, octaves: 2 },
}).toDestination();
const bassFx = new Tone.Distortion(0.5).connect(bassSynth);
bassSynth.volume.value = -6;
const bassPattern = new Tone.Sequence((time, note) => {
  bassSynth.triggerAttackRelease(note, '16n', time);
}, ['A2','A2','A2','A2','A2','A2','A2','A2','G2','G2','G2','G2','G2','G2','G2','G2'], '16n').start(0);

// Driving arp lead
const leadSynth = new Tone.MonoSynth({
  oscillator: { type: 'fatsawtooth', count: 3, spread: 25 },
  envelope: { attack: 0.01, decay: 0.3, sustain: 0.2, release: 0.2 },
  filter: { type: 'lowpass', frequency: 3000, Q: 1.5 },
}).connect(mainChorus);
leadSynth.volume.value = -12;
const leadPattern = new Tone.Sequence((time, note) => {
  if(note) leadSynth.triggerAttackRelease(note, '16n', time);
}, ['A3', null, 'E4', null, 'C4', null, 'E4', null], '16n').start(0);

// Basic drums
const kick = new Tone.MembraneSynth().toDestination();
const snare = new Tone.NoiseSynth({noise:{type:'pink'}, envelope:{decay:0.15}}).toDestination();
new Tone.Loop(time => kick.triggerAttackRelease('C1', '8n', time), '4n').start(0);
new Tone.Loop(time => snare.triggerAttackRelease('8n', time), '2n').start('4n');

Tone.Transport.bpm.value = 126;
// Tone.Transport.start();

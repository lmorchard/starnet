# Kite — Step Forward

> An anthemic, high-energy 80s-inspired synth-pop track with a driving four-on-the-floor beat, massive detuned synth chords, and a powerful, emotive male vocal performance, all set in a vast, reverberant space.

*Source: `Kite Step Forward (Kite In China) Official Video.mp3` · Model: gemini-2.5-pro*

## Measured facts (MIR ground truth)

- **Tempo:** 136 BPM
- **Key:** E minor (confidence 0.91)
- **Duration:** 4:15
- **Sections: 7** (boundaries at 0:00, 0:10, 0:29, 1:26, 1:44, 3:37, 4:14)
- **Brightness (spectral centroid):** mean 2523 Hz (range 503–7037 Hz)
- **Dynamics:** RMS mean 0.175, range 19.6 dB

## Vocabulary grid (model interpretation)

| Dimension | Reading |
|---|---|
| Timbre | Dominated by thick, detuned sawtooth synth pads and leads, a punchy electronic drum kit (synthetic kick, noise-based snare/hats), and a clear male vocal with heavy reverb. |
| Brightness | Bright and polished, with a rich harmonic content from the sawtooth synths and crisp, metallic hi-hats, consistent with a high spectral centroid. The mix has a distinct high-frequency sheen. |
| Envelope | The main synth chords feature a moderate attack and long release, creating a sustained wall of sound. The bass and drums are tight and percussive, with very fast attacks and short decays. |
| Register/density | The arrangement is dense, particularly in the choruses, spanning a wide frequency range from the low synth bass to the high-frequency percussion and synth harmonics. The texture builds from sparse verses to a full-on sonic assault. |
| Harmony/mode | The piece is firmly in E minor, using powerful, diatonic chord progressions (e.g., i-VI-III-VII) that create an epic, somber yet uplifting atmosphere characteristic of the genre. |
| Groove | A driving, straight-ahead 4/4 groove at 136 BPM. A four-on-the-floor kick, backbeat snare, and continuous 8th-note bassline provide a powerful, danceable rhythmic foundation, reinforced by a 16th-note hi-hat pattern. |
| Space/grit | The track is defined by a massive, cavernous space created by liberal use of long-decay reverb on vocals and synths. There is a moderate amount of grit and saturation ('drive') on the bass and synth layers to add weight and warmth without being overtly distorted. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Power Chords | PolySynth | Sustained half-note and whole-note block chords that follow the main progression, creating a massive harmonic wall. | The primary harmonic element, entering in the intro and dominating the choruses. It provides the track's epic scale and is saturated in reverb and chorus effects. |
| Eighth Note Bass | MonoSynth | A continuous, driving 8th-note pattern playing the root note of each chord. | Enters at 0:10, providing the core rhythmic momentum of the track. It has a gritty, defined tone that cuts through the dense mix. |
| Kick Drum | MembraneSynth | A standard four-on-the-floor quarter-note pattern. | The rhythmic anchor of the track, starting at 0:10. It is punchy and deep, driving the beat relentlessly. |
| Snare | NoiseSynth | A strong backbeat on counts 2 and 4. | The snare provides the main backbeat from 0:10 onwards. It has a bright, snappy character with a touch of reverb. |
| Hi-Hats | MetalSynth | A constant stream of 16th notes. | Adds high-frequency energy and texture to the beat, entering with the full drum kit at 0:10. |
| Verse Arp Lead | Synth | A syncopated, melodic 16th-note ostinato that plays during instrumental breaks in the verses. | A secondary melodic voice that adds a bright, plucky texture and fills the space between vocal lines. |
| Noise Riser | NoiseSynth | A long, sustained noise sweep with a rising filter cutoff, building tension into new sections. | A transitional effect used to build energy, for example in the long outro starting around 217s, creating a sense of liftoff or breakdown. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

/* Speculative Score Draft for 'Step Forward' */

// Global Effects
const reverb = new Tone.Reverb({ decay: 4, wet: 0.7 }).toDestination();
const chorus = new Tone.Chorus(4, 2.5, 0.5).toDestination();

// Main Power Chords
const powerSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsawtooth', count: 6, spread: 30 },
  envelope: { attack: 0.08, decay: 0.4, sustain: 0.9, release: 2.5 },
  volume: -12
}).connect(chorus).connect(reverb);

const chordProgression = [
  { time: '0:0', notes: ['E3', 'G3', 'B3'], dur: '2n' },
  { time: '0:2', notes: ['C3', 'E3', 'G3'], dur: '2n' },
  { time: '1:0', notes: ['G3', 'B3', 'D4'], dur: '2n' },
  { time: '1:2', notes: ['D3', 'F#3', 'A3'], dur: '2n' }
];
const chordPart = new Tone.Part((time, value) => {
  powerSynth.triggerAttackRelease(value.notes, value.dur, time);
}, chordProgression).start(0);
chordPart.loop = true;
chordPart.loopEnd = '2m';

// Bassline
const bassSynth = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  filter: { type: 'lowpass', frequency: 800, Q: 2 },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.1 },
  volume: -8
}).toDestination();

const bassNotes = ['E2', 'E2', 'C2', 'C2', 'G1', 'G1', 'D2', 'D2'];
const bassSeq = new Tone.Sequence((time, note) => {
  bassSynth.triggerAttackRelease(note, '4n', time);
}, bassNotes, '4n').start(0);

// Drums
const kick = new Tone.MembraneSynth({ volume: -6 }).toDestination();
const snare = new Tone.NoiseSynth({ envelope: { decay: 0.15 }, filter: { type: 'bandpass', frequency: 4000, Q: 1.5 }, volume: -10 }).connect(reverb);

new Tone.Loop(time => { kick.triggerAttackRelease('C1', '8n', time); }, '4n').start(0);
new Tone.Loop(time => { snare.triggerAttackRelease('0.1n', time); }, '2n').start('4n');

# Kite — Step Forward

> This is a high-energy, anthemic synth-pop track in E minor at 136 BPM, characterized by a massive wall-of-sound production, driving four-on-the-floor rhythm, powerful vocals, and classic 80s-inspired synthesizer textures like detuned saws and gated percussion.

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
| Timbre | The sound is dominated by layered, detuned sawtooth synthesizers, a punchy electronic drum kit, and a prominent, reverberant male lead vocal. The overall texture is synthetic, powerful, and polished. |
| Brightness | The track is very bright and open, with significant high-frequency energy from sawtooth synth pads, crisp hi-hats, and vocal sibilance. The mean spectral centroid of 2523 Hz confirms a persistent presence in the upper-mid and high frequencies. |
| Envelope | Core synth pads use a medium attack and long release, creating sustained chordal washes. The bass has a tight, plucky envelope (fast attack, quick decay), while percussion elements are sharp and transient, with a notable gated reverb tail on the snare. |
| Register/density | The arrangement is dense, especially during choruses, occupying a wide frequency spectrum from the low-end kick and bass, through the crowded midrange of chords and vocals, up to the sizzling hi-hats and synth harmonics. |
| Harmony/mode | The track is firmly in E minor, using powerful, diatonic chord progressions (e.g., i-VI-III-VII) that create a feeling of drama and forward motion, typical of anthemic pop and rock. |
| Groove | A driving, straight four-on-the-floor groove at 136 BPM is established by the kick drum. The bass provides a constant 8th-note pulse, while syncopated synth arpeggios and off-beat hi-hats add rhythmic complexity and energy. |
| Space/grit | The production features a vast, cavernous sense of space, achieved through heavy use of wide stereo imaging and long reverbs on vocals, synths, and the snare drum. There is a clean, polished feel with only subtle saturation for warmth, except for the prominent noise sweeps used as transitional effects. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Power Chords | PolySynth | Sustained block chords, typically one chord per bar, forming a 4-bar progression. | The primary harmonic driver, this track creates a massive wall of sound. It's present from the intro and underpins the entire song, creating an epic, anthemic feel. It's drenched in reverb. |
| 8th Note Bass | MonoSynth | Continuous 8th notes playing the root of the current chord. | The rhythmic and harmonic anchor of the track. It enters with the full beat and provides relentless forward momentum. |
| Arp Sequence | Synth | A simple, repeating 16th-note arpeggio outlining the chord tones. | This track enters during the verses, adding a layer of rhythmic complexity and melodic interest over the sustained pads. It has a brighter, more focused sound. |
| Four on the Floor Kick | MembraneSynth | A steady quarter-note kick drum pattern. | The core of the beat, providing a powerful and unwavering pulse throughout the song. |
| Gated Snare | NoiseSynth | A strong backbeat on beats 2 and 4. | A classic 80s-style snare with a prominent reverb tail that gets cut off abruptly, defining the backbeat. |
| Offbeat Hats | MetalSynth | Steady 8th-note hi-hats, with an accent on the off-beats. | Provides high-frequency rhythmic drive and texture. |
| FX Riser | NoiseSynth | A long, sustained white noise sweep with a rising bandpass filter. | This sound effect is used to build tension into new sections, like the choruses, and features prominently in the long outro. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

/* SPECULATIVE STARTER - for a developer building this in Tone.js */

// Set tempo and key
Tone.Transport.bpm.value = 136;
const key = 'E minor';

// 1. Rhythm Section: Create a classic four-on-the-floor beat.
const kick = new Tone.MembraneSynth().toDestination();
const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.005, decay: 0.25, sustain: 0 }}).toDestination();
const hihat = new Tone.MetalSynth({ volume: -20, envelope: { decay: 0.08 } }).toDestination();

new Tone.Part(time => kick.triggerAttackRelease('C1', '8n', time), ['0', '1n/4', '2n/4', '3n/4']).start(0);
new Tone.Part(time => snare.triggerAttack(time), ['1n/4*1', '1n/4*3']).start(0);
new Tone.Part(time => hihat.triggerAttack(time), ['1n/8*1', '1n/8*3', '1n/8*5', '1n/8*7']).start(0);

// 2. Bassline: A driving 8th-note root bass.
const bass = new Tone.MonoSynth({
  oscillator: { type: 'sawtooth' },
  filter: { type: 'lowpass', frequency: 800, Q: 2 },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 },
  volume: -10
}).toDestination();
const bassPattern = new Tone.Sequence((time, note) => {
  bass.triggerAttackRelease(note, '8n', time);
}, ['E2', 'E2', 'E2', 'E2', 'E2', 'E2', 'E2', 'E2'], '8n').start(0);

// 3. Harmony: A massive supersaw pad with long release.
const chordSynth = new Tone.PolySynth(Tone.Synth, {
  oscillator: { type: 'fatsawtooth', count: 7, spread: 60 },
  envelope: { attack: 0.1, decay: 0.4, sustain: 0.9, release: 2.5 },
  volume: -14
}).toDestination();
const chordProgression = [['E3', 'G3', 'B3'], ['C3', 'E3', 'G3'], ['G3', 'B3', 'D4'], ['D3', 'F#3', 'A3']]; // i-VI-III-VII in Em
new Tone.Sequence((time, chord) => {
  chordSynth.triggerAttackRelease(chord, '1m', time);
}, chordProgression, '1m').start(0);

// 4. Effects: Use reverb for space and filter automation for risers.
const reverb = new Tone.Reverb({ decay: 4, wet: 0.4 }).toDestination();
snare.connect(reverb);
chordSynth.connect(reverb);

const noiseRiser = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 4, decay: 0.1, sustain: 1 }, volume: -25 }).toDestination();
noiseRiser.filter.type = 'bandpass';
// Example: Automate filter to sweep up into a chorus at bar 8
noiseRiser.filter.frequency.setValueAtTime(200, '8m');
noiseRiser.filter.frequency.linearRampToValueAtTime(8000, '8m + 4m');

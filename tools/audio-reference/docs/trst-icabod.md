# TR/ST — Icabod

> A high-energy darkwave track at 126 BPM in F# minor, built on a driving four-on-the-floor beat and a propulsive 16th-note arpeggiated bassline. The arrangement is dense, layering multiple bright, resonant synth arpeggios, a powerful saturated bass, and heavily reverberated vocals and percussion. The mood is urgent and melancholic, characteristic of the 80s goth/synth-pop revival style, with a mix of tight rhythmic elements and vast, cavernous reverb.

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
| Timbre | Dominated by analog-style synth textures, featuring sharp, resonant saw and square waves. Vocals are low in the mix and heavily processed. Percussion is synthetic and punchy. |
| Brightness | Bright and sizzly, with prominent high-frequency content from synth leads and sharp percussion, balanced by a weighty low-mid bass. The overall feel is crisp despite the dark tone. |
| Envelope | Predominantly short and plosive envelopes for rhythmic elements (bass, leads), creating a tight, driving pulse. Pads and vocals have slower attacks and longer releases for atmospheric layering. |
| Register/density | Dense and layered, with a powerful low-end from the bassline, a busy mid-range filled with arpeggiated synths and vocals, and a crisp high-end from percussion and lead textures. |
| Harmony/mode | Firmly in F# minor, using driving root-note basslines and arpeggiated minor chords to create a dark, urgent, and melancholic new-wave atmosphere. |
| Groove | A driving, four-on-the-floor dance beat with a strong backbeat. The groove is defined by a relentless kick drum and a propulsive, arpeggiated synth bassline, creating an insistent, motorik feel. |
| Space/grit | A mix of tight, dry rhythmic elements and cavernous, reverberant spaces. Grit is applied liberally through saturation/distortion on bass and lead synths, while vocals and snares are washed in large hall reverb. |

## Tracks (model interpretation)

*Each track is one instrument driven by one pattern. Track names are the model's, invented to fit this piece; instruments are Tone.js sources (or a custom-synthesis note).*

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Arp Bass | MonoSynth | Relentless 16th-note arpeggio outlining chord roots and fifths, with a gritty, slightly overdriven tone. 2-bar loop. | The core rhythmic and harmonic driver of the track, entering at the start and present almost throughout. Its saturated tone helps it cut through the dense mix. |
| Kick | MembraneSynth | Standard four-on-the-floor 1/4 note pattern. | The foundational pulse of the dance beat. A solid, punchy kick drum sound that drives the track from the very beginning. |
| Reverb Snare | NoiseSynth | Hits on the backbeats (2 and 4). | A classic 80s gated reverb snare sound. The large reverb adds a huge sense of space and punctuates the groove, contrasting with the tighter elements. |
| Hi-Hat | MetalSynth | Constant, driving 16th notes. | Provides high-frequency energy and reinforces the fast pace. Sits high in the mix, with a sharp, metallic character. |
| Main Arp Lead | PolySynth | High-register 16th-note arpeggio playing a melodic hook. 2-bar loop. | The iconic opening hook. A bright, resonant, and detuned synth sound that defines the track's character from the start. |
| Choir Pad | PolySynth | Long, sustained minor chords changing every 2 or 4 bars. | A background pad with a vocal-like quality, providing atmospheric texture and harmonic support, especially in the chorus-like sections. |
| Woah Backing Synth | PolySynth | Rhythmic 'Woah-oh' melodic pattern, syncopated against the main beat. | A synth layer that mimics the sung 'Woah-oh' backing vocals. Has a distinct, filtered, and resonant quality, appearing in the main hook sections. |

## Score-draft starter (speculative)

> Model-guessed synth parameters — speculative, tune by ear.

/* DRAFT STARTER - speculative */
const reverb = new Tone.Reverb({ decay: 4, wet: 0.5 }).toDestination();
const chorus = new Tone.Chorus(4, 2.5, 0.7).toDestination();

// Main Arp Lead: PolySynth with fatsawtooth, chorus, reverb
const leadSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'fatsawtooth', count: 5, spread: 30 }, envelope: { attack: 0.01, decay: 0.3, release: 0.4 }, filter: {type: 'highpass', frequency: 400}, volume: -13 }).connect(chorus).connect(reverb);
const leadPattern = new Tone.Sequence((time, note) => {
  leadSynth.triggerAttackRelease(note, '16n', time);
}, ['F#5', null, 'C#6', null, 'F#5', null, 'B5', null, 'A5', null, 'C#6', null, 'A5', null, 'E5', null], '16n').start(0);

// Arp Bass: MonoSynth with fatsawtooth and drive
const bassSynth = new Tone.MonoSynth({ oscillator: { type: 'fatsawtooth', count: 3 }, filterEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.1, baseFrequency: 200, octaves: 2.6 }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 }, volume: -6 }).toDestination();
bassSynth.set({ filter: { Q: 2.5, type: 'lowpass' }, drive: 0.5 });
const bassPattern = new Tone.Sequence((time, note) => {
  bassSynth.triggerAttackRelease(note, '16n', time);
}, ['F#2', 'C#3', 'F#2', 'C#3', 'F#2', 'C#3', 'F#2', 'C#3', 'A2', 'E3', 'A2', 'E3', 'A2', 'E3', 'A2', 'E3'], '16n').start(0);

// Beat: Classic 4/4 with gated snare
const kick = new Tone.MembraneSynth({ volume: -3 }).toDestination();
const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { decay: 0.15 }, filter: { type: 'bandpass', Q: 1.2, frequency: 5000 }, volume: -9 }).connect(reverb);
const kickLoop = new Tone.Loop(time => kick.triggerAttackRelease('C1', '8n', time), '4n').start(0);
const snareLoop = new Tone.Loop(time => snare.triggerAttackRelease('16n', time), '2n').start('4n');

Tone.Transport.bpm.value = 126;
Tone.Transport.start();

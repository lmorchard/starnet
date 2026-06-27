# Black Lung — The Unreality Industry

> A dark, industrial electronic track at 161 BPM in C# minor. It begins with an ambient, evolving drone pad before introducing a powerful, driving four-on-the-floor rhythm section. The arrangement builds layers of distorted, arpeggiated synths, creating a dense and hypnotic texture. The structure features buildups, breakdowns, and periods of intense, layered rhythm, all characterized by a blend of vast reverb and aggressive digital distortion.

*Source: `The Unreality Industry.mp3` · Model: gemini-2.5-pro · stem-separated*

## Measured facts (MIR ground truth)

- **Tempo:** 161 BPM
- **Key:** C# minor (confidence 0.85)
- **Duration:** 5:19
- **Sections: 8** (boundaries at 0:00, 0:08, 0:39, 1:59, 2:15, 3:19, 3:58, 4:48)
- **Brightness (spectral centroid):** mean 1929 Hz (range 72–6039 Hz)
- **Dynamics:** RMS mean 0.130, range 13.5 dB
- **Timbre:** rolloff 3781 Hz, flatness 0.00, contrast 22.6, ZCR 0.048, harmonic ratio 0.89

## Overview (full-mix read)

| Dimension | Reading |
|---|---|
| Timbre | Primarily synthetic and electronic, featuring smooth, heavily reverberated pads contrasted with aggressive, distorted bass and sharp, plucky arpeggios. Percussion is a mix of deep, punchy kicks and crisp, metallic hi-hats. The overall sound is tonal but heavily processed with significant grit. |
| Brightness | Mid-focused, with a measured mean spectral centroid of 1929 Hz. The track balances dark, low-pass filtered pads and bass with brighter, cutting synth plucks and metallic percussion, occupying a full but not piercingly bright frequency spectrum. |
| Envelope | A study in contrasts: the foundational pad has a very slow attack and long release, creating a continuous wash. In contrast, the bass, drums, and melodic arpeggios all use very short, percussive envelopes with fast attacks and quick decays to emphasize the driving rhythm. |
| Register/density | The track builds from a sparse, low-mid drone into a very dense texture. The core rhythm section occupies the low and high frequencies (kick/bass, hats), while multiple interlocking synth arpeggios fill the mid-range, creating a thick, rhythmically complex wall of sound during its peaks. |
| Harmony/mode | Anchored in C# minor, the harmony is static and modal, relying on drones and repetitive melodic fragments rather than functional chord progressions. The persistent root-note bassline and minor-key arpeggios create a tense, dark, and hypnotic atmosphere. |
| Groove | A relentless and mechanical groove based on a straight 16th-note grid at 161 BPM. A four-on-the-floor kick provides the pulse, a strong backbeat defines the measure, and interlocking 16th-note patterns in the bass and synths create a driving, propulsive feel. |
| Space/grit | The track heavily utilizes both space and grit. Expansive reverb is applied generously to the pads and some synth accents, creating a sense of vastness. This is juxtaposed with significant distortion and drive on the bass and other synth elements, adding a layer of aggressive, industrial texture. |

> Model-guessed song-level synth direction — speculative, tune by ear.

SPECULATIVE STARTER: Set tempo to 161 BPM. Start with a PolySynth for the 'Drone Pad', using a 'fatsawtooth' oscillator, a long attack (~2.5s) and release (~4s), and a low-pass filter around 1.2kHz. Send it heavily to a master Reverb (e.g., 0.8 send). For drums, use a MembraneSynth for a 4/4 'Kick' and a NoiseSynth with a fast envelope for the 'Snare' on 2 & 4. A MetalSynth can play constant 16th notes for the 'Hi-Hat'. The core is the 'Distorted Arp Bass', an FMSynth with harmonicity ~3 and drive ~0.8, playing a tight 16th-note loop on C#2. Layer this with the 'Pluck Arp', a MonoSynth with a 'square' wave, plucky envelope (fast attack, short decay), and a resonant low-pass filter, playing a syncopated C# minor melody like ['', 'G#4', '', 'E5', '', 'G#4', 'C#5', ''...]. Route the bass and pluck through a master Distortion effect for extra grit.

## drums

> An aggressive and driving industrial drum track at 161 BPM, characterized by heavily distorted, synthetic percussion. The arrangement builds from sparse, atmospheric scraping sounds into a relentless four-on-the-floor beat with dense layers of metallic hi-hats, a sharp noise snare, and a punchy kick, creating a raw and powerful machine-like groove.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Industrial Kick | MembraneSynth | A driving, mostly four-on-the-floor pattern at 161 BPM, providing the core pulse of the track. | The foundational element of the beat, entering at 0:39. It's a heavily distorted, punchy kick with a sharp attack and significant low-end weight, defining the track's aggressive character. |
| Noise Snare | NoiseSynth | A strong, consistent backbeat on beats 2 and 4. | A sharp, digital snare sound that cuts through the dense mix. It has a noisy, almost bitcrushed quality and provides the main rhythmic counterpoint to the kick. |
| Digital Hats | MetalSynth | A constant, driving stream of 16th notes. | This track provides the high-frequency energy and propels the track forward. The sound is metallic, trashy, and synthetic, characteristic of industrial electronic music. |
| Scraping Texture | FMSynth | Sparse, long-held, arrhythmic events that swell and decay slowly. | This atmospheric layer defines the intro (0:00-0:39) and reappears in breakdowns. It's a complex, resonant sound, like a bowed or scraped piece of metal, creating tension and a sense of vast, dark space. Heavily treated with reverb. |
| Ride Cymbal | MetalSynth | Steady quarter-note pattern, accenting the main pulse. | A bright, metallic ride cymbal that layers on top of the hats in more intense sections (e.g., after 1:58). It adds a washy, sustained high-frequency layer that builds energy. |
| Glitch Perc | PluckSynth | Fast, syncopated, and repetitive rhythmic figures. | A high-pitched, clicky percussive layer that adds nervous, complex energy to the groove. It appears in various sections, often playing a fast, stuttering pattern that contrasts with the main beat. |

## vocals

> An isolated vocal stem featuring a single, heavily processed male spoken-word track. The voice is transformed into a rhythmic, industrial chant with extreme distortion, vocoder-like effects, and cavernous reverb, serving as both a lead element and a percussive driver.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Cyber-Chant | FMSynth with heavy distortion and reverb to emulate a processed vocoder or robotic voice. | A repetitive, syncopated 16th-note phrase, chanting on a near-monotone pitch. It alternates between longer, sustained words and short, staccato, percussive hits, creating a machine-like rhythm. | The only element in this stem, this track provides the lead vocal, rhythmic drive, and main textural content. It's present throughout, defining the track's aggressive, industrial character with its hypnotic repetition and heavy processing. |

## other

> An atmospheric and cinematic piece built on a massive, slow-moving choral pad. It gradually builds intensity by introducing a rigid, clock-like metallic pulse, which then gives way to a heavily distorted, highly syncopated, and propulsive synth bass/arp that drives the track's second half. The overall mood is dark, mechanical, and liturgical.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Cathedral Pad | PolySynth | Slow-moving, sustained block chords, typically held for 4-8 bars, rooted in C# minor. | Forms the atmospheric, harmonic foundation of the entire piece. Present from the start, it creates a massive, dark, and evolving soundscape. It's drenched in a very long, cavernous reverb. |
| Clockwork Click | MetalSynth | A steady 16th-note pulse, sometimes with accents or slight variations, often panned. | Enters around 0:39, acting as a high-frequency timekeeper. It introduces a mechanical, rigid feel against the fluid pad. It's processed with delay and panning, and eventually gives way to the main Engine Arp. |
| Engine Arp | MonoSynth | A driving, highly syncopated 16th-note bass/lead line, forming a tight ostinato loop. | The main driving force from 1:27 (87.4s) onwards. Its gritty, distorted, and resonant tone provides the track's aggression and momentum. It sits in the low-mid range, functioning as both a bass line and a rhythmic lead. |

## bass

> A single, heavily processed bass instrument that evolves from an atmospheric drone into a complex, syncopated, and aggressive rhythmic engine. Its primary character comes from heavy distortion and a resonant, 'talking' filter that provides both timbral interest and a percussive quality.

| Track | Instrument | Pattern | Notes |
|---|---|---|---|
| Talking Grit Bass | FMSynth with a resonant filter and distortion | A syncopated 16th-note pattern on a 1-bar loop, with rests creating a funky, lurching industrial groove. Evolves from a simple drone in the intro. | This is the sole instrument, defining the piece's rhythm and aggression. It starts as a slow, ominous drone before erupting at 0:43 into its main character: a tight, distorted, rhythmic force. The 'talking' quality comes from a resonant low-pass filter being modulated, making the bass the central melodic and textural element. |

# soundfont2 parsed object shape — spike notes

**Package:** `soundfont2` v0.5.0  
**Font inspected:** `audio-content/soundfonts/GeneralUser-GS.sf2`  
**Font stats:** 287 presets, 324 instruments, 920 samples

---

## Top-level `SoundFont2` object

```js
const { SoundFont2 } = require("soundfont2");
const sf = new SoundFont2(new Uint8Array(fs.readFileSync("...sf2")));
Object.keys(sf);
// => ['chunk', 'metaData', 'sampleData', 'samples', 'presetData', 'instruments', 'presets', 'banks']
```

| Field | Type | Description |
|-------|------|-------------|
| `chunk` | Object | Raw RIFF chunk tree (`id`, `length`, `buffer`, `subChunks`) |
| `metaData` | Object | INFO chunk fields (name, author, copyright, etc.) |
| `sampleData` | Uint8Array | Raw interleaved sample bytes (length ~32M for GUS) |
| `samples` | Array | High-level sample objects (920 for GUS) |
| `presetData` | Object | **Raw parsed chunk tables** — flat arrays from sfbk chunks |
| `instruments` | Array | High-level instrument objects (324 for GUS) |
| `presets` | Array | High-level preset objects (287 for GUS) |
| `banks` | Array (indexed obj) | Presets organized by bank number |

---

## `sf.metaData`

All string fields. Present keys for GUS:

```json
{
  "version": "2.1",
  "soundEngine": "E-mu 10K2",
  "name": "GeneralUser GS 2.0.3 BETA",
  "rom": undefined,
  "romVersion": undefined,
  "creationDate": "Tuesday 15 October 2024, 09:47:28",
  "author": "S. Christian Collins",
  "product": undefined,
  "copyright": "1997-2025 by S. Christian Collins",
  "comments": "...",
  "createdBy": "Polyphone"
}
```

---

## Preset objects — `sf.presets[i]`

```js
Object.keys(sf.presets[0]);
// => ['header', 'globalZone', 'zones']
```

### `preset.header`

```json
{
  "name": "Grand Piano",
  "preset": 0,
  "bank": 0,
  "bagIndex": 0,
  "library": 1058,
  "genre": 1058,
  "morphology": 1058
}
```

### `preset.globalZone`

Same shape as a zone (see below), but the `instrument` field is absent. Contains shared generators/modulators that apply to all zones in this preset. Example from Grand Piano:

```json
{
  "generators": {
    "8":  { "id": 8,  "value": -884 },
    "16": { "id": 16, "value": 70 },
    "28": { "id": 28, "value": 1586 }
    // ... more generator ids
  },
  "modulators": {
    "48": {
      "source": { "type": 1, "polarity": 0, "direction": 1, "palette": 0, "index": 2 },
      "id": 48,
      "value": 800,
      "valueSource": { "type": 0, "polarity": 0, "direction": 0, "palette": 0, "index": 0 },
      "transform": 0
    }
  }
}
```

### `preset.zones[i]`

```js
Object.keys(sf.presets[0].zones[0]);
// => ['keyRange', 'generators', 'modulators', 'instrument']
```

| Field | Type | Description |
|-------|------|-------------|
| `keyRange` | `{lo, hi}` | MIDI key range for this zone |
| `generators` | Object keyed by gen-id (string) | Sparse map of generator entries |
| `modulators` | Object keyed by mod-id (string) | Sparse map of modulator entries |
| `instrument` | Object | **Direct object reference** to the linked instrument (not an index) |

**Key generator IDs in preset zones:**

| Gen ID | SF2 name | Example value |
|--------|----------|---------------|
| 41 | instrument | `{ "id": 41, "value": 257 }` (raw index; the `.instrument` ref is the resolved object) |
| 43 | keyRange | `{ "id": 43, "range": { "lo": 0, "hi": 35 } }` |
| 44 | velRange | `{ "id": 44, "range": { "lo": 0, "hi": 49 } }` |

**Generator shape:** Each entry is `{ id: <number>, value: <number> }` for scalar generators, or `{ id: <number>, range: { lo: <number>, hi: <number> } }` for range generators (keyRange/velRange).

**Linking:** `zone.instrument` is a **resolved object reference** to the instrument, identical to the object in `sf.instruments[]`. The raw index is also present as `generators[41].value`.

---

## Instrument objects — `sf.instruments[i]`

Same structure as presets:

```js
Object.keys(sf.instruments[0]);
// => ['header', 'globalZone', 'zones']
```

### `instrument.header`

```json
{ "name": "Stereo Grand Mellow", "bagIndex": 1944 }
```

### `instrument.zones[i]`

```js
Object.keys(sf.instruments[0].zones[0]);
// => ['keyRange', 'generators', 'modulators', 'sample']
```

| Field | Type | Description |
|-------|------|-------------|
| `keyRange` | `{lo, hi}` | MIDI key range |
| `generators` | Object keyed by gen-id (string) | Sparse map — same shape as preset zones |
| `modulators` | Object keyed by mod-id (string) | Sparse map |
| `sample` | Object | **Direct object reference** to the linked sample (not an index) |

**Key generator IDs in instrument zones:**

| Gen ID | SF2 name | Example value |
|--------|----------|---------------|
| 43 | keyRange | `{ "id": 43, "range": { "lo": 0, "hi": 27 } }` |
| 44 | velRange | present when set; `{ "id": 44, "range": { "lo": 0, "hi": 127 } }` |
| 53 | sampleID | `{ "id": 53, "value": 285 }` (raw index; `.sample` is the resolved object) |

**Linking:** `zone.sample` is a **resolved object reference** to the sample. The raw index is also in `generators[53].value`.

---

## Sample objects — `sf.samples[i]`

```js
Object.keys(sf.samples[0]);
// => ['header', 'data']
```

### `sample.header`

All fields from the SF2 `shdr` chunk are present:

```json
{
  "name": "Accordion-A#2",
  "start": 0,
  "end": 13847,
  "startLoop": 13691,
  "endLoop": 13839,
  "sampleRate": 44100,
  "originalPitch": 62,
  "pitchCorrection": -23,
  "link": 0,
  "type": 1
}
```

Note: `start`/`end` are byte offsets into the raw `sampleData` buffer. `link` references a stereo partner (0 = none). `type`: 1=mono, 2=right, 4=left, 8=ROM.

### `sample.data`

`Int16Array` — the decoded sample audio data (length = header.end − header.start for the GUS first sample: 13847 frames). This is the actual PCM audio extracted from `sampleData`.

---

## Raw chunk tables — `sf.presetData`

**Yes, raw chunk tables are reachable.** `sf.presetData` exposes the flat parsed arrays directly, which is the preferred surface for a serializer (avoids re-deriving from resolved object refs).

```js
Object.keys(sf.presetData);
// => [
//   'presetHeaders', 'presetZones', 'presetModulators', 'presetGenerators',
//   'instrumentHeaders', 'instrumentZones', 'instrumentModulators', 'instrumentGenerators',
//   'sampleHeaders'
// ]
```

### `presetData.presetHeaders[i]` — same shape as `preset.header`

```json
{ "name": "Grand Piano", "preset": 0, "bank": 0, "bagIndex": 0, "library": 1058, "genre": 1058, "morphology": 1058 }
```

### `presetData.presetZones[i]` — bag table (index cross-references)

```json
{ "generatorIndex": 0, "modulatorIndex": 0 }
```

The zone's generators start at `presetGenerators[generatorIndex]`; the next bag's `generatorIndex` marks the end (sentinel pattern).

### `presetData.presetGenerators[i]` — flat generator list

```json
{ "id": 8, "value": -884 }
```

Range generators have `{ "id": 43, "range": { "lo": 0, "hi": 35 } }` instead of `value`.

### `presetData.instrumentHeaders[i]`

```json
{ "name": "+1 Saw", "bagIndex": 0 }
```

### `presetData.instrumentZones[i]`

```json
{ "generatorIndex": 0, "modulatorIndex": 0 }
```

### `presetData.instrumentGenerators[i]`

```json
{ "id": 8, "value": 5535 }
```

### `presetData.sampleHeaders[i]` — same shape as `sample.header`

```json
{
  "name": "Accordion-A#2",
  "start": 0, "end": 13847,
  "startLoop": 13691, "endLoop": 13839,
  "sampleRate": 44100,
  "originalPitch": 62,
  "pitchCorrection": -23,
  "link": 0,
  "type": 1
}
```

---

## Raw RIFF tree — `sf.chunk`

```js
Object.keys(sf.chunk);   // => ['id', 'length', 'buffer', 'subChunks']
sf.chunk.id;              // => 'RIFF'
sf.chunk.subChunks.length;  // => 3
```

Three top-level LIST chunks:

| Index | id | subChunks | Description |
|-------|----|-----------|-------------|
| 0 | LIST | 10 | INFO metadata |
| 1 | LIST | 2 | sdta (sample data: smpl + sm24) |
| 2 | LIST | 9 | pdta (preset/instrument/sample tables) |

Each subChunk: `{ id, length, buffer, subChunks? }`. Leaf chunks have no `subChunks`.

---

## `sf.sampleData`

Raw interleaved sample bytes as a `Uint8Array` (~32 MB for GUS). Individual sample PCM is extracted by each `sample.data` (`Int16Array`). For a serializer re-assembling the file, `sf.sampleData` is the source buffer to write into the `smpl` chunk verbatim.

---

## `sf.banks`

Array-like object indexed by bank number (0, 1, …). Each bank:

```js
sf.banks[0];  // => { presets: { '0': <preset obj>, '1': <preset obj>, ... } }
```

Presets within a bank are indexed by program number. This is a convenience index over `sf.presets` — same object references. Not needed for a serializer (use `sf.presets` directly with `preset.header.bank`/`preset.header.preset`).

---

## Serializer guidance summary

A serializer that works at the **`sf.presetData` chunk-table level** is the cleanest approach:

1. Filter which presets/instruments/samples to keep (by walking preset→zone→instrument→zone→sample refs).
2. Write new `presetHeaders`, `presetZones`, `presetGenerators`, `instrumentHeaders`, `instrumentZones`, `instrumentGenerators`, `sampleHeaders` arrays with re-indexed bag/generator offsets.
3. Concatenate only the kept sample PCM from `sf.sampleData` (using `header.start`/`header.end` offsets).
4. Re-pack into RIFF LIST chunks in the standard sfbk layout.

Key indexing to track during prune:
- Preset bag → generator/modulator index (sentinel pattern: next bag's index = end of this bag's generators).
- Generator 41 (preset → instrument): value is `instrumentHeaders[]` index.
- Generator 53 (instrument → sample): value is `sampleHeaders[]` index.
- `sampleHeader.start`/`end`: byte offsets into the smpl buffer; must be rewritten after concatenation.

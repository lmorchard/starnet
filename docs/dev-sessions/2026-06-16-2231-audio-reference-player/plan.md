# Audio Reference Player Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reusable, self-contained Tone.js harness that plays a generated audio-reference artifact in the browser, driven by a new structured `score_spec` (generalized, engine-shaped: open tracks + full Tone.js instrument palette) enriched onto each track by the analyzer.

**Architecture:** The analyzer's per-track interpretation gains two structured fields, `synth` (a palette instrument + flat option scalars) and `steps` (a grid + string-token note array). A pure function assembles `{root, mode, bpm, tracks}` into a top-level `score_spec` written to the JSON sidecar. A single static page (`player/index.html` + `player.js`, Tone.js from CDN) loads a `docs/<slug>.json` via a file picker, instantiates each track's synth from a type-whitelist, expands flat options to Tone constructor options, schedules the token array on a `Tone.Sequence`, and plays through a master gain + shared reverb with per-track mute/solo. No `eval`.

**Tech Stack:** Python ≥3.11 (existing tool), `pytest`; browser JS + Tone.js v15 (CDN UMD build, global `Tone`).

---

## Encoding decisions (Vertex-driven — read before starting)

The spec sketched `synth.options` as a nested object and `steps.notes` as a mixed-type
array (`null` | string | array). Vertex's structured-output schema is an OpenAPI subset that
does **not** reliably support free-form objects or mixed-type array items. So the wire shapes
are flattened to stay schema-clean:

- **`synth.options`** is a flat object of optional scalar fields (`oscillatorType`, `count`,
  `spread`, `attack`, `decay`, `sustain`, `release`, `volume`, `harmonicity`,
  `modulationIndex`, `filterType`, `filterFrequency`, `filterQ`). The **harness** expands
  these into nested Tone constructor options (`oscillator`, `envelope`, `filter`, …).
- **`steps.notes`** is an `array` of **strings** with a token grammar:
  `""` (empty) = rest · `"x"` = unpitched hit (for `NoiseSynth`) · `"C4"` = note ·
  `"C4+E4+G4"` = chord (plus-separated). This avoids mixed-type arrays.

The score-spec stored in the JSON sidecar keeps these wire shapes verbatim (it is the model's
output); the harness does the expansion at play time.

## Instrument palette (whitelist — keep Python + JS in sync)

```
Synth, MonoSynth, DuoSynth, FMSynth, AMSynth, PolySynth, MembraneSynth, MetalSynth, NoiseSynth, PluckSynth
```

`Sampler`/`Player`/`GrainPlayer` are intentionally excluded (need audio assets). A track whose
real instrument is sample-based emits the nearest synth approximation in `synth.type`.

## File Structure

```
tools/audio-reference/
  audio_reference/
    schema.py        (modify)  — add Synth/Steps to Track; add ScoreSpec
    scorespec.py     (create)  — PALETTE, is_supported, build_score_spec, build_sidecar  [pure]
    prompt.py        (modify)  — RESPONSE_SCHEMA + prompt gain synth/steps
    cli.py           (modify)  — write sidecar via build_sidecar (adds score_spec)
  player/
    index.html       (create)  — loads Tone.js (CDN) + player.js; file picker + controls
    player.js        (create)  — load JSON → build synths → schedule → transport + mute/solo
  tests/
    test_scorespec.py (create) — build_score_spec, is_supported, build_sidecar
    test_prompt.py    (modify) — assert synth/steps in schema + prompt
  README.md          (modify)  — "Play a result" section
```

---

## Task 1: Schema — add `synth`/`steps` to Track, add ScoreSpec

**Files:**
- Modify: `tools/audio-reference/audio_reference/schema.py`

(No test — TypedDicts are documentation-only, exercised by the scorespec/prompt tests.)

- [ ] **Step 1: Add the new TypedDicts and extend `Track`**

In `schema.py`, replace the `Track` class and add `SynthSpec`, `SynthOptions`, `Steps`,
and `ScoreSpec`. Insert `SynthOptions`/`SynthSpec`/`Steps` immediately above `Track`, replace
`Track`, and add `ScoreSpec` at the end of the file:

```python
class SynthOptions(TypedDict, total=False):
    """Flat, Vertex-safe synth options. The harness expands these to nested Tone options."""
    oscillatorType: str
    count: int
    spread: float
    attack: float
    decay: float
    sustain: float
    release: float
    volume: float
    harmonicity: float
    modulationIndex: float
    filterType: str
    filterFrequency: float
    filterQ: float


class SynthSpec(TypedDict):
    type: str               # a palette member (see scorespec.PALETTE)
    options: SynthOptions


class Steps(TypedDict):
    grid: str               # Tone subdivision, e.g. "16n", "8n"
    notes: list[str]        # token grammar: "" rest · "x" unpitched hit · "C4" note · "C4+E4" chord


class Track(TypedDict):
    name: str
    instrument: str         # prose (doc + beyond-engine inspiration)
    pattern: str            # prose
    description: str        # prose
    synth: SynthSpec        # playable
    steps: Steps            # playable


class ScoreSpec(TypedDict):
    root: str
    mode: str
    bpm: float
    tracks: list[Track]
```

- [ ] **Step 2: Verify it imports**

Run: `cd tools/audio-reference && uv run python -c "import audio_reference.schema"`
Expected: no output, exit 0.

- [ ] **Step 3: Commit**

```bash
git add tools/audio-reference/audio_reference/schema.py
git commit -m 'Add synth/steps track fields + ScoreSpec shape'
```

---

## Task 2: Score-spec assembly + palette (pure)

**Files:**
- Create: `tools/audio-reference/audio_reference/scorespec.py`
- Test: `tools/audio-reference/tests/test_scorespec.py`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_scorespec.py
from audio_reference.scorespec import (
    PALETTE, is_supported, build_score_spec, build_sidecar,
)

MIR = {
    "bpm": 129.0, "key": "F#", "mode": "minor", "key_confidence": 0.69,
    "duration_sec": 292.0, "sections": [{"start": 0.0}],
    "brightness": {"mean_hz": 1549.0, "min_hz": 95.0, "max_hz": 7565.0},
    "dynamics": {"rms_mean": 0.063, "rms_range_db": 22.4}, "midi_path": None,
}
META = {"artist": "The Knife", "title": "Silent Shout", "slug": "the-knife-silent-shout",
        "source_file": "x.mp3", "model": "gemini-2.5-pro"}
INTERP = {
    "summary": "s", "vocabulary": {}, "score_draft": "d",
    "tracks": [
        {"name": "Kick", "instrument": "MembraneSynth", "pattern": "1/4s", "description": "",
         "synth": {"type": "MembraneSynth", "options": {"volume": -5}},
         "steps": {"grid": "4n", "notes": ["C1", "C1", "C1", "C1"]}},
    ],
}


def test_palette_membership():
    assert is_supported("FMSynth") is True
    assert is_supported("NoiseSynth") is True
    assert is_supported("Sampler") is False        # excluded (needs assets)
    assert is_supported("Nonsense") is False
    assert "MembraneSynth" in PALETTE


def test_build_score_spec_maps_root_mode_bpm_and_passes_tracks():
    spec = build_score_spec(MIR, INTERP)
    assert spec["root"] == "F#"                    # mir.key -> root
    assert spec["mode"] == "minor"
    assert spec["bpm"] == 129.0
    assert spec["tracks"] == INTERP["tracks"]      # tracks passed through verbatim
    assert spec["tracks"][0]["synth"]["type"] == "MembraneSynth"


def test_build_score_spec_tolerates_missing_tracks():
    spec = build_score_spec(MIR, {"summary": "x"})
    assert spec["tracks"] == []


def test_build_sidecar_includes_all_blocks_and_score_spec():
    side = build_sidecar(META, MIR, INTERP)
    assert set(side.keys()) == {"meta", "mir", "interpretation", "score_spec"}
    assert side["meta"] == META
    assert side["mir"] == MIR
    assert side["interpretation"] == INTERP
    assert side["score_spec"]["bpm"] == 129.0
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tools/audio-reference && uv run pytest tests/test_scorespec.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'audio_reference.scorespec'`

- [ ] **Step 3: Write minimal implementation**

```python
# audio_reference/scorespec.py
"""Pure: the playable score-spec + the JSON sidecar assembly.

A score-spec is `{root, mode, bpm, tracks}` — the generalized, engine-shaped data the
browser harness plays. `root`/`mode`/`bpm` come from the MIR ground truth; `tracks` are
the LLM's enriched tracks (each carrying `synth` + `steps`) passed through verbatim.
"""

# Tone.js sources the harness can construct. Keep in sync with player/player.js PALETTE.
PALETTE = frozenset({
    "Synth", "MonoSynth", "DuoSynth", "FMSynth", "AMSynth", "PolySynth",
    "MembraneSynth", "MetalSynth", "NoiseSynth", "PluckSynth",
})


def is_supported(synth_type: str) -> bool:
    """True if the harness can construct this Tone.js source."""
    return synth_type in PALETTE


def build_score_spec(mir: dict, interp: dict) -> dict:
    """Assemble the playable score-spec from MIR ground truth + LLM interpretation."""
    return {
        "root": mir["key"],
        "mode": mir["mode"],
        "bpm": mir["bpm"],
        "tracks": interp.get("tracks", []),
    }


def build_sidecar(meta: dict, mir: dict, interp: dict) -> dict:
    """The full JSON sidecar: measured + interpreted data + the playable score-spec."""
    return {
        "meta": meta,
        "mir": mir,
        "interpretation": interp,
        "score_spec": build_score_spec(mir, interp),
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tools/audio-reference && uv run pytest tests/test_scorespec.py -v`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add tools/audio-reference/audio_reference/scorespec.py tools/audio-reference/tests/test_scorespec.py
git commit -m 'Add score-spec assembly + instrument palette (pure)'
```

---

## Task 3: Prompt + response schema — emit `synth`/`steps`

**Files:**
- Modify: `tools/audio-reference/audio_reference/prompt.py`
- Test: `tools/audio-reference/tests/test_prompt.py`

- [ ] **Step 1: Write the failing tests (append to `tests/test_prompt.py`)**

```python
def test_response_schema_track_requires_synth_and_steps():
    item = RESPONSE_SCHEMA["properties"]["tracks"]["items"]
    for field in ["synth", "steps"]:
        assert field in item["properties"]
        assert field in item["required"]
    synth = item["properties"]["synth"]
    assert "type" in synth["properties"] and "options" in synth["properties"]
    steps = item["properties"]["steps"]
    assert "grid" in steps["properties"] and "notes" in steps["properties"]
    # notes is an array of plain strings (Vertex-safe token grammar)
    assert steps["properties"]["notes"]["type"] == "array"
    assert steps["properties"]["notes"]["items"]["type"] == "string"


def test_prompt_explains_synth_steps_and_token_grammar():
    p = build_prompt(META, MIR).lower()
    assert "synth" in p and "steps" in p
    assert "grid" in p
    # the token grammar must be spelled out for the model
    assert "rest" in p and "chord" in p
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd tools/audio-reference && uv run pytest tests/test_prompt.py -v`
Expected: FAIL — `KeyError: 'synth'` (schema) and missing-substring assertion (prompt).

- [ ] **Step 3: Extend `RESPONSE_SCHEMA` track items**

In `prompt.py`, the `tracks.items` object currently has `properties` `name/instrument/
pattern/description` and `required` of the same four. Add `synth` and `steps` to both.
Replace the `"items"` block of `tracks` with:

```python
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "instrument": {"type": "string"},
                    "pattern": {"type": "string"},
                    "description": {"type": "string"},
                    "synth": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string"},
                            "options": {
                                "type": "object",
                                "properties": {
                                    "oscillatorType": {"type": "string"},
                                    "count": {"type": "integer"},
                                    "spread": {"type": "number"},
                                    "attack": {"type": "number"},
                                    "decay": {"type": "number"},
                                    "sustain": {"type": "number"},
                                    "release": {"type": "number"},
                                    "volume": {"type": "number"},
                                    "harmonicity": {"type": "number"},
                                    "modulationIndex": {"type": "number"},
                                    "filterType": {"type": "string"},
                                    "filterFrequency": {"type": "number"},
                                    "filterQ": {"type": "number"},
                                },
                            },
                        },
                        "required": ["type", "options"],
                    },
                    "steps": {
                        "type": "object",
                        "properties": {
                            "grid": {"type": "string"},
                            "notes": {"type": "array", "items": {"type": "string"}},
                        },
                        "required": ["grid", "notes"],
                    },
                },
                "required": ["name", "instrument", "pattern", "description", "synth", "steps"],
            },
```

- [ ] **Step 4: Extend the prompt body**

In `build_prompt`, the track-breakdown paragraph currently ends with the `description:` bullet.
Add `synth` + `steps` instructions. Replace the block from `"Then break the piece into TRACKS."`
through the `- description:` bullet with:

```python
    palette = ", ".join(TONE_SOURCES)
    return f"""... (unchanged preamble through the seven dimensions) ..."""
```

Concretely, after the existing `- description:` bullet line, insert these lines into the
f-string (keep everything else):

```
- synth: a PLAYABLE instrument spec — `type` MUST be one of the Tone.js sources:
    {palette}
  (pick the nearest if the real instrument is sample-based), and `options` is a FLAT object
  using only these optional scalar fields where relevant: oscillatorType (e.g. "sawtooth",
  "square", "fatsawtooth", "triangle", "sine"), count, spread, attack, decay, sustain,
  release, volume (dB, usually negative), harmonicity, modulationIndex, filterType, filterFrequency, filterQ.
- steps: a PLAYABLE 1-2 bar loop — `grid` is the Tone subdivision (e.g. "16n", "8n", "4n")
  and `notes` is an ARRAY OF STRINGS using this token grammar:
    "" (empty string) = a rest; "x" = an unpitched hit (use for NoiseSynth percussion);
    "C4" = a single note; "C4+E4+G4" = a chord (plus-separated). Keep it consistent with the
    pattern and grid you described, and concrete enough to loop.
```

(The `palette` local already exists in `build_prompt`; reuse it.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd tools/audio-reference && uv run pytest tests/test_prompt.py -v`
Expected: PASS (all prompt tests, including the two new ones).

- [ ] **Step 6: Commit**

```bash
git add tools/audio-reference/audio_reference/prompt.py tools/audio-reference/tests/test_prompt.py
git commit -m 'Prompt + schema: emit playable synth/steps per track'
```

---

## Task 4: CLI — write `score_spec` into the JSON sidecar

**Files:**
- Modify: `tools/audio-reference/audio_reference/cli.py`

(No new unit test — `build_sidecar` is tested in Task 2; this is the wiring. Verified on the
re-run in Task 7.)

- [ ] **Step 1: Import `build_sidecar`**

In `cli.py`, add to the imports near the other `from .` imports:

```python
from .scorespec import build_sidecar
```

- [ ] **Step 2: Use it when writing the JSON sidecar**

Replace the JSON-writing block:

```python
    with open(json_path, "w") as fh:
        json.dump({"meta": meta, "mir": mir, "interpretation": llm}, fh, indent=2)
```

with:

```python
    with open(json_path, "w") as fh:
        json.dump(build_sidecar(meta, mir, llm), fh, indent=2)
```

- [ ] **Step 3: Verify the CLI still parses and the suite is green**

Run: `cd tools/audio-reference && uv run audio-reference analyze --help`
Expected: argparse help, exit 0.
Run: `cd tools/audio-reference && uv run pytest -q`
Expected: PASS (all tests).

- [ ] **Step 4: Commit**

```bash
git add tools/audio-reference/audio_reference/cli.py
git commit -m 'CLI: write score_spec into the JSON sidecar'
```

---

## Task 5: Browser harness — `player/index.html` + `player.js`

**Files:**
- Create: `tools/audio-reference/player/index.html`
- Create: `tools/audio-reference/player/player.js`

(No unit test — this is the I/O boundary; validated by ear in Task 7.)

- [ ] **Step 1: Create `player/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>audio-reference player</title>
  <script src="https://cdn.jsdelivr.net/npm/tone@15/build/Tone.js"></script>
  <style>
    body { font: 14px/1.5 system-ui, sans-serif; margin: 2rem; max-width: 720px; }
    h1 { font-size: 1.2rem; }
    .controls { margin: 1rem 0; display: flex; gap: .5rem; align-items: center; }
    button { font: inherit; padding: .3rem .8rem; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { text-align: left; padding: .25rem .5rem; border-bottom: 1px solid #ddd; }
    .muted { opacity: .4; }
    #warnings { color: #b00; white-space: pre-wrap; }
    code { background: #f2f2f2; padding: 0 .25rem; }
  </style>
</head>
<body>
  <h1>audio-reference player</h1>
  <p>Load a generated <code>docs/&lt;slug&gt;.json</code> artifact and play its
     <code>score_spec</code>. (Open this file directly — <code>file://</code> works.)</p>
  <div class="controls">
    <input type="file" id="file" accept="application/json,.json" />
    <button id="play" disabled>▶ Play</button>
    <button id="stop" disabled>■ Stop</button>
    <span id="meta"></span>
  </div>
  <div id="warnings"></div>
  <table id="tracks"><tbody></tbody></table>
  <script type="module" src="./player.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `player/player.js`**

```js
// Browser harness: load a docs/<slug>.json artifact and play its score_spec with Tone.js.
// No eval — only known Tone constructors from PALETTE, with plain-data options.

const PALETTE = new Set([
  "Synth", "MonoSynth", "DuoSynth", "FMSynth", "AMSynth", "PolySynth",
  "MembraneSynth", "MetalSynth", "NoiseSynth", "PluckSynth",
]);
const UNPITCHED = new Set(["NoiseSynth"]);

const $ = (id) => document.getElementById(id);
const warnings = [];
let built = null; // { sequences:[], gains:[], reverb, master }

// Flat option scalars -> nested Tone constructor options. Only set what's provided.
function expandOptions(o = {}) {
  const out = {};
  if (o.oscillatorType || o.count != null || o.spread != null) {
    out.oscillator = {};
    if (o.oscillatorType) out.oscillator.type = o.oscillatorType;
    if (o.count != null) out.oscillator.count = o.count;
    if (o.spread != null) out.oscillator.spread = o.spread;
  }
  if (o.attack != null || o.decay != null || o.sustain != null || o.release != null) {
    out.envelope = {};
    if (o.attack != null) out.envelope.attack = o.attack;
    if (o.decay != null) out.envelope.decay = o.decay;
    if (o.sustain != null) out.envelope.sustain = o.sustain;
    if (o.release != null) out.envelope.release = o.release;
  }
  if (o.filterType || o.filterQ != null) {
    out.filter = {};
    if (o.filterType) out.filter.type = o.filterType;
    if (o.filterQ != null) out.filter.Q = o.filterQ;
  }
  if (o.filterFrequency != null) out.filterEnvelope = { baseFrequency: o.filterFrequency };
  if (o.harmonicity != null) out.harmonicity = o.harmonicity;
  if (o.modulationIndex != null) out.modulationIndex = o.modulationIndex;
  if (o.volume != null) out.volume = o.volume;
  return out;
}

function makeSynth(type, opts) {
  const options = expandOptions(opts);
  try {
    if (type === "PolySynth") return new Tone.PolySynth(Tone.Synth, options);
    return new Tone[type](options);
  } catch (e) {
    // Options didn't fit this source — fall back to a bare instance so it still sounds.
    warnings.push(`options rejected for ${type}; using defaults (${e.message})`);
    if (type === "PolySynth") return new Tone.PolySynth(Tone.Synth);
    return new Tone[type]();
  }
}

// Trigger one step token on a synth, honoring per-type signatures.
function triggerStep(synth, type, token, dur, time) {
  if (!token) return;                       // "" -> rest
  if (UNPITCHED.has(type)) { synth.triggerAttackRelease(dur, time); return; }
  const note = token === "x" ? "C3" : (token.includes("+") ? token.split("+") : token);
  synth.triggerAttackRelease(note, dur, time);
}

function disposeBuilt() {
  if (!built) return;
  built.sequences.forEach((s) => s.dispose());
  built.gains.forEach((g) => g.dispose());
  built.reverb?.dispose();
  built.master?.dispose();
  built = null;
}

function build(spec) {
  disposeBuilt();
  warnings.length = 0;
  Tone.Transport.stop();
  Tone.Transport.cancel();
  Tone.Transport.position = 0;
  Tone.Transport.bpm.value = spec.bpm || 120;

  const master = new Tone.Gain(0.9).toDestination();
  const reverb = new Tone.Reverb({ decay: 2.2, wet: 0.15 }).connect(master);

  const gains = [];
  const sequences = [];
  const rows = [];
  (spec.tracks || []).forEach((t, i) => {
    const type = t.synth?.type;
    if (!type || !PALETTE.has(type)) {
      warnings.push(`track "${t.name}" skipped: unsupported synth type ${JSON.stringify(type)}`);
      rows.push({ t, type, muted: true, skipped: true });
      return;
    }
    const gain = new Tone.Gain(1).connect(reverb);
    const synth = makeSynth(type, t.synth.options || {});
    synth.connect(gain);
    const grid = t.steps?.grid || "8n";
    const notes = t.steps?.notes || [];
    const seq = new Tone.Sequence((time, tok) => triggerStep(synth, type, tok, grid, time), notes, grid);
    seq.start(0);
    gains.push(gain);
    sequences.push(seq);
    rows.push({ t, type, gain, muted: false, skipped: false });
  });

  built = { sequences, gains, reverb, master, rows };
  return rows;
}

// --- mute / solo ---
function applyMuteSolo(rows) {
  const anySolo = rows.some((r) => r.solo);
  rows.forEach((r) => {
    if (r.skipped) return;
    const audible = anySolo ? r.solo : !r.muted;
    r.gain.gain.rampTo(audible ? 1 : 0, 0.05);
  });
}

function renderTracks(rows) {
  const tbody = $("tracks").querySelector("tbody");
  tbody.innerHTML = "";
  const header = document.createElement("tr");
  header.innerHTML = "<th>Track</th><th>Instrument</th><th>Grid</th><th>Mute</th><th>Solo</th>";
  tbody.appendChild(header);
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    if (r.skipped) tr.className = "muted";
    tr.innerHTML =
      `<td>${r.t.name ?? ""}</td><td>${r.type ?? "—"}</td>` +
      `<td>${r.t.steps?.grid ?? ""}</td>` +
      `<td>${r.skipped ? "—" : '<input type="checkbox" class="mute">'}</td>` +
      `<td>${r.skipped ? "—" : '<input type="checkbox" class="solo">'}</td>`;
    if (!r.skipped) {
      tr.querySelector(".mute").addEventListener("change", (e) => { r.muted = e.target.checked; applyMuteSolo(rows); });
      tr.querySelector(".solo").addEventListener("change", (e) => { r.solo = e.target.checked; applyMuteSolo(rows); });
    }
    tbody.appendChild(tr);
  });
  $("warnings").textContent = warnings.join("\n");
}

// --- file load + transport controls ---
$("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  let json;
  try { json = JSON.parse(await file.text()); }
  catch (err) { $("warnings").textContent = `could not parse JSON: ${err.message}`; return; }
  const spec = json.score_spec || json; // accept a full sidecar or a bare score_spec
  const rows = build(spec);
  $("meta").textContent = `${spec.root ?? "?"} ${spec.mode ?? ""} · ${Math.round(spec.bpm ?? 0)} BPM · ${(spec.tracks || []).length} tracks`;
  renderTracks(rows);
  $("play").disabled = false;
  $("stop").disabled = false;
});

$("play").addEventListener("click", async () => {
  await Tone.start();          // unlock audio on user gesture
  Tone.Transport.start();
});
$("stop").addEventListener("click", () => { Tone.Transport.stop(); Tone.Transport.position = 0; });
```

- [ ] **Step 3: Manual smoke test (no audio asset needed)**

Open `tools/audio-reference/player/index.html` directly in a browser (`file://`). Load any
existing `tools/audio-reference/docs/*.json` (the pre-Task-3 ones have no `score_spec`, so
expect the meta line to read `? · 0 tracks` and no sound — that's correct; real playback is
verified in Task 7 after regenerating). Confirm: the file picker works, no console errors on
load, Play/Stop enable. 

- [ ] **Step 4: Commit**

```bash
git add tools/audio-reference/player/index.html tools/audio-reference/player/player.js
git commit -m 'Add browser Tone.js harness for playing score_spec artifacts'
```

---

## Task 6: README — document the player

**Files:**
- Modify: `tools/audio-reference/README.md`

- [ ] **Step 1: Add a "Play a result" section**

After the `## Output` section, insert:

```markdown
## Play a result (browser harness)

Each artifact's JSON carries a `score_spec` — a generalized, engine-shaped score
(`{root, mode, bpm, tracks}`, each track an instrument + a step pattern). To hear an
approximation of the analyzed piece:

1. Open `player/index.html` directly in a browser (`file://` is fine — no server needed).
2. Click the file picker and choose a `docs/<slug>.json`.
3. Press **Play**. Toggle per-track **Mute**/**Solo** to inspect the arrangement.

The harness loads Tone.js from a CDN and only constructs instruments from a fixed palette
(`Synth`, `MonoSynth`, `FMSynth`, `MetalSynth`, `NoiseSynth`, …) — it never executes the raw
`score_draft` from the Markdown (that stays a read-only reference). Sample-based sources
(`Sampler`/`Player`) are out of scope for now; those tracks emit a nearest-synth approximation.
```

- [ ] **Step 2: Commit**

```bash
git add tools/audio-reference/README.md
git commit -m 'README: document the browser player harness'
```

---

## Task 7: Regenerate the corpus + ear-check (validation/iteration)

**Files:**
- Regenerated: `tools/audio-reference/docs/trst-icabod.{md,json}`,
  `tools/audio-reference/docs/the-knife-silent-shout.{md,json}`

This is the validation gate — requires ADC + the audio files (Les runs it / confirms by ear).

- [ ] **Step 1: Re-run the analyzer on both reference tracks**

```bash
cd tools/audio-reference
uv run audio-reference analyze "/Users/lorchard/Downloads/Trust - Icabod.mp3" \
  --artist "TR/ST" --title "Icabod" --no-midi
uv run audio-reference analyze "/Users/lorchard/Downloads/The Knife - Silent Shout (Official Music Video).mp3" \
  --artist "The Knife" --title "Silent Shout" --no-midi
```

Expected: both rewrite `docs/<slug>.{md,json}`; each `.json` now has a top-level `score_spec`
with `tracks[].synth` and `tracks[].steps`.

- [ ] **Step 2: Confirm the score_spec shape landed**

Run: `cd tools/audio-reference && uv run python -c "import json; d=json.load(open('docs/trst-icabod.json')); t=d['score_spec']['tracks'][0]; print(t['synth']['type'], t['steps']['grid'], t['steps']['notes'][:8])"`
Expected: a palette type, a grid string, and a list of string tokens.

- [ ] **Step 3: Listen (manual)**

Open `player/index.html`, load each regenerated `docs/<slug>.json`, press Play. Confirm it
produces a recognizable approximation (tempo/key right, percussion vs. melodic parts audible).
Note in `notes.md` anything to tune in the prompt's `synth`/`steps` instructions or the
harness trigger adapter, then iterate (re-run, re-listen) before committing.

- [ ] **Step 4: Commit the regenerated corpus**

```bash
git add tools/audio-reference/docs/
git commit -m 'Regenerate corpus with playable score_spec (Icabod, Silent Shout)'
```

---

## Self-Review notes

- **Spec coverage:** enrich tracks with synth/steps (T1, T3) · pure tested score-spec assembly
  written to JSON sidecar (T2, T4) · palette whitelist in Python + JS (T2, T5) · reusable
  file://-loadable harness with CDN Tone, instrument factory, flat-options expansion, trigger
  adapter, sequence scheduling, master+reverb, mute/solo (T5) · prompt extended not replaced,
  raw score_draft kept (T3) · README (T6) · regenerate + ear-check iteration gate (T7). Reverb
  included per spec. Render changes intentionally omitted (spec: "gains nothing required").
- **Placeholder scan:** no TBD/TODO; every code step shows complete code. The one f-string
  insertion (T3 Step 4) gives the exact lines to add and notes the surrounding anchors.
- **Type consistency:** `synth.{type,options}` and `steps.{grid,notes}` names match across
  schema.py (T1), RESPONSE_SCHEMA (T3), scorespec passthrough (T2), and player.js consumption
  (T5: `t.synth.type`, `t.synth.options`, `t.steps.grid`, `t.steps.notes`). `score_spec` key
  name matches between build_sidecar (T2), cli.py (T4), and player.js `json.score_spec` (T5).
  PALETTE membership identical in scorespec.py (T2) and player.js (T5).
- **Encoding caveat:** flat `synth.options` + string-token `notes` are the Vertex-safe wire
  shapes (see "Encoding decisions"); the spec's nested/mixed sketch is superseded here.
```

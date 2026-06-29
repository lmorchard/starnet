// audio-reference Strudel player. Loads a docs/<slug>.json sidecar, shows each track's `strudel`
// pattern in an editable box, and layers the un-muted tracks into one stack(...) played via
// @strudel/web's evaluate(). Edits save back through /save/<slug>.
//
// Notes (from the Strudel+superdough spike): initStrudel() returns undefined and registers the
// pattern fns + evaluate/hush as window globals ASYNCHRONOUSLY (no promise) — so we poll for
// readiness. evaluate() (NOT new Function) transpiles mini-notation string literals and schedules
// playback. dirt-samples stream from github after boot. .rev() needs parens in 1.0.3.

const $ = (id) => document.getElementById(id);

let booted = false;
let currentSlug = null;          // set when loaded from the library; enables Save
let currentSpec = null;          // {root, mode, bpm} of the loaded track
let rows = [];                   // [{ track, strudel, muted, solo, _ta }]
let userWantsPlay = false;

const log = (msg) => { $("warnings").textContent = msg || ""; };
const setStatus = (msg) => { $("status").textContent = msg || ""; };

// Swallow the benign async errors @strudel/web can emit on rapid hush/replay.
window.addEventListener("unhandledrejection", (e) => {
  if (/play is not a function|InvalidAccessError/.test(String(e.reason?.message || e.reason))) e.preventDefault();
});

// ---- boot ---------------------------------------------------------------------------------

async function ensureBooted() {
  if (booted) return true;
  initStrudel();                 // returns undefined; registers globals async — poll for them
  const t0 = Date.now();
  while (typeof window.evaluate !== "function" || typeof window.hush !== "function") {
    if (Date.now() - t0 > 10000) { log("timed out loading Strudel"); return false; }
    await new Promise((r) => setTimeout(r, 60));
  }
  await getAudioContext().resume();    // the Play click is our user gesture
  // dirt-samples (bd/hh/sd…) stream from github; synth sounds work immediately, so don't block.
  if (typeof window.samples === "function")
    samples("github:tidalcycles/dirt-samples").catch(() => {});
  booted = true;
  return true;
}

// ---- assemble + play ----------------------------------------------------------------------

const isAudible = (r) => {
  const anySolo = rows.some((x) => x.solo);
  return (anySolo ? r.solo : !r.muted) && r.strudel.trim();
};

function buildProgram() {
  const parts = rows.filter(isAudible).map((r) => r.strudel.trim());
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : "stack(\n  " + parts.join(",\n  ") + "\n)";
}

async function play() {
  if (!(await ensureBooted())) return;
  let program = buildProgram();
  if (!program) { log("nothing to play — every track is muted or empty"); return; }
  userWantsPlay = true;
  // Tempo: 1 cycle = 1 bar (4/4), so cycles-per-minute = bpm / 4. .cpm() rides on the pattern
  // (the runtime exposes no global setcps in 1.0.3). Patterns are authored "1 cycle = 1 bar".
  if (currentSpec?.bpm) program = `(${program}).cpm(${(currentSpec.bpm / 4).toFixed(3)})`;
  try { hush(); window.evaluate(program); setStatus("▶ playing"); log(""); }
  catch (e) { log("play error: " + (e.message || e)); }
}

function stop() {
  userWantsPlay = false;
  if (typeof window.hush === "function") hush();
  setStatus("");
}

// ---- track cards --------------------------------------------------------------------------

function renderTracks() {
  const host = $("tracks");
  host.innerHTML = "";
  if (!rows.length) return;
  if (!rows.some((r) => r.strudel.trim()))
    log("This sidecar has no Strudel patterns (likely an old Tone artifact) — regenerate it with the current analyzer.");
  rows.forEach((row) => {
    const card = document.createElement("div");
    card.className = "track";
    const head = document.createElement("div");
    head.className = "track-head";

    const name = document.createElement("span");
    name.className = "track-name";
    name.textContent = row.track.name || "(unnamed)";
    head.append(name);

    if (row.track.stem) {
      const badge = document.createElement("span");
      badge.className = "stem-badge";
      badge.textContent = row.track.stem;
      head.append(badge);
    }
    if (row.track._strudel_valid === false) {
      const warn = document.createElement("span");
      warn.className = "invalid";
      warn.textContent = "⚠ did not validate";
      head.append(warn);
    }

    [["mute", "muted"], ["solo", "solo"]].forEach(([label, key]) => {
      const l = document.createElement("label");
      l.className = "ctl";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!row[key];
      cb.addEventListener("change", () => { row[key] = cb.checked; if (userWantsPlay) play(); });
      l.append(cb, label);
      head.append(l);
    });
    card.append(head);

    const ta = document.createElement("textarea");
    ta.value = row.strudel;
    ta.spellcheck = false;
    ta.addEventListener("input", () => { row.strudel = ta.value; });
    // Cmd/Ctrl+Enter re-plays with the current edits.
    ta.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); play(); }
    });
    row._ta = ta;
    card.append(ta);
    host.append(card);
  });
}

// ---- load / save --------------------------------------------------------------------------

function loadSpec(json, label, slug) {
  const spec = json.score_spec || json;
  currentSpec = { root: spec.root, mode: spec.mode, bpm: spec.bpm };
  currentSlug = slug || null;
  rows = (spec.tracks || []).map((t) => ({
    track: t, strudel: typeof t.strudel === "string" ? t.strudel : "",
    muted: false, solo: false, _ta: null,
  }));
  renderTracks();
  const head = label ? `${label} · ` : "";
  $("meta").textContent = `${head}${spec.root ?? "?"} ${spec.mode ?? ""} · ${Math.round(spec.bpm ?? 0)} BPM · ${rows.length} tracks`;
  setStatus("");
  $("play").disabled = false;
  $("stop").disabled = false;
  $("save").disabled = !currentSlug;
}

// Reassemble the score_spec for saving: original tracks with edited per-track `strudel`.
function currentScoreSpec() {
  return { ...currentSpec, tracks: rows.map((r) => ({ ...r.track, strudel: r.strudel })) };
}

$("file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try { loadSpec(JSON.parse(await file.text()), file.name, null); }
  catch (err) { log("could not parse JSON: " + err.message); }
});

$("save").addEventListener("click", async () => {
  if (!currentSlug) return;
  setStatus("saving…");
  try {
    const res = await fetch(`/save/${currentSlug}`, { method: "POST", body: JSON.stringify(currentScoreSpec()) });
    setStatus(res.ok ? "saved ✓" : `save failed (${res.status})`);
  } catch (err) { setStatus("save failed: " + err.message); }
});

$("play").addEventListener("click", play);
$("stop").addEventListener("click", stop);

// ---- library ------------------------------------------------------------------------------

async function initLibrary() {
  let idx;
  try {
    const res = await fetch("../docs/index.json", { cache: "no-store" });
    if (!res.ok) return;
    idx = await res.json();
  } catch { return; }   // file:// or no manifest → file-picker only
  const ul = $("library");
  let playingBtn = null;
  idx.forEach((e) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.textContent = `${e.artist} — ${e.title}  ·  ${e.root} ${e.mode} · ${Math.round(e.bpm || 0)} BPM · ${e.tracks} trk`;
    btn.addEventListener("click", async () => {
      try {
        const r = await fetch(`../docs/${e.slug}.json`, { cache: "no-store" });
        loadSpec(await r.json(), `${e.artist} — ${e.title}`, e.slug);
        if (playingBtn) playingBtn.classList.remove("playing");
        btn.classList.add("playing"); playingBtn = btn;
      } catch (err) { log(`could not load ${e.slug}: ${err.message}`); }
    });
    li.append(btn); ul.append(li);
  });
  if (idx.length) $("library-section").style.display = "";
}
initLibrary();

// Pause cleanly when the tab loses focus (background-tab timer throttling glitches the scheduler);
// resume on return if the user still wants playback.
window.addEventListener("blur", () => { if (userWantsPlay && typeof window.hush === "function") hush(); });
window.addEventListener("focus", () => { if (userWantsPlay) play(); });

// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import sf2pkg from "soundfont2";
const { SoundFont2 } = sf2pkg;
import { cullFont, main } from "../scripts/cull-soundfonts.js";
import { sanitize } from "../js/audio/strudel/soundfont.js";
import { SOUNDFONTS } from "../audio-content/soundfonts/manifest.js";

const AUTHORING = "audio-content/soundfonts/GeneralUser-GS.sf2";

test(
  "cullFont writes a minimal deploy SF2 containing exactly the used gus_ presets",
  { skip: !existsSync(AUTHORING) && "authoring font absent" },
  () => {
    const outPath = "audio-content/soundfonts/__test.deploy.sf2";
    const used = new Set(["gus_warm_pad", "gus_synth_bass_1"]);
    const result = cullFont(
      { authoringPath: AUTHORING, deployPath: outPath, prefix: "gus_" },
      used,
    );
    try {
      const out = new SoundFont2(new Uint8Array(readFileSync(outPath)));

      // CONTRACT: deploy font must hold RAW preset names (same as the authoring font), NOT sanitized
      // names. The loader calls sanitize() at load time — if the file already stores sanitized names,
      // sanitize() runs again and double-prefixes them (gus_warm_pad → gus_gus_warm_pad), silently
      // breaking all references in songs.
      const rawNames = out.presets
        .map((p) => p.header.name)
        .filter((n) => n !== "EOP");
      assert.ok(
        rawNames.includes("Warm Pad"),
        `deploy font must store RAW name "Warm Pad", got: ${JSON.stringify(rawNames)}`,
      );
      assert.ok(
        rawNames.includes("Synth Bass 1"),
        `deploy font must store RAW name "Synth Bass 1", got: ${JSON.stringify(rawNames)}`,
      );
      // And must NOT store the sanitized forms (that would be the bug).
      assert.ok(
        !rawNames.includes("gus_warm_pad"),
        `deploy font must NOT store sanitized name "gus_warm_pad" (double-prefix bug), got: ${JSON.stringify(rawNames)}`,
      );
      assert.ok(
        !rawNames.includes("gus_synth_bass_1"),
        `deploy font must NOT store sanitized name "gus_synth_bass_1" (double-prefix bug), got: ${JSON.stringify(rawNames)}`,
      );

      // LOADER CONTRACT: what the loader actually registers after applying sanitize() to raw names
      // must equal the set of names songs reference. This is the observable consequence that was
      // silently broken by the double-prefix bug.
      const loaderRegistered = new Set(
        rawNames.map((name, i) => sanitize(name, i, "gus_")),
      );
      assert.deepEqual(
        loaderRegistered,
        new Set(["gus_warm_pad", "gus_synth_bass_1"]),
        `loader would register ${JSON.stringify([...loaderRegistered])}, expected gus_warm_pad + gus_synth_bass_1`,
      );

      // Size check: meaningful shrink from culling.
      assert.ok(
        result.deployBytes < result.authoringBytes / 4,
        `expected meaningful shrink: ${result.deployBytes} < ${result.authoringBytes / 4}`,
      );

      // Preset count: only the 2 kept presets + EOP sentinel.
      assert.ok(
        out.presets.length <= 3,
        `expected <=3 presets (orphans dropped), got ${out.presets.length}`,
      );
    } finally {
      rmSync(outPath, { force: true });
    }
  },
);

// Smoke test: run the actual CLI entry point against the REAL manifest. This guards the whole
// dispatch path — notably that main() SKIPS entries without a deployPath (the topical MuseScore
// sets), rather than crashing on writeFileSync(undefined). That regression shipped once because
// nothing exercised the CLI end-to-end (the unit test above only calls cullFont directly).
// main() regenerates GeneralUser-GS.deploy.sf2 — the cull is deterministic, so it rewrites the
// committed file byte-identically (working tree stays clean).
test(
  "cull CLI main() runs against the real manifest without throwing",
  { skip: !existsSync(AUTHORING) && "authoring font absent" },
  () => {
    // The guard is only meaningful if the manifest actually contains deployPath-less entries
    // (the topical sets) — i.e. the exact scenario that used to crash.
    assert.ok(
      SOUNDFONTS.some((e) => !e.deployPath),
      "expected the manifest to contain deployPath-less topical entries (the regression scenario)",
    );

    // main() logs progress; silence it so the test output stays clean.
    const origLog = console.log;
    console.log = () => {};
    try {
      assert.doesNotThrow(
        () => main(),
        "cull CLI must handle deployPath-less manifest entries without throwing",
      );
    } finally {
      console.log = origLog;
    }

    // The regenerated gus_ deploy font must reparse and register the expected loader names.
    const gus = SOUNDFONTS.find((e) => e.prefix === "gus_");
    assert.ok(gus?.deployPath, "manifest must have a gus_ entry with a deployPath");
    const out = new SoundFont2(new Uint8Array(readFileSync(gus.deployPath)));
    const loaderNames = new Set(
      out.presets
        .map((p) => p.header.name)
        .filter((n) => n !== "EOP")
        .map((name, i) => sanitize(name, i, "gus_")),
    );
    assert.ok(
      loaderNames.has("gus_warm_pad") && loaderNames.has("gus_synth_bass_1"),
      `regenerated deploy font registers ${JSON.stringify([...loaderNames])}`,
    );
  },
);

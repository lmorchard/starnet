// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import sf2pkg from "soundfont2";
const { SoundFont2 } = sf2pkg;
import { cullFont } from "../scripts/cull-soundfonts.js";
import { sanitize } from "../js/audio/strudel/soundfont.js";

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

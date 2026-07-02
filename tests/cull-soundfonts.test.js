// @ts-check
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, rmSync } from "node:fs";
import sf2pkg from "soundfont2";
const { SoundFont2 } = sf2pkg;
import { cullFont } from "../scripts/cull-soundfonts.js";

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
      const names = out.presets.map((p) => p.header.name);
      // The deploy font carries sanitized preset names (gus_*) so the on-disk font is self-descriptive.
      assert.ok(
        names.includes("gus_warm_pad"),
        `expected gus_warm_pad in ${JSON.stringify(names)}`,
      );
      assert.ok(
        names.includes("gus_synth_bass_1"),
        `expected gus_synth_bass_1 in ${JSON.stringify(names)}`,
      );
      assert.ok(
        out.presets.length <= 3,
        `expected <=3 presets (orphans dropped), got ${out.presets.length}`,
      );
      assert.ok(
        result.deployBytes < result.authoringBytes / 4,
        `expected meaningful shrink: ${result.deployBytes} < ${result.authoringBytes / 4}`,
      );
    } finally {
      rmSync(outPath, { force: true });
    }
  },
);

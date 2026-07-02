import { test } from "node:test";
import assert from "node:assert/strict";
import { scanUsedNames } from "../scripts/soundfont-scan-used.js";

test("scanUsedNames finds prefixed tokens in text and unions the allow list", () => {
  const text = `.s("gus_warm_pad") n("0 3").s("gus_synth_bass_1") sound("bd sd") .s("msg_atmosphere")`;
  const gus = scanUsedNames(text, "gus_", ["gus_manual_extra"]);
  assert.deepEqual([...gus].sort(), ["gus_manual_extra", "gus_synth_bass_1", "gus_warm_pad"]);
  const msg = scanUsedNames(text, "msg_", []);
  assert.deepEqual([...msg], ["msg_atmosphere"]);
});

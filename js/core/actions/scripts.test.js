// @ts-check
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CORE_NODE_VERBS, isScriptAction } from "./scripts.js";
import { A } from "../action-ids.js";

describe("isScriptAction — core/script partition", () => {
  test("core node verbs are NOT scripts", () => {
    for (const id of [A.PROBE, A.XPLOIT, A.DUMP, A.FETCH, A.MINE, A.KICK,
                       A.REBOOT, A.ABORT, A.TARGET, A.UNTARGET, A.JACKOUT, A.EXEC]) {
      assert.equal(isScriptAction(id), false, `${id} should be core`);
    }
  });

  test("set-piece + subversion actions ARE scripts", () => {
    for (const id of ["corrupt", "spoof", "disarm", "unlock-vault",
                      "extract-token", "extract-key", "decrypt-loot",
                      "scan-vault", "cancel-trace", "access-darknet"]) {
      assert.equal(isScriptAction(id), true, `${id} should be a script`);
    }
  });

  test("EXEC is in the core set so it is never treated as a script", () => {
    assert.ok(CORE_NODE_VERBS.has(A.EXEC));
  });

  test("an unknown id is treated as a script (open-world default)", () => {
    assert.equal(isScriptAction("zzz-not-a-real-action"), true);
  });
});
